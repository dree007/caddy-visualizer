"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { CaddyfileCode } from "@/components/caddyfile-code";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DiffLine } from "@/lib/line-diff";
import { caddyfileEditorAction } from "@/server/caddy/caddyfile-actions";
import type { CaddyfileEditorResult } from "@/server/caddy/caddyfile-form";
import { type Messages, translateCode } from "@/i18n";
import { useI18n } from "@/i18n/client";

import { applySentence, TONE_CLASSES } from "../sync-labels";

export function CaddyfileEditor({
  initialContent,
  initialSha256,
}: {
  initialContent: string;
  initialSha256: string;
}) {
  const [state, formAction, pending] = useActionState(caddyfileEditorAction, {
    content: initialContent,
    fileContent: initialContent,
    baseSha256: initialSha256,
    attempt: 0,
  });
  const [text, setText] = useState(initialContent);
  const { t } = useI18n();
  const c = t.caddyfile;
  // After a successful save the file is the (normalized) text.
  const [synced, setSynced] = useState(0);
  if (state.result?.kind === "saved" && synced !== state.attempt) {
    setSynced(state.attempt);
    if (state.result.outcome.state === "applied") setText(state.fileContent);
  }
  const dirty = text !== state.fileContent;
  const highlight = useRef<HTMLPreElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="baseSha256" value={state.baseSha256} />
      <label htmlFor="caddyfile-content" className="sr-only">
        {c.content}
      </label>
      {/* The highlighted copy lies under the textarea, whose own text is transparent. */}
      <div className="field relative overflow-hidden focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/35">
        <pre
          ref={highlight}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-0 overflow-hidden p-4 font-mono text-[0.8125rem] leading-relaxed whitespace-pre [tab-size:4]"
        >
          <CaddyfileCode text={`${text}\n`} />
        </pre>
        <textarea
          id="caddyfile-content"
          name="content"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onScroll={(event) => {
            highlight.current?.scrollTo(
              event.currentTarget.scrollLeft,
              event.currentTarget.scrollTop,
            );
          }}
          wrap="off"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          rows={28}
          aria-describedby="caddyfile-result"
          className="relative block min-h-96 w-full resize-y bg-transparent p-4 font-mono text-[0.8125rem] leading-relaxed whitespace-pre [tab-size:4] text-transparent caret-foreground outline-none selection:bg-ring/25"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          name="intent"
          value="check"
          variant="outline"
          disabled={pending}
          className="max-md:h-11 max-sm:flex-1"
        >
          {c.check}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="save"
          disabled={pending || !dirty}
          className="max-md:h-11 max-sm:flex-1"
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {c.save}
        </Button>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {dirty ? c.dirty : c.clean}
        </span>
      </div>

      <div id="caddyfile-result" aria-live="polite">
        {state.result && !pending ? (
          <Result result={state.result} t={t} />
        ) : null}
      </div>
    </form>
  );
}

function Result({ result, t }: { result: CaddyfileEditorResult; t: Messages }) {
  const c = t.caddyfile;
  switch (result.kind) {
    case "error":
      return (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription className="whitespace-pre-wrap">
            {translateCode(t, result.message)}
          </AlertDescription>
        </Alert>
      );
    case "checked":
      return (
        <div className="flex flex-col gap-3">
          <Alert>
            <CircleCheck aria-hidden className={TONE_CLASSES.success} />
            <AlertDescription>
              {c.accepted}
              {result.unchanged ? c.unchanged : ""}
            </AlertDescription>
          </Alert>
          <Warnings warnings={result.warnings} />
          {result.unchanged ? null : <Diff diff={result.diff} t={t} />}
        </div>
      );
    case "saved": {
      const sentence = applySentence(t, result.outcome);
      return (
        <div className="flex flex-col gap-3">
          <Alert
            variant={sentence.tone === "error" ? "destructive" : "default"}
          >
            <CircleCheck aria-hidden className={TONE_CLASSES[sentence.tone]} />
            <AlertDescription>
              {result.outcome.state === "applied" ? c.saved : c.notSaved}
              {sentence.text}
              {result.outcome.message
                ? ` ${translateCode(t, result.outcome.message)}`
                : ""}
            </AlertDescription>
          </Alert>
          <Warnings warnings={result.warnings} />
        </div>
      );
    }
  }
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm text-amber-700 dark:text-amber-400">
      {warnings.map((warning, index) => (
        <li key={index} className="font-mono text-xs">
          {warning}
        </li>
      ))}
    </ul>
  );
}

const DIFF_CLASSES = {
  same: "text-muted-foreground",
  added: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  removed: "bg-destructive/10 text-destructive",
} as const;
const DIFF_PREFIX = { same: " ", added: "+", removed: "-" } as const;

function Diff({ diff, t }: { diff: DiffLine[] | null; t: Messages }) {
  if (diff === null) {
    return (
      <p className="text-sm text-muted-foreground">{t.caddyfile.tooLarge}</p>
    );
  }
  return (
    <pre
      aria-label={t.caddyfile.diffLabel}
      tabIndex={0}
      className="code-well overflow-x-auto py-3 [tab-size:4] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:text-[0.8125rem]"
    >
      <code>
        {diff.map((line, index) =>
          line.kind === "skipped" ? (
            <span
              key={index}
              className="block px-3 text-muted-foreground italic"
            >
              {t.caddyfile.skipped(line.count)}
            </span>
          ) : (
            <span
              key={index}
              className={`block px-3 ${DIFF_CLASSES[line.kind]}`}
            >
              {DIFF_PREFIX[line.kind]} {line.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
