"use client";

import { Palette } from "lucide-react";
import { RadioGroup } from "radix-ui";

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/client";
import { DESIGNS, type Design } from "@/design";
import { cn } from "@/lib/utils";

import { useDesign } from "./design-provider";

function useDesignTexts(): Record<Design, { label: string; hint: string }> {
  const { t } = useI18n();
  return {
    classic: {
      label: t.settings.design.classic,
      hint: t.settings.design.classicHint,
    },
    schematic: {
      label: t.settings.design.schematic,
      hint: t.settings.design.schematicHint,
    },
  };
}

/** Design choice inside the account menu, next to appearance and language. */
export function DesignMenuGroup() {
  const { t } = useI18n();
  const { design, setDesign } = useDesign();
  const texts = useDesignTexts();
  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        {t.account.design}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup value={design} onValueChange={setDesign}>
        {DESIGNS.map((option) => (
          <DropdownMenuRadioItem key={option} value={option}>
            <Palette /> {texts[option].label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

/** Design choice in Settings: one card per design. */
export function DesignSwitcher({ labelledBy }: { labelledBy: string }) {
  const { design, setDesign } = useDesign();
  const texts = useDesignTexts();
  return (
    <RadioGroup.Root
      value={design}
      onValueChange={setDesign}
      aria-labelledby={labelledBy}
      className="grid gap-3 sm:grid-cols-2"
    >
      {DESIGNS.map((option) => (
        <RadioGroup.Item
          key={option}
          value={option}
          className={cn(
            "flex min-h-11 flex-col items-start gap-0.5 rounded-xl border border-border bg-card p-4 text-left outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "data-[state=checked]:border-violet data-[state=checked]:ring-1 data-[state=checked]:ring-violet",
          )}
        >
          <span className="font-semibold">{texts[option].label}</span>
          <span className="text-sm text-muted-foreground">
            {texts[option].hint}
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
