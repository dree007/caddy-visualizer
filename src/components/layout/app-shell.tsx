import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import logo from "@/assets/logo.png";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";

import { AccountMenu } from "./account-menu";
import { BottomNav, TopNav } from "./app-nav";
import { PageHeader } from "./page-title";

/**
 * Mobile-first application frame:
 * - a floating pill bar on top (brand, sections from `md`, account)
 * - phones: a floating tab bar at the bottom, settings in the account menu
 */
export function AppShell({
  username,
  children,
}: {
  username: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:px-6">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 rounded-full bg-card/85 pr-2 pl-3 shadow-soft-md backdrop-blur-md md:pl-4">
          <Brand />
          <TopNav className="mx-auto hidden md:flex" />
          <div className="ml-auto md:ml-0">
            <AccountMenu username={username} />
          </div>
        </div>
      </header>

      {/* Bottom padding keeps content clear of the floating tab bar on phones. */}
      <main
        id="main"
        className="mx-auto w-full max-w-6xl px-4 pt-8 pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-6 md:pt-12 md:pb-16"
      >
        <PageHeader />
        {children}
      </main>

      <BottomNav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 md:hidden" />
    </div>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt=""
      unoptimized
      loading="eager"
      className={cn("size-8 shrink-0", className)}
    />
  );
}

async function Brand() {
  const { t } = await getI18n();
  return (
    <Link
      href="/dashboard"
      aria-label={t.app.brandHome}
      className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-full pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    >
      <BrandMark />
      <span className="font-display text-[1.0625rem] font-light tracking-[-0.01em] whitespace-nowrap">
        {t.app.name}
      </span>
    </Link>
  );
}
