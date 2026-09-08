import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Site } from "./queries";

const STORAGE_KEY = "gtac.selected-site";

type SelectedSiteValue = {
  sites: Site[];
  selectedSite: Site | null;
  selectSite: (siteId: string) => void;
};

const SelectedSiteContext = createContext<SelectedSiteValue | null>(null);

export function SelectedSiteProvider({
  sites,
  children,
}: {
  sites: Site[];
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSelectedId(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  // El sitio guardado se valida siempre contra los sitios permitidos del usuario.
  const selectedSite = useMemo(() => {
    if (sites.length === 0) return null;
    return sites.find((s) => s.id === selectedId) ?? sites[0] ?? null;
  }, [sites, selectedId]);

  const value = useMemo<SelectedSiteValue>(
    () => ({
      sites,
      selectedSite,
      selectSite: (siteId: string) => {
        if (!sites.some((s) => s.id === siteId)) return;
        setSelectedId(siteId);
        if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, siteId);
      },
    }),
    [sites, selectedSite],
  );

  return <SelectedSiteContext.Provider value={value}>{children}</SelectedSiteContext.Provider>;
}

export function useSelectedSite(): SelectedSiteValue {
  const ctx = useContext(SelectedSiteContext);
  if (!ctx) throw new Error("useSelectedSite debe usarse dentro de SelectedSiteProvider");
  return ctx;
}
