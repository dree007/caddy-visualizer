"use client";

import {
  Languages,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/i18n/client";
import { LOCALES } from "@/i18n/locales";
import { logoutAction } from "@/server/auth/actions";
import { setLocaleAction } from "@/server/i18n-actions";

export function AccountMenu({ username }: { username: string }) {
  const { theme, setTheme } = useTheme();
  const [loggingOut, startLogout] = useTransition();
  const [, startLocale] = useTransition();
  const { locale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label={t.account.menu(username)}
          disabled={loggingOut}
          className="size-10 pointer-coarse:size-11"
        >
          {loggingOut ? (
            <Spinner className="size-4" />
          ) : (
            <UserRound className="size-4" strokeWidth={1.5} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {t.account.signedInAs}{" "}
          <span className="font-medium text-foreground">{username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Settings has no slot in the phone tab bar, so it lives here on phones. */}
        <DropdownMenuItem asChild className="md:hidden">
          <Link href="/settings">
            <Settings /> {t.nav.settings.label}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t.account.appearance}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">
            <Monitor /> {t.account.system}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun /> {t.account.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> {t.account.dark}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t.account.language}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(next) => startLocale(() => setLocaleAction(next))}
        >
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} lang={option}>
              <Languages /> {t.languages[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startLogout(() => logoutAction())}>
          <LogOut /> {t.account.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
