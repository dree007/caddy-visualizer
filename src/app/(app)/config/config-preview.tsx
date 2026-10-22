import { CircleAlert, FileCode } from "lucide-react";

import { CaddyfileCode } from "@/components/caddyfile-code";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type Locale, type Messages, translateCode } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import type { SitesPreview } from "@/modules/caddy/overview";
import type { SyncStatus } from "@/modules/caddy/sync-status";

import { SYNC_TONES, TONE_CLASSES } from "./sync-labels";

/**
 * Read-only view of `sites.caddy` exactly as the generator produces it, with
 * syntax highlighting (only colors; the text itself is never changed).
 */
export function ConfigPreview({
  preview,
  sync,
  locale,
  t,
}: {
  preview: SitesPreview;
  sync: SyncStatus;
  locale: Locale;
  t: Messages;
}) {
  const p = t.config.preview;
  const status = {
    title: t.config.sync[sync.state],
    tone: SYNC_TONES[sync.state],
  };
  return (
    <section
      aria-labelledby="preview-heading"
      className="surface flex flex-col gap-3 p-5 md:p-7"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone text-foreground shadow-pressed">
          <FileCode aria-hidden className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id="preview-heading" className="heading">
            {p.heading}
          </h2>
          <p className="text-sm text-muted-foreground">{p.text}</p>
        </div>
      </div>

      {preview.ok ? (
        <>
          <pre
            aria-label={p.ariaContent}
            tabIndex={0}
            className="code-well overflow-x-auto p-4 [tab-size:4] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:p-4 md:text-[0.8125rem]"
          >
            <code>
              <CaddyfileCode text={preview.generated.content} />
            </code>
          </pre>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{p.activeSites(preview.generated.hostnames.length)}</span>
            <span className="min-w-0 break-all">
              SHA-256{" "}
              <span className="font-mono">
                {preview.generated.sha256.slice(0, 12)}
              </span>
            </span>
          </p>
          <dl className="grid gap-x-4 gap-y-1 border-t pt-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{p.currentStatus}</dt>
            <dd className={TONE_CLASSES[status.tone]}>{status.title}</dd>
            {sync.lastApplied ? (
              <>
                <dt className="text-muted-foreground">{p.lastApplied}</dt>
                <dd>
                  {p.revision(
                    sync.lastApplied.number,
                    sync.lastApplied.appliedAt
                      ? formatDateTime(sync.lastApplied.appliedAt, locale)
                      : null,
                  )}
                  {sync.lastApplied.configSha256 ===
                  preview.generated.sha256 ? (
                    p.matches
                  ) : (
                    <span className="text-muted-foreground">
                      {" "}
                      ({p.differs}, SHA-256{" "}
                      <span className="font-mono">
                        {sync.lastApplied.configSha256.slice(0, 12)}
                      </span>
                      )
                    </span>
                  )}
                </dd>
              </>
            ) : null}
          </dl>
        </>
      ) : (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>
            {translateCode(t, preview.message)}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
