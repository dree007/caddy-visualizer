"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
  useTransition,
} from "react";

import { DEFAULT_DESIGN, type Design, isDesign } from "@/design";
import { setDesignAction } from "@/server/design-actions";

/**
 * Applies a design right away (no wait for the server round trip, so nothing
 * flickers) and then persists it. The server renders the same attribute from
 * the cookie on the next request.
 */
export function switchDesign(
  next: unknown,
  root: { dataset: Record<string, string | undefined> },
  persist: (design: Design) => void,
): Design | null {
  if (!isDesign(next)) return null;
  root.dataset.design = next;
  persist(next);
  return next;
}

type DesignContextValue = {
  design: Design;
  setDesign: (next: string) => void;
};

const DesignContext = createContext<DesignContextValue>({
  design: DEFAULT_DESIGN,
  setDesign: () => {},
});

export function DesignProvider({
  design,
  children,
}: {
  design: Design;
  children: ReactNode;
}) {
  // Until the server has re-rendered with the new cookie, the pick wins.
  const [picked, setPicked] = useState<Design | null>(null);
  const [, startTransition] = useTransition();

  const setDesign = useCallback((next: string) => {
    const applied = switchDesign(next, document.documentElement, (value) =>
      startTransition(() => setDesignAction(value)),
    );
    if (applied) setPicked(applied);
  }, []);

  return (
    <DesignContext.Provider value={{ design: picked ?? design, setDesign }}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign(): DesignContextValue {
  return useContext(DesignContext);
}
