"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  isNavItemActive,
  navItems,
  primaryNavItems,
} from "@/config/navigation";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Segmented pill control in the top bar, from `md` upwards. */
export function TopNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav aria-label={t.nav.main} className={className}>
      <ul className="surface-pressed flex items-center gap-0.5 p-1">
        {navItems.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] duration-200 lg:px-4",
                  "outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-card text-foreground shadow-soft-sm",
                )}
              >
                <item.icon
                  className="size-4 shrink-0"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span className="lg:hidden">{t.nav[item.key].short}</span>
                <span className="hidden lg:inline">
                  {t.nav[item.key].label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Floating tab bar for phones (primary sections only). */
export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      aria-label={t.nav.main}
      className={cn(
        "rounded-full bg-card/90 p-1.5 shadow-soft-lg backdrop-blur-md",
        className,
      )}
    >
      <ul className="grid grid-cols-4 gap-1">
        {primaryNavItems.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-medium",
                  "text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  active && "bg-stone text-foreground shadow-pressed",
                )}
              >
                <item.icon
                  className="size-5"
                  strokeWidth={active ? 1.75 : 1.5}
                  aria-hidden
                />
                <span>{t.nav[item.key].short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
