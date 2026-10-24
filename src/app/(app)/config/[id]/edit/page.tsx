import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { getI18n } from "@/i18n/server";
import { getSite } from "@/modules/caddy/sites";
import { requireSession } from "@/server/auth/session";
import { updateSiteAction } from "@/server/caddy/site-actions";
import { getDb } from "@/server/db";

import { SiteEditor } from "../../site-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.config.editor.editTitle };
}

export default async function EditSitePage({
  params,
}: PageProps<"/config/[id]/edit">) {
  await requireSession();
  const id = z.uuid().safeParse((await params).id);
  const site = id.success ? await getSite(getDb(), id.data) : null;
  if (!site) notFound();
  const { t } = await getI18n();

  return (
    <SiteEditor
      action={updateSiteAction}
      initialValues={{
        hostname: site.hostname,
        kind: site.kind,
        upstream: site.upstream ?? "",
        upstreamSkipTlsVerify: site.upstreamSkipTlsVerify,
        redirectTarget: site.redirectTarget ?? "",
        redirectCode: String(site.redirectCode ?? 308),
        tls: site.tls,
        enabled: site.enabled,
        basicAuth: site.basicAuthHash !== null,
        basicAuthUsername: site.basicAuthUsername ?? "",
        basicAuthPassword: "",
      }}
      storedPassword={site.basicAuthHash !== null}
      siteId={site.id}
      version={site.updatedAt.getTime()}
      title={t.config.editor.editTitle}
      submitLabel={t.config.editor.editSubmit}
    />
  );
}
