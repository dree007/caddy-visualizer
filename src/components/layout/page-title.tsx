"use client";

import { usePathname } from "next/navigation";

import { useDesign } from "@/components/design/design-provider";
import { findActiveNavItem } from "@/config/navigation";
import { useI18n } from "@/i18n/client";

/**
 * The section as the page's main heading: a large display title with a short
 * intro on section pages, for screen readers only on sub-pages.
 */
export function PageHeader() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { design } = useDesign();
  const item = findActiveNavItem(pathname);
  if (!item) return <h1 className="sr-only">{t.app.name}</h1>;
  const texts = t.nav[item.key];

  // The "Schaltplan" dashboard leads with its own headline and range switch.
  if (item.key === "dashboard" && design === "schematic") {
    return <h1 className="sr-only">{texts.label}</h1>;
  }

  // Sub-pages bring their own back link and heading.
  if (pathname !== item.href) return <h1 className="sr-only">{texts.label}</h1>;
  return (
    <div className="mb-8 flex flex-col gap-2 md:mb-10 schematic:mb-6 schematic:gap-1.5 schematic:md:mb-8">
      <h1 className="display">{texts.label}</h1>
      <p className="max-w-xl text-base text-muted-foreground md:text-lg schematic:md:text-base">
        {texts.intro}
      </p>
    </div>
  );
}
