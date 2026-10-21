import { redirect } from "next/navigation";

// Unauthenticated requests never get here: proxy.ts redirects them to /login.
export default function RootPage() {
  redirect("/dashboard");
}
