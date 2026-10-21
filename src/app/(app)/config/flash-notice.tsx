"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

import {
  type Tone,
  TONE_BORDERS,
  TONE_CLASSES,
  TONE_ICONS,
} from "./sync-labels";

/**
 * One-time message after a redirect (`?notice=…`). Removes the query from the
 * URL right away, so a reload or a later refresh does not repeat it.
 */
export function FlashNotice({
  message,
  tone = "success",
}: {
  message: string;
  tone?: Tone;
}) {
  const Icon = TONE_ICONS[tone];
  const [visible, setVisible] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (!visible) return null;
  return (
    <Alert
      role={tone === "error" ? "alert" : "status"}
      className={TONE_BORDERS[tone]}
    >
      <Icon aria-hidden className={TONE_CLASSES[tone]} />
      <AlertDescription className="text-foreground">{message}</AlertDescription>
      <AlertAction className="top-1/2 -translate-y-1/2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="max-md:size-11 pointer-coarse:size-11"
          aria-label={t.common.dismiss}
          onClick={() => setVisible(false)}
        >
          <X aria-hidden />
        </Button>
      </AlertAction>
    </Alert>
  );
}
