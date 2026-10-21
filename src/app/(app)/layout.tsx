import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/server/auth/session";

/** Protected area. Every page below additionally calls `requireSession()` itself. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();
  return <AppShell username={user.username}>{children}</AppShell>;
}
