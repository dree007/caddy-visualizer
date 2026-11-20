"use client";

import { useI18n } from "@/i18n/client";

import { DesignSwitcher } from "./design-switcher";

/** The design choice as a Settings card; the same in both designs. */
export function DesignSection() {
  const { t } = useI18n();
  return (
    <section
      aria-labelledby="design-heading"
      className="surface flex flex-col gap-4 p-5 md:p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id="design-heading" className="heading">
          {t.settings.design.heading}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t.settings.design.description}
        </p>
      </div>
      <DesignSwitcher labelledBy="design-heading" />
    </section>
  );
}
