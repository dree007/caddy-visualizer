"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

/** The route being typed into the inline row; client state only, never stored. */
export interface RouteDraft {
  hostname: string;
  upstream: string;
  tls: string;
}

export const EMPTY_DRAFT: RouteDraft = {
  hostname: "",
  upstream: "",
  tls: "automatic",
};

interface DraftContextValue {
  draft: RouteDraft;
  setDraft: (draft: RouteDraft) => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

/**
 * Connects the inline "new route" row with the "Vorgemerkt" panel on the
 * other side of the page: both are Client Components below one provider, the
 * rest of the page stays on the server.
 */
export function RouteDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<RouteDraft>(EMPTY_DRAFT);
  const value = useMemo(() => ({ draft, setDraft }), [draft]);
  return <DraftContext value={value}>{children}</DraftContext>;
}

export function useRouteDraft(): DraftContextValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useRouteDraft needs a RouteDraftProvider");
  return value;
}
