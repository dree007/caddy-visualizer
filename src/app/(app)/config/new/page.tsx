import type { Metadata } from "next";

import { getI18n } from "@/i18n/server";
import { requireSession } from "@/server/auth/session";
import { createSiteAction } from "@/server/caddy/site-actions";
import { emptySiteFormValues } from "@/server/caddy/site-form";

import { SiteEditor } from "../site-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.config.editor.newTitle };
}

export default async function NewSitePage() {
  await requireSession();
  const { t } = await getI18n();
  return (
    <SiteEditor
      action={createSiteAction}
      initialValues={emptySiteFormValues}
      title={t.config.editor.newTitle}
      submitLabel={t.config.editor.newSubmit}
    />
  );
}
