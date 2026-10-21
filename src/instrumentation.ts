/**
 * Next.js calls `register` once when a server instance starts (not during `next build`).
 * Node-only code lives in the dynamically imported module so the Edge build stays clean.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupTasksOrExit } = await import("@/server/startup");
    await runStartupTasksOrExit();
  }
}
