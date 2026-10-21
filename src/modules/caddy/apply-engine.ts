import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { createMutex } from "@/lib/mutex";
import { code } from "@/i18n/codes";
import { sha256Of } from "@/lib/sha256";
import type { Db } from "@/server/db/client";

import {
  type CaddyAdapterWarning,
  type CaddyAdminClient,
  CaddyAdminError,
} from "./admin-api";
import { hostnameCovered, routeHostnames } from "./caddy-json";
import { configFingerprint } from "./config-fingerprint";
import { generateSitesCaddy, SiteGeneratorError } from "./generator";
import {
  definesAccessLogSnippet,
  redirectManagedImport,
  validateMainEdit,
} from "./main-caddyfile";
import { restoreRevisionSnapshot } from "./rollback";
import type { InstanceLock } from "./instance-lock";
import { type ManagedFiles, writeInPlace } from "./managed-files";
import {
  type ConfigRevision,
  createRevision,
  getRevision,
  latestRevision,
  markApplied,
  markFailed,
  markLoading,
  markRecoveryRequired,
  otherUnresolvedRevisions,
  type SiteSnapshot,
  snapshotOf,
} from "./revisions";
import type { RevisionTrigger } from "./schema";
import { listSites } from "./sites";

/*
 * Apply engine: brings Caddy to a revision of the managed config.
 *
 *   lock → (recover leftovers) → generate from the DB state at this moment →
 *   revision `pending` (with the main Caddyfile it uses) → staging file →
 *   main Caddyfile with the import pointed at the staging file → /adapt
 *   (pre-check) → `loading` → /load → verify via GET /config/ → (edited main
 *   Caddyfile written in place) → rename staging → sites.caddy → `applied`
 *
 * The main Caddyfile on disk is the source of truth for itself: only an edit
 * in the UI or a rollback writes it, and only after Caddy accepted it.
 *
 * The database (desired state) is never rolled back here. `sites.caddy` on disk
 * only ever receives content Caddy has accepted, so a Caddy restart never loads
 * a rejected config. See ARCHITECTURE.md 5.4 for the reasoning and the limits.
 */

export interface ApplyLogger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

export interface ApplyEngineOptions {
  db: Db;
  caddy: CaddyAdminClient;
  files: ManagedFiles;
  /** Path of the main Caddyfile; identical in the manager and Caddy containers. */
  mainCaddyfilePath: string;
  log: ApplyLogger;
  readMainCaddyfile?: (path: string) => Promise<string>;
  writeMainCaddyfile?: (path: string, content: string) => Promise<void>;
  now?: () => Date;
  /** Wait after an unanswered `/load` before checking the running config. */
  settleDelayMs?: number;
  /**
   * Cross-process guard (one manager per managed directory). Without it the
   * in-process mutex is the only protection (tests).
   */
  lock?: InstanceLock;
  /** Test hooks to simulate a crash around the final rename. */
  hooks?: {
    beforePromote?: (revision: ConfigRevision) => Promise<void> | void;
    afterPromote?: (revision: ConfigRevision) => Promise<void> | void;
  };
}

export type ApplyResult =
  | { status: "applied"; revision: ConfigRevision }
  | { status: "failed"; revision: ConfigRevision | null; message: string }
  /** Outcome unknown (Caddy did not answer); re-checked by `recover()`. */
  | { status: "pending"; revision: ConfigRevision; message: string }
  | { status: "recovery-required"; revision: ConfigRevision; message: string };

export type RollbackResult =
  ApplyResult | { status: "rejected"; message: string };

export interface RecoveryResult {
  revision: ConfigRevision | null;
}

export type CaddyfileCheckResult =
  { ok: true; warnings: string[] } | { ok: false; message: string };

export interface ApplyEngine {
  /** Applies the current desired state (all managed sites in the DB). */
  apply(trigger: RevisionTrigger): Promise<ApplyResult>;
  /**
   * Makes the sites snapshot of an earlier, once applied revision the desired
   * state again and applies it as a new revision.
   */
  rollback(revisionId: string): Promise<RollbackResult>;
  /** Settles revisions left `pending`/`loading` by a crash or timeout. */
  recover(): Promise<RecoveryResult>;
  /**
   * Dry run of an edited main Caddyfile: edit rules, /adapt of the full
   * config with it and the host name check. Nothing is stored or loaded.
   */
  checkCaddyfile(content: string): Promise<CaddyfileCheckResult>;
  /**
   * Applies an edited main Caddyfile if the file still has `baseSha256`
   * (the version the editor was opened with). It is written only after
   * Caddy accepted it.
   */
  applyCaddyfile(content: string, baseSha256: string): Promise<RollbackResult>;
  /** True while an apply, rollback or recovery runs or waits. */
  readonly busy: boolean;
  /** Whether this process may apply (holds the instance lock, or has none). */
  holdsInstanceLock(): boolean;
}

