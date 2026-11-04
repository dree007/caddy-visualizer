import { AppShell } from "@/components/layout/app-shell";
import { requireAccess } from "@/server/auth/session";

/** Protected area. Every page below additionally calls `requireAccess()` itself. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const access = await requireAccess();
  return (
    <AppShell
      username={access.mode === "session" ? access.user.username : null}
    >
      {children}
    </AppShell>
  );
}
