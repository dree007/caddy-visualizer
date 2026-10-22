import { Fragment } from "react";

import { highlightCaddyfile } from "@/lib/caddyfile-highlight";

/**
 * Highlighted Caddyfile text for a `<pre>`; renders exactly `text` (a final
 * newline adds no visible line there).
 */
export function CaddyfileCode({ text }: { text: string }) {
  const lines = highlightCaddyfile(text);
  return lines.map((segments, line) => (
    <Fragment key={line}>
      {segments.map((segment, index) =>
        segment.kind === "plain" ? (
          segment.text
        ) : (
          <span key={index} className={`syntax-${segment.kind}`}>
            {segment.text}
          </span>
        ),
      )}
      {line < lines.length - 1 ? "\n" : null}
    </Fragment>
  ));
}