/** Message codes (see src/i18n); stored as `errorMessage`, translated for display. */
export const APPLY_MESSAGES = {
  mainUnreadable: code("apply.mainUnreadable"),
  staging: code("apply.staging"),
  rejected: code("apply.rejected"),
  unreachable: code("apply.unreachable"),
  notTaken: code("apply.notTaken"),
  unknownOutcome: code("apply.unknownOutcome"),
  ambiguous: code("apply.ambiguous"),
  promoteFailed: code("apply.promoteFailed"),
  mainConflict: code("apply.mainConflict"),
  mainChanged: code("apply.mainChanged"),
  aborted: code("apply.aborted"),
  superseded: code("apply.superseded"),
  invalidSites: code("apply.invalidSites"),
  internal: code("apply.internal"),
  manualConflict: (hostname: string, pattern: string) =>
    code("apply.manualConflict", { hostname, pattern }),
  otherInstance: code("apply.otherInstance"),
  rollbackSource: code("apply.rollbackSource"),
} as const;

const DEFAULT_SETTLE_DELAY_MS = 1000;

export function createApplyEngine(options: ApplyEngineOptions): ApplyEngine {
  const {
    db,
    caddy,
    files,
    mainCaddyfilePath,
    log,
    readMainCaddyfile = (path) => readFile(path, "utf8"),
    writeMainCaddyfile = writeInPlace,
    now = () => new Date(),
    settleDelayMs = DEFAULT_SETTLE_DELAY_MS,
    hooks = {},
    lock,
  } = options;
  const mutex = createMutex();

  /** Takes (or confirms) the instance lock; retried on every operation. */
  function holdsLock(): boolean {
    if (!lock || lock.acquire()) return true;
    log.warn("another manager instance holds the lock; nothing applied");
    return false;
  }

  const fields = (revision: ConfigRevision, extra = {}) => ({
    revision: revision.number,
    revisionId: revision.id,
    trigger: revision.trigger,
    ...extra,
  });
  const reload = (revision: ConfigRevision) =>
    getRevision(db, revision.id) ?? revision;

  async function runningFingerprint(): Promise<string> {
    return configFingerprint((await caddy.getConfig()).config);
  }

  function fail(revision: ConfigRevision, message: string): ApplyResult {
    markFailed(db, revision.id, message, now());
    log.warn("revision failed", fields(revision, { message }));
    return { status: "failed", revision: reload(revision), message };
  }

  function recoveryRequired(
    revision: ConfigRevision,
    message: string,
  ): ApplyResult {
    markRecoveryRequired(db, revision.id, message, now());
    log.warn("revision needs recovery", fields(revision, { message }));
    return { status: "recovery-required", revision: reload(revision), message };
  }

  /**
   * Makes the files contain the revision, then marks it applied. The main
   * Caddyfile is written only for edits and rollbacks, and not if it changed
   * on disk since the apply started (`diskBefore`; unknown in recovery).
   */
  async function promote(
    revision: ConfigRevision,
    diskBefore?: string,
  ): Promise<ApplyResult> {
    await hooks.beforePromote?.(revision);
    try {
      const main = revision.mainContent;
      if (main !== null && writesMain(revision)) {
        const disk = await readMainCaddyfile(mainCaddyfilePath);
        if (disk !== main) {
          if (diskBefore !== undefined && disk !== diskBefore) {
            log.warn("main Caddyfile changed during apply", fields(revision));
            return recoveryRequired(revision, APPLY_MESSAGES.mainChanged);
          }
          await files.backupMain(disk);
          await writeMainCaddyfile(mainCaddyfilePath, main);
          log.info("main Caddyfile written", fields(revision));
        }
      }
      if ((await files.readSites()) !== revision.configContent) {
        if ((await files.readStaging(revision.id)) === revision.configContent) {
          await files.promoteStaging(revision.id);
        } else {
          // Staging file lost (e.g. crash): the revision holds the exact content.
          await files.writeSites(revision.configContent);
        }
      }
      await files.removeStaging(revision.id);
    } catch (error) {
      log.error("rename failed", fields(revision, errorFields(error)));
      return recoveryRequired(revision, APPLY_MESSAGES.promoteFailed);
    }
    log.info("rename succeeded", fields(revision));
    await hooks.afterPromote?.(revision);
    markApplied(db, revision.id, now());
    log.info("revision applied", fields(revision));
    return { status: "applied", revision: reload(revision) };
  }

  async function execute(
    revision: ConfigRevision,
    diskBefore?: string,
  ): Promise<ApplyResult> {
    log.info("apply started", fields(revision));
    if ((await files.readSites()) === null) {
      log.warn(
        "sites.caddy is missing; Caddy would not start until it exists again",
        fields(revision),
      );
    }

    const main = revision.mainContent;
    if (main === null) return fail(revision, APPLY_MESSAGES.mainUnreadable);
    const candidate = redirectManagedImport(
      main,
      files.sitesPath,
      files.stagingPath(revision.id),
    );
    if (!candidate.ok) return fail(revision, candidate.message);

    // Caddy only rejects identical site addresses. `http://host` (managed) next
    // to `host` (manual) is accepted and would take over port 80 of a manual
    // site, so the manual part's host names are checked here explicitly.
    const conflict = await manualConflict(
      main,
      managedHostnames(revision),
      fields(revision),
    );
    if (conflict !== null) return fail(revision, conflict);

    try {
      await files.writeStaging(revision.id, revision.configContent);
    } catch (error) {
      log.error("staging write failed", fields(revision, errorFields(error)));
      return fail(revision, APPLY_MESSAGES.staging);
    }

    let expected: string;
    try {
      const adapted = await caddy.adaptCaddyfile(candidate.value);
      expected = configFingerprint(adapted.config);
      log.info(
        "adapt succeeded",
        fields(revision, { warnings: adapted.warnings.length }),
      );
    } catch (error) {
      log.warn("adapt failed", fields(revision, errorFields(error)));
      await files.removeStaging(revision.id);
      return fail(revision, messageFor(error));
    }

    // Reference for an unanswered /load: was the old config still running?
    let before: string | null = null;
    try {
      before = await runningFingerprint();
    } catch (error) {
      log.warn("running config unreadable before load", errorFields(error));
    }

    markLoading(db, revision.id, expected, now());
    try {
      await caddy.loadCaddyfile(candidate.value, {
        sourceFile: mainCaddyfilePath,
      });
      log.info("load succeeded", fields(revision));
    } catch (error) {
      if (
        error instanceof CaddyAdminError &&
        error.kind === "http" &&
        error.status === 400
      ) {
        // Documented and verified: Caddy keeps running the previous config.
        log.warn("load failed", fields(revision, errorFields(error)));
        await files.removeStaging(revision.id);
        return fail(revision, messageFor(error));
      }
      log.warn("load outcome unknown", fields(revision, errorFields(error)));
      await sleep(settleDelayMs);
      return settle(revision, expected, before, diskBefore);
    }
    return verifyAndPromote(revision, expected, diskBefore);
  }

  /**
   * Adapts the main Caddyfile without the form sites and checks their host
   * names against it; null = no conflict.
   */
  async function manualConflict(
    main: string,
    hostnames: readonly string[],
    logFields: Record<string, unknown>,
  ): Promise<string | null> {
    const manualOnly = redirectManagedImport(
      main,
      files.sitesPath,
      files.emptyPath,
    );
    if (!manualOnly.ok) return manualOnly.message;
    let manualHosts: Set<string>;
    try {
      await files.writeEmpty(generateSitesCaddy([]).content);
      manualHosts = routeHostnames(
        (await caddy.adaptCaddyfile(manualOnly.value)).config,
      );
    } catch (error) {
      log.warn("adapt of the manual part failed", {
        ...logFields,
        ...errorFields(error),
      });
      return messageFor(error);
    } finally {
      await files.removeEmpty().catch(() => undefined);
    }
    for (const hostname of hostnames) {
      const pattern = hostnameCovered(hostname, manualHosts);
      if (pattern !== null) {
        log.warn("hostname conflict with the manual part", {
          ...logFields,
          hostname,
        });
        return APPLY_MESSAGES.manualConflict(hostname, pattern);
      }
    }
    return null;
  }

  async function verifyAndPromote(
    revision: ConfigRevision,
    expected: string,
    diskBefore?: string,
  ): Promise<ApplyResult> {
    let running: string;
    try {
      running = await runningFingerprint();
    } catch (error) {
      log.warn(
        "verification unavailable",
        fields(revision, errorFields(error)),
      );
      return pending(revision);
    }
    if (running !== expected) {
      log.warn("verification mismatch", fields(revision));
      return recoveryRequired(revision, APPLY_MESSAGES.ambiguous);
    }
    log.info("verification succeeded", fields(revision));
    return promote(revision, diskBefore);
  }

  /** `/load` gave no reliable answer: decide from what Caddy runs now. */
  async function settle(
    revision: ConfigRevision,
    expected: string,
    before: string | null,
    diskBefore?: string,
  ): Promise<ApplyResult> {
    let running: string;
    try {
      // Blocks behind an in-flight load inside Caddy (config lock).
      running = await runningFingerprint();
    } catch (error) {
      log.warn(
        "verification unavailable",
        fields(revision, errorFields(error)),
      );
      return pending(revision);
    }
    if (running === expected) {
      log.info(
        "verification succeeded after unknown load outcome",
        fields(revision),
      );
      return promote(revision, diskBefore);
    }
    if (before !== null && running === before) {
      await files.removeStaging(revision.id);
      return fail(revision, APPLY_MESSAGES.notTaken);
    }
    return recoveryRequired(revision, APPLY_MESSAGES.ambiguous);
  }

  function pending(revision: ConfigRevision): ApplyResult {
    log.warn("revision outcome unknown", fields(revision));
    return {
      status: "pending",
      revision: reload(revision),
      message: APPLY_MESSAGES.unknownOutcome,
    };
  }

  /** Guards against bugs: never leave a revision `pending` after an exception. */
  async function executeSafely(
    revision: ConfigRevision,
    diskBefore?: string,
  ): Promise<ApplyResult> {
    try {
      return await execute(revision, diskBefore);
    } catch (error) {
      log.error("apply crashed", fields(revision, errorFields(error)));
      const current = reload(revision);
      if (current.status === "pending") {
        return fail(current, APPLY_MESSAGES.internal);
      }
      return pending(current);
    }
  }

  async function recoverUnlocked(): Promise<RecoveryResult> {
    const latest = latestRevision(db);
    if (!latest) return { revision: null };
    if (!holdsLock()) return { revision: latest };

    for (const older of otherUnresolvedRevisions(db, latest.id)) {
      if (older.status === "pending")
        markFailed(db, older.id, APPLY_MESSAGES.aborted, now());
      else markRecoveryRequired(db, older.id, APPLY_MESSAGES.superseded, now());
      log.warn("older unresolved revision closed", fields(older));
    }

    if (latest.status === "pending") {
      await files.removeStaging(latest.id);
      markFailed(db, latest.id, APPLY_MESSAGES.aborted, now());
      log.warn("pending revision aborted", fields(latest));
    } else if (
      latest.status === "loading" ||
      latest.status === "recovery-required"
    ) {
      log.info("recovery started", fields(latest, { status: latest.status }));
      await decide(latest);
      log.info(
        "recovery completed",
        fields(latest, { status: reload(latest).status }),
      );
    }

    const current = reload(latest);
    const keep =
      current.status === "loading" || current.status === "recovery-required"
        ? [current.id]
        : [];
    await files
      .cleanUp(keep)
      .catch((error: unknown) =>
        log.warn("staging cleanup failed", errorFields(error)),
      );
    return { revision: current };
  }

  /** Compares the running config with the revision and with the files on disk. */
  async function decide(revision: ConfigRevision): Promise<void> {
    let running: string;
    try {
      running = await runningFingerprint();
    } catch (error) {
      // Caddy unreachable: leave it unresolved, never assume success.
      log.warn(
        "recovery postponed, Caddy unreachable",
        fields(revision, errorFields(error)),
      );
      return;
    }
    if (revision.expectedConfigFingerprint === running) {
      await promote(revision);
      return;
    }
    let onDisk: string | null = null;
    try {
      const main = await readMainCaddyfile(mainCaddyfilePath);
      onDisk = configFingerprint((await caddy.adaptCaddyfile(main)).config);
    } catch (error) {
      log.warn(
        "recovery could not adapt the files on disk",
        errorFields(error),
      );
    }
    if (onDisk !== null && onDisk === running) {
      await files.removeStaging(revision.id);
      fail(revision, APPLY_MESSAGES.notTaken);
      return;
    }
    if (revision.status !== "recovery-required") {
      recoveryRequired(revision, APPLY_MESSAGES.ambiguous);
    }
  }

  async function recoverSafely(): Promise<void> {
    try {
      await recoverUnlocked();
    } catch (error) {
      log.error("recovery crashed", errorFields(error));
    }
  }

  async function readMain(): Promise<string | null> {
    try {
      return await readMainCaddyfile(mainCaddyfilePath);
    } catch (error) {
      log.error("main Caddyfile unreadable", errorFields(error));
      return null;
    }
  }

  async function checkCaddyfileUnlocked(
    content: string,
  ): Promise<CaddyfileCheckResult> {
    const disk = await readMain();
    if (disk === null) {
      return { ok: false, message: APPLY_MESSAGES.mainUnreadable };
    }
    const rules = validateMainEdit(disk, content, files.sitesPath);
    if (!rules.ok) return { ok: false, message: rules.message };
    const names = { [mainCaddyfilePath]: "Caddyfile" };
    let warnings: CaddyAdapterWarning[];
    try {
      warnings = (await caddy.adaptCaddyfile(content)).warnings;
    } catch (error) {
      log.info("Caddyfile check rejected", errorFields(error));
      return { ok: false, message: checkMessage(error, names) };
    }
    const hostnames = (await listSites(db))
      .filter((site) => site.enabled)
      .map((site) => site.hostname);
    const conflict = await manualConflict(content, hostnames, { check: true });
    if (conflict !== null) return { ok: false, message: conflict };
    return {
      ok: true,
      warnings: warnings.map((warning) => warningText(warning, names)),
    };
  }

  async function applyCaddyfileUnlocked(
    content: string,
    baseSha256: string,
  ): Promise<RollbackResult> {
    await recoverSafely();
    const disk = await readMain();
    if (disk === null) {
      return { status: "rejected", message: APPLY_MESSAGES.mainUnreadable };
    }
    if (sha256Of(disk) !== baseSha256) {
      return { status: "rejected", message: APPLY_MESSAGES.mainConflict };
    }
    const rules = validateMainEdit(disk, content, files.sitesPath);
    if (!rules.ok) return { status: "rejected", message: rules.message };
    const sites = await listSites(db);
    let generated;
    try {
      generated = generateSitesCaddy(sites, {
        accessLog: definesAccessLogSnippet(content),
      });
    } catch (error) {
      if (!(error instanceof SiteGeneratorError)) throw error;
      return { status: "rejected", message: APPLY_MESSAGES.invalidSites };
    }
    const revision = createRevision(
      db,
      {
        trigger: "caddyfile-updated",
        configContent: generated.content,
        configSha256: generated.sha256,
        sitesSnapshot: snapshotOf(sites),
        mainContent: content,
      },
      now(),
    );
    log.info("revision created", fields(revision));
    return executeSafely(revision, disk);
  }

  return {
    apply(trigger) {
      return mutex.run(async () => {
        if (!holdsLock()) {
          return {
            status: "failed",
            revision: null,
            message: APPLY_MESSAGES.otherInstance,
          } as const;
        }
        await recoverSafely();
        // Generated from the DB state *after* acquiring the lock, so changes
        // made while an earlier apply ran are included.
        const sites = await listSites(db);
        const main = await readMain();
        let generated;
        try {
          generated = generateSitesCaddy(sites, {
            accessLog: main !== null && definesAccessLogSnippet(main),
          });
        } catch (error) {
          if (!(error instanceof SiteGeneratorError)) throw error;
          log.error("generation failed", errorFields(error));
          return {
            status: "failed",
            revision: null,
            message: APPLY_MESSAGES.invalidSites,
          } as const;
        }
        const revision = createRevision(
          db,
          {
            trigger,
            configContent: generated.content,
            configSha256: generated.sha256,
            sitesSnapshot: snapshotOf(sites),
            mainContent: main,
          },
          now(),
        );
        log.info(
          "revision created",
          fields(revision, { sha256: generated.sha256 }),
        );
        return executeSafely(revision);
      });
    },

    rollback(revisionId) {
      return mutex.run(async () => {
        if (!holdsLock()) {
          return {
            status: "rejected",
            message: APPLY_MESSAGES.otherInstance,
          } as const;
        }
        await recoverSafely();
        const source = getRevision(db, revisionId);
        if (!source || source.status !== "applied") {
          return {
            status: "rejected",
            message: APPLY_MESSAGES.rollbackSource,
          } as const;
        }
        const disk = await readMain();
        if (disk === null) {
          return {
            status: "rejected",
            message: APPLY_MESSAGES.mainUnreadable,
          } as const;
        }
        const main = source.mainContent ?? disk;
        const rules = validateMainEdit(disk, main, files.sitesPath);
        if (!rules.ok) {
          return { status: "rejected", message: rules.message } as const;
        }
        // The snapshot becomes the desired state again (sites + revision in
        // one transaction); then the normal apply runs, with the same recovery.
        const restored = restoreRevisionSnapshot(db, source, now(), main);
        if (!restored.ok) {
          log.warn("rollback rejected", { source: source.number });
          return { status: "rejected", message: restored.message } as const;
        }
        const { revision } = restored;
        log.info(
          "revision created",
          fields(revision, {
            source: source.number,
            sitesRestored: true,
            // Differs only if the generator changed since the source revision.
            sameContentAsSource:
              revision.configSha256 === source.configSha256 &&
              revision.mainContent === source.mainContent,
          }),
        );
        return executeSafely(revision, disk);
      });
    },

    recover() {
      return mutex.run(recoverUnlocked);
    },

    checkCaddyfile(content) {
      return mutex.run(async () => {
        if (!holdsLock()) {
          return { ok: false, message: APPLY_MESSAGES.otherInstance } as const;
        }
        return checkCaddyfileUnlocked(content);
      });
    },

    applyCaddyfile(content, baseSha256) {
      return mutex.run(async () => {
        if (!holdsLock()) {
          return {
            status: "rejected",
            message: APPLY_MESSAGES.otherInstance,
          } as const;
        }
        return applyCaddyfileUnlocked(content, baseSha256);
      });
    },

    get busy() {
      return mutex.busy;
    },

    holdsInstanceLock() {
      return !lock || lock.acquire();
    },
  };
}

