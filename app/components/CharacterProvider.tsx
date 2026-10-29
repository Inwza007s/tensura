"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBiomes, fetchCharacter, fetchStats } from "../lib/api";
import { CharacterContext } from "../lib/CharacterContext";
import type { Biome, CharacterDetail, StatSheet } from "../lib/types";
import { useSession } from "../lib/useSession";
import AuthGate from "./AuthGate";

// Loads the character once for every section (status / hunt / evolve / skills) and shares it.
export default function CharacterProvider({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { session, loading } = useSession();
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [stats, setStats] = useState<StatSheet | null>(null);
  const [biomes, setBiomes] = useState<Biome[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([fetchCharacter(id), fetchStats(id)]);
      setDetail(d);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchBiomes()
      .then((b) => !cancelled && setBiomes(b))
      .catch(() => undefined);
    Promise.all([fetchCharacter(id), fetchStats(id)])
      .then(([d, s]) => {
        if (cancelled) return;
        setDetail(d);
        setStats(s);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [session, id]);

  const biomeNames = useMemo(
    () => Object.fromEntries(biomes.map((b) => [b.id, b.name])) as Record<string, string>,
    [biomes],
  );

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  const value = useMemo(
    () => (detail ? { id, detail, stats, biomeNames, biomes, refreshKey, reload, setStats, bump } : null),
    [id, detail, stats, biomeNames, biomes, refreshKey, reload, bump],
  );

  if (loading) return <p className="font-mono text-sm text-muted">LOADING…</p>;
  if (!session) return <AuthGate />;
  if (error) return <p className="font-mono text-xs text-danger">{error}</p>;
  if (!value) return <p className="font-mono text-sm text-muted">LOADING…</p>;
  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}
