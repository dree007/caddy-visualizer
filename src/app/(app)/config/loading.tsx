import { Skeleton } from "@/components/ui/skeleton";
import { getI18n } from "@/i18n/server";

/** Shown while the sites (or a site to edit) are loaded on the server. */
export default async function ConfigLoading() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-4" aria-busy aria-live="polite">
      <span className="sr-only">{t.config.loading}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-36 w-full rounded-xl md:h-24" />
      ))}
    </div>
  );
}