/** Message code for a failed adapt/load; Caddy's raw text stays in the log. */
export function messageFor(error: unknown): string {
  if (!(error instanceof CaddyAdminError)) return APPLY_MESSAGES.internal;
  if (error.kind !== "http") return APPLY_MESSAGES.unreachable;
  const duplicate = /ambiguous site definition: ([a-z0-9.:[\]-]{1,260})/i.exec(
    error.caddyMessage ?? "",
  );
  if (duplicate) {
    return code("apply.duplicateAddress", { address: duplicate[1]! });
  }
  return APPLY_MESSAGES.rejected;
}

/** Only an edit or a rollback brings its own main Caddyfile; others keep the file. */
function writesMain(revision: ConfigRevision): boolean {
  return (
    revision.trigger === "caddyfile-updated" || revision.trigger === "rollback"
  );
}

/**
 * Caddy's own message for the editor (it names file and line), with paths
 * replaced by the file names the user knows.
 */
function checkMessage(error: unknown, names: Record<string, string>): string {
  if (!(error instanceof CaddyAdminError) || error.kind !== "http") {
    return messageFor(error);
  }
  return error.caddyMessage
    ? renamePaths(error.caddyMessage, names)
    : APPLY_MESSAGES.rejected;
}

function warningText(
  warning: CaddyAdapterWarning,
  names: Record<string, string>,
): string {
  const file = warning.file
    ? (names[warning.file] ?? basename(warning.file))
    : "";
  const where = file
    ? `${file}${warning.line ? `:${warning.line}` : ""}: `
    : "";
  return renamePaths(`${where}${warning.message ?? "Warnung"}`, names);
}

function renamePaths(text: string, names: Record<string, string>): string {
  let result = text;
  for (const [path, name] of Object.entries(names)) {
    result = result.split(path).join(name);
  }
  return result;
}

/** Enabled host names of a revision, from its own snapshot (also for rollbacks). */
function managedHostnames(revision: ConfigRevision): string[] {
  try {
    const sites = JSON.parse(revision.sitesSnapshot) as SiteSnapshot[];
    return sites.filter((site) => site.enabled).map((site) => site.hostname);
  } catch {
    return [];
  }
}

function errorFields(error: unknown): Record<string, unknown> {
  if (error instanceof CaddyAdminError) {
    return {
      error: error.message,
      kind: error.kind,
      status: error.status,
      caddyMessage: error.caddyMessage,
    };
  }
  if (error instanceof Error) {
    return {
      error: error.message,
      code: (error as NodeJS.ErrnoException).code,
    };
  }
  return { error: String(error) };
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
