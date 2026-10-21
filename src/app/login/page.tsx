import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/layout/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getI18n } from "@/i18n/server";
import { secureCookieRejected } from "@/server/auth/cookie";
import { safeRedirectPath } from "@/server/auth/redirect";
import { getCurrentSession } from "@/server/auth/session";

import { LanguageSwitch } from "./language-switch";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.login.title };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  if (await getCurrentSession()) redirect(safeRedirectPath(nextPath));
  const { t } = await getI18n();
  const request = await headers();
  const cookieRejected = secureCookieRejected(
    request.get("x-forwarded-host") ?? request.get("host"),
    request.get("x-forwarded-proto"),
  );

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <BrandMark className="size-16" />
          <div className="mt-6">
            <h1 className="display">{t.app.name}</h1>
            <p className="mt-2 text-muted-foreground">{t.login.subtitle}</p>
          </div>
        </div>
        {cookieRejected ? (
          <Alert className="mb-4">
            <TriangleAlert aria-hidden />
            <AlertDescription>{t.login.insecureHttp}</AlertDescription>
          </Alert>
        ) : null}
        <div className="surface p-6 sm:p-8">
          <LoginForm next={nextPath} />
        </div>
        <LanguageSwitch />
      </div>
    </main>
  );
}
