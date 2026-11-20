import { ArrowLeft, CircleAlert, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { getI18n } from "@/i18n/server";
import { loadCaddyfileEditorStatus } from "@/server/caddy/caddyfile";

import { CaddyfileEditor } from "./caddyfile-editor";
import { getDesign } from "@/server/design";

import ClassicCaddyfilePage from "./classic/classic-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.caddyfile.title };
}

async function SchematicCaddyfilePage() {
  const status = await loadCaddyfileEditorStatus();
  const { t } = await getI18n();
  const c = t.caddyfile;

  return (
    <div className="flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link
          href="/config"
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-violet-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-8"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t.common.backToOverview}
        </Link>
        <h2 className="heading text-2xl">{c.heading}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{c.intro}</p>
      </div>

      <section className="surface flex flex-col gap-5 p-5 sm:p-7">
        {status.state === "ok" ? (
          <>
            {status.replaced ? (
              <Notice tone="warning">{c.replaced}</Notice>
            ) : null}
            {!status.writable ? (
              <Notice tone="warning">{c.notWritable}</Notice>
            ) : null}
            <p className="text-sm text-muted-foreground">{c.rules}</p>
            <CaddyfileEditor
              initialContent={status.content}
              initialSha256={status.sha256}
            />
          </>
        ) : (
          <Notice tone="error">
            {status.state === "unreadable"
              ? c.unreadable(status.path)
              : t.common.notConfigured}
          </Notice>
        )}
      </section>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "warning" | "error";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : TriangleAlert;
  return (
    <Alert variant={tone === "error" ? "destructive" : "default"}>
      <Icon aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** "Klassisch" is the page as on main; "Schaltplan" is the redesign. */
export default async function CaddyfilePage() {
  if ((await getDesign()) === "classic") return ClassicCaddyfilePage();
  return SchematicCaddyfilePage();
}
