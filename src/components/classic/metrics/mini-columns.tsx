"use client";

import { type KeyboardEvent, type PointerEvent, useState } from "react";

import { useI18n } from "@/i18n/client";
import { formatCount } from "@/lib/format";

/**
 * Compact column chart for small multiples: one series, its own scale. One
 * focus stop; the arrow keys move through the columns, the tooltip names the
 * period and the value. Every value is also in the section's table.
 */
export function MiniColumns({
  values,
  labels,
  color,
  label,
  className,
}: {
  values: number[];
  /** Tooltip label per column, same length as `values`. */
  labels: string[];
  color: string;
  /** Accessible summary of the whole chart. */
  label: string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { locale } = useI18n();
  const max = Math.max(0, ...values);

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(
      ((event.clientX - box.left) / box.width) * values.length,
    );
    setActive(Math.min(values.length - 1, Math.max(0, index)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(values.length - 1);
    else if (step) {
      setActive((current) =>
        Math.min(
          values.length - 1,
          Math.max(0, (current ?? (step > 0 ? -1 : values.length)) + step),
        ),
      );
    } else return;
    event.preventDefault();
  };
  const current = active === null ? null : values[active];

  return (
    <div
      role="img"
      aria-label={label}
      tabIndex={0}
      onPointerMove={fromPointer}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive((a) => a ?? values.length - 1)}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
      className={`relative flex items-end gap-[2px] rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card ${className ?? "h-14"}`}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: "var(--viz-grid)" }}
      />
      {values.map((value, index) => (
        <span
          key={index}
          aria-hidden
          className="relative block min-w-0 flex-1 rounded-t-[3px] transition-opacity duration-150"
          style={{
            height:
              max > 0 && value > 0 ? `max(2px, ${(value / max) * 100}%)` : 0,
            background: color,
            opacity: active === null || active === index ? 1 : 0.45,
          }}
        />
      ))}
      {current !== null && active !== null ? (
        <span
          role="status"
          className="pointer-events-none absolute bottom-full z-10 mb-2 flex -translate-x-1/2 flex-col rounded-xl bg-popover px-3 py-2 text-xs whitespace-nowrap shadow-soft-lg"
          style={{
            left: `clamp(3rem, ${((active + 0.5) / values.length) * 100}%, calc(100% - 3rem))`,
          }}
        >
          <span className="font-medium text-foreground tabular-nums">
            {formatCount(current, locale)}
          </span>
          <span className="text-muted-foreground">{labels[active]}</span>
        </span>
      ) : null}
    </div>
  );
}
