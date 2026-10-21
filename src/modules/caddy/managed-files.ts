import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

/*
 * The only files the manager writes, all inside the managed directory
 * (`/config/manager` in production):
 *
 *   sites.caddy              imported by the main Caddyfile
 *   sites.caddy.prev         previous content, for manual emergency recovery
 *   Caddyfile.prev           main Caddyfile before the editor last wrote it
 *   .staging/<uuid>.caddy    candidate of one revision
 *
 * plus the main Caddyfile itself, which is only ever written in place
 * (`writeInPlace`).
 *
 * Every path is built from the fixed directory, fixed names and a
 * server-generated revision UUID. Nothing here accepts a path or file name
 * from user input.
 */

export const SITES_FILE = "sites.caddy";
/** Import target without managed sites, to adapt the manual part alone. */
export const EMPTY_FILE = "empty.caddy";
export const PREVIOUS_FILE = "sites.caddy.prev";
export const MAIN_PREVIOUS_FILE = "Caddyfile.prev";
export const STAGING_DIR = ".staging";

const FILE_MODE = 0o644;
const DIR_MODE = 0o755;
const revisionId = z.uuid();

export interface ManagedFiles {
  readonly sitesPath: string;
  stagingPath(revisionId: string): string;
  /** Path of a header-only file (written on demand) inside the staging directory. */
  readonly emptyPath: string;
  writeEmpty(content: string): Promise<void>;
  removeEmpty(): Promise<void>;
  /** Content of `sites.caddy`, or `null` if it does not exist. */
  readSites(): Promise<string | null>;
  readStaging(revisionId: string): Promise<string | null>;
  writeStaging(revisionId: string, content: string): Promise<void>;
  /** Atomically replaces `sites.caddy` with the staging file of the revision. */
  promoteStaging(revisionId: string): Promise<void>;
  /** Atomically replaces `sites.caddy` with the given content. */
  writeSites(content: string): Promise<void>;
  removeStaging(revisionId: string): Promise<void>;
  /** Keeps a copy of the main Caddyfile before it is overwritten. */
  backupMain(content: string): Promise<void>;
  /** Removes staging files of other revisions and leftover temporary files. */
  cleanUp(keepRevisionIds: readonly string[]): Promise<void>;
}

export function createManagedFiles(managedDir: string): ManagedFiles {
  const stagingDir = join(managedDir, STAGING_DIR);
  const sitesPath = join(managedDir, SITES_FILE);

  function stagingPath(id: string): string {
    // Defense in depth: IDs are generated server-side, but never trust a path part.
    if (!revisionId.safeParse(id).success) {
      throw new TypeError("Invalid revision id");
    }
    return join(stagingDir, `${id}.caddy`);
  }

  return {
    sitesPath,
    stagingPath,
    emptyPath: join(stagingDir, EMPTY_FILE),

    async writeEmpty(content) {
      await mkdir(stagingDir, { recursive: true, mode: DIR_MODE });
      await writeFileAtomic(stagingDir, EMPTY_FILE, content);
    },

    async removeEmpty() {
      await unlinkIfExists(join(stagingDir, EMPTY_FILE));
    },

    readSites: () => readIfExists(sitesPath),
    readStaging: (id) => readIfExists(stagingPath(id)),

    async writeStaging(id, content) {
      await mkdir(stagingDir, { recursive: true, mode: DIR_MODE });
      await writeFileAtomic(stagingDir, `${id}.caddy`, content);
    },

    async promoteStaging(id) {
      const source = stagingPath(id);
      await backupCurrent(managedDir, sitesPath);
      // Same directory tree on the same mount: rename(2) is atomic.
      await rename(source, sitesPath);
      await fsyncDirectory(managedDir);
      await fsyncDirectory(stagingDir);
    },

    async writeSites(content) {
      await backupCurrent(managedDir, sitesPath);
      await writeFileAtomic(managedDir, SITES_FILE, content);
    },

    async removeStaging(id) {
      await unlinkIfExists(stagingPath(id));
    },

    async backupMain(content) {
      await writeFileAtomic(managedDir, MAIN_PREVIOUS_FILE, content);
    },

    async cleanUp(keep) {
      const keepNames = new Set(keep.map((id) => `${id}.caddy`));
      for (const name of await listIfExists(stagingDir)) {
        if (!keepNames.has(name)) await unlinkIfExists(join(stagingDir, name));
      }
      for (const name of await listIfExists(managedDir)) {
        if (name.startsWith(".") && name.endsWith(".tmp")) {
          await unlinkIfExists(join(managedDir, name));
        }
      }
    },
  };
}

/**
 * open(O_EXCL) → write → fsync → close → rename → fsync(directory). A crash
 * leaves at most a `.<name>.<uuid>.tmp` file, never a partial target file.
 */
export async function writeFileAtomic(
  dir: string,
  name: string,
  content: string,
): Promise<void> {
  const target = join(dir, name);
  const temporary = join(dir, `.${name}.${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", FILE_MODE);
  try {
    await handle.writeFile(content, "utf8");
    // Independent of the process umask.
    await handle.chmod(FILE_MODE);
    await handle.sync();
  } catch (error) {
    await handle.close();
    await unlinkIfExists(temporary);
    throw error;
  }
  await handle.close();
  try {
    await rename(temporary, target);
  } catch (error) {
    await unlinkIfExists(temporary);
    throw error;
  }
  await fsyncDirectory(dir);
}

/**
 * Overwrites a file without replacing it: same inode, so a single-file bind
 * mount (as Caddy's own container uses for the Caddyfile) sees the change.
 * The new content is written first and the file shortened afterwards, so it
 * never appears empty. Not atomic: keep a backup before calling this.
 */
export async function writeInPlace(
  path: string,
  content: string,
): Promise<void> {
  const data = Buffer.from(content, "utf8");
  const handle = await open(path, "r+");
  try {
    await handle.write(data, 0, data.length, 0);
    await handle.truncate(data.length);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function backupCurrent(dir: string, sitesPath: string): Promise<void> {
  const current = await readIfExists(sitesPath);
  if (current !== null) await writeFileAtomic(dir, PREVIOUS_FILE, current);
}

/** Makes a rename durable: the directory entry itself must be flushed. */
async function fsyncDirectory(dir: string): Promise<void> {
  const handle = await open(dir, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function unlinkIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function listIfExists(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
