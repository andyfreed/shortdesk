"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Section = "real" | "sandbox";

const KEY = "shortdesk.section";

const Ctx = createContext<{
  section: Section;
  setSection: (s: Section) => void;
}>({ section: "sandbox", setSection: () => {} });

export function SectionProvider({ children }: { children: ReactNode }) {
  // Default to Sandbox (no real money) for safety; persisted once chosen.
  const [section, setS] = useState<Section>(() =>
    typeof window !== "undefined" && localStorage.getItem(KEY) === "real"
      ? "real"
      : "sandbox",
  );
  function setSection(s: Section) {
    setS(s);
    localStorage.setItem(KEY, s);
  }
  return <Ctx.Provider value={{ section, setSection }}>{children}</Ctx.Provider>;
}

export function useSection() {
  return useContext(Ctx);
}
