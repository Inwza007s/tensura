"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGate from "./components/AuthGate";
import CharacterCard from "./components/CharacterCard";
import SpeciesPicker from "./components/SpeciesPicker";
import {
  createCharacter,
  fetchBiomes,
  fetchCharacter,
  fetchMyCharacters,
  fetchSelectableSpecies,
} from "./lib/api";
import type { Biome, CharacterDetail, CharacterListItem, SpeciesOption } from "./lib/types";
import { useSession } from "./lib/useSession";

type Mode = "random" | "choose";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const { session, loading } = useSession();
  const [mode, setMode] = useState<Mode>("random");
  const [name, setName] = useState("Rimuru");
  const [biomes, setBiomes] = useState<Biome[]>([]);
  const [species, setSpecies] = useState<SpeciesOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mine, setMine] = useState<CharacterListItem[]>([]);
  const [result, setResult] = useState<CharacterDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const biomeNames = useMemo(
    () => Object.fromEntries(biomes.map((b) => [b.id, b.name])) as Record<string, string>,
    [biomes],
  );

  const refreshMine = useCallback(async () => {
    try {
      setMine(await fetchMyCharacters());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const [b, s] = await Promise.all([fetchBiomes(), fetchSelectableSpecies()]);
        setBiomes(b);
        setSpecies(s);
        await refreshMine();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [session, refreshMine]);

  async function start() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter a character name.");
    if (mode === "choose" && !selectedId) return setError("Pick a species first.");
    setBusy(true);
    try {
      const [id] = await Promise.all([
        createCharacter(trimmed, mode === "choose" ? selectedId : null),
        mode === "random" ? sleep(700) : Promise.resolve(), // a short beat for the roll
      ]);
      setResult(await fetchCharacter(id));
      await refreshMine();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openCharacter(id: string) {
    setError(null);
    try {
      setResult(await fetchCharacter(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return <p className="font-mono text-sm text-muted">LOADING…</p>;
  }
  if (!session) {
    return <AuthGate />;
  }

  const tab = (m: Mode, label: string) => (
    <button
      onClick={() => setMode(m)}
      className={`hard-hover flex-1 border px-4 py-3 font-display text-2xl tracking-widest ${
        mode === m ? "border-accent bg-accent text-bg" : "border-border bg-panel-2 text-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-10">
      {result ? (
        <>
          <CharacterCard detail={result} biomeNames={biomeNames} />
          <button
            onClick={() => setResult(null)}
            className="hard-hover border border-border bg-panel-2 px-6 py-3 font-display text-2xl tracking-widest"
          >
            ← NEW CHARACTER
          </button>
        </>
      ) : (
        <section className="bracket border border-border bg-panel p-6">
          <h1 className="font-display text-5xl tracking-widest text-accent">REINCARNATION</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
            Pick how you are reborn. You always get one Unique skill; a second one is very rare
            (1% on a random roll, 0.1% when you choose your species).
          </p>

          <div className="mt-6 flex gap-3">
            {tab("random", "RANDOM ROLL")}
            {tab("choose", "CHOOSE SPECIES")}
          </div>

          <label className="mt-6 block font-mono text-xs uppercase tracking-wider text-muted">
            Character name
            <input
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-border bg-bg px-3 py-2 font-mono text-sm normal-case text-white outline-none focus:border-accent"
            />
          </label>

          {mode === "choose" && (
            <div className="mt-6">
              <SpeciesPicker
                species={species}
                biomeNames={biomeNames}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          )}

          {error && <p className="mt-4 font-mono text-xs text-danger">{error}</p>}

          <button
            disabled={busy || (mode === "choose" && !selectedId)}
            onClick={start}
            className="hard-hover mt-6 w-full border border-accent bg-accent px-6 py-4 font-display text-3xl tracking-widest text-bg disabled:opacity-40"
          >
            {busy ? "ROLLING…" : mode === "random" ? "ROLL MY FATE" : "BE REBORN AS THIS"}
          </button>
        </section>
      )}

      {mine.length > 0 && (
        <section>
          <h2 className="font-display text-3xl tracking-widest">YOUR CHARACTERS</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => openCharacter(c.id)}
                  className="hard-hover w-full border border-border bg-panel-2 p-3 text-left"
                >
                  <div className="font-display text-2xl tracking-wider">{c.name}</div>
                  <div className="font-mono text-xs uppercase text-accent">{c.species.name_en}</div>
                  <div className="font-mono text-[11px] text-muted">
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
