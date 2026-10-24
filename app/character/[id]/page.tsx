"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";
import CharacterCard from "../../components/CharacterCard";
import EvolutionPanel from "../../components/EvolutionPanel";
import LineTree from "../../components/LineTree";
import { fetchBiomes, fetchCharacter, fetchLine } from "../../lib/api";
import type { Biome, CharacterDetail, LineSpecies } from "../../lib/types";
import { useSession } from "../../lib/useSession";

export default function CharacterPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading } = useSession();
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [biomes, setBiomes] = useState<Biome[]>([]);
  const [line, setLine] = useState<LineSpecies[]>([]);
  const [error, setError] = useState<string | null>(null);

  const biomeNames = useMemo(
    () => Object.fromEntries(biomes.map((b) => [b.id, b.name])) as Record<string, string>,
    [biomes],
  );

  const reload = useCallback(async () => {
    try {
      const d = await fetchCharacter(id);
      setDetail(d);
      setLine(await fetchLine(d.character.species.root_id ?? d.character.species.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    if (!session) return;
    fetchBiomes().then(setBiomes).catch(() => undefined);
    reload();
  }, [session, reload]);

  if (loading) return <p className="font-mono text-sm text-muted">LOADING…</p>;
  if (!session) return <AuthGate />;

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="hard-hover inline-block border border-border bg-panel-2 px-4 py-2 font-display text-xl tracking-widest"
      >
        ← SAVE SLOTS
      </Link>
      {error && <p className="font-mono text-xs text-danger">{error}</p>}
      {detail && (
        <>
          <CharacterCard detail={detail} biomeNames={biomeNames} />
          <EvolutionPanel
            characterId={detail.character.id}
            speciesId={detail.character.species.id}
            biomeNames={biomeNames}
            onEvolved={reload}
          />
          <LineTree line={line} currentId={detail.character.species.id} />
        </>
      )}
    </div>
  );
}
