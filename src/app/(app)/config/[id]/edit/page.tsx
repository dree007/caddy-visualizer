import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { getI18n } from "@/i18n/server";
import { toLoadBalancingInput } from "@/modules/caddy/load-balancing";
import { formatWindow } from "@/modules/caddy/rate-limit";
import { getSite } from "@/modules/caddy/sites";
import { checkRateLimitModule } from "@/server/caddy/admin";
import { requireAccess } from "@/server/auth/session";
import { updateSiteAction } from "@/server/caddy/site-actions";
import { getDb } from "@/server/db";

import { SiteEditor } from "../../site-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.config.editor.editTitle };
}

export default async function EditSitePage({
  params,
}: PageProps<"/config/[id]/edit">) {
  await requireAccess();
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
        loadBalancing: site.loadBalancing
          ? toLoadBalancingInput(site.loadBalancing)
          : null,
        upstreamSkipTlsVerify: site.upstreamSkipTlsVerify,
        upstreamHeaders: site.upstreamHeaders,
        redirectTarget: site.redirectTarget ?? "",
        redirectCode: String(site.redirectCode ?? 308),
        tls: site.tls,
        enabled: site.enabled,
        basicAuth: site.basicAuthHash !== null,
        basicAuthUsername: site.basicAuthUsername ?? "",
        basicAuthPassword: "",
        rateLimitRules: site.rateLimitRules.map((rule) => ({
          name: rule.name,
          enabled: rule.enabled,
          path: rule.path ?? "",
          events: String(rule.events),
          window: formatWindow(rule.windowSeconds),
          key: rule.key,
          keyName: rule.keyName ?? "",
        })),
      }}
      rateLimitModule={await checkRateLimitModule()}
      storedPassword={site.basicAuthHash !== null}
      siteId={site.id}
      version={site.updatedAt.getTime()}
      title={t.config.editor.editTitle}
      submitLabel={t.config.editor.editSubmit}
    />
  );
}
