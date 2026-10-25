"use client";

import { useCallback, useEffect, useState } from "react";
import { evolveCharacter, fetchEvolutionOptions, tickCharacter } from "../lib/api";
import type { EvolutionOption, TickState } from "../lib/types";

interface Props {
  characterId: string;
  speciesId: string; // changes after an evolution -> reload options
  biomeNames: Record<string, string>;
  onEvolved: () => void;
  refreshKey?: number; // bump to re-sync magicules (e.g. after a hunt)
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function EvolutionPanel({ characterId, speciesId, biomeNames, onEvolved, refreshKey = 0 }: Props) {
  const [state, setState] = useState<{ tick: TickState; receivedAt: number } | null>(null);
  const [options, setOptions] = useState<EvolutionOption[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [tick, opts] = await Promise.all([tickCharacter(characterId), fetchEvolutionOptions(characterId)]);
      setState({ tick, receivedAt: Date.now() });
      setOptions(opts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [characterId]);

  useEffect(() => {
    load();
  }, [load, speciesId, refreshKey]);

  // smooth live counter between server syncs (the server stays the source of truth)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const magicules = state
    ? state.tick.magicules + (state.tick.rate_per_hour * Math.max(0, now - state.receivedAt)) / 3_600_000
    : 0;

  async function evolve(opt: EvolutionOption) {
    setError(null);
    setBusyId(opt.id);
    try {
      const tick = await evolveCharacter(characterId, opt.id);
      setState({ tick, receivedAt: Date.now() });
      onEvolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      load(); // resync numbers after a refusal
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="bracket border border-border bg-panel p-6">
      <h2 className="font-display text-4xl tracking-widest text-accent">EVOLUTION</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="border border-border bg-panel-2 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Magicules</p>
          <p className="font-display text-5xl tracking-wider text-accent">{fmt(magicules)}</p>
        </div>
        <div className="border border-border bg-panel-2 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Income</p>
          <p className="font-display text-5xl tracking-wider">
            {state ? fmt(state.tick.rate_per_hour) : "–"}
            <span className="ml-2 font-mono text-sm text-muted">/ hour</span>
          </p>
        </div>
      </div>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted">
        Magicules build up in real time, even while you are away. Costs and income are placeholder numbers.
      </p>

      {error && <p className="mt-4 font-mono text-xs text-danger">{error}</p>}

      <h3 className="mt-8 font-display text-2xl tracking-widest">NEXT FORMS</h3>
      {options.length === 0 ? (
        <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
          No further evolution listed for this form.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {options.map((o) => {
            const affordable = magicules >= o.cost;
            return (
              <article key={o.id} className="border border-border bg-panel-2 p-4">
                <div className="font-display text-3xl tracking-wider">{o.name_en}</div>
                {o.name_jp && <div className="font-mono text-xs text-muted">{o.name_jp}</div>}
                <div className="mt-2 font-mono text-[11px] uppercase text-muted">{o.group_name}</div>
                {o.primary_biome && (
                  <div className="font-mono text-[11px] uppercase text-accent">
                    biome: {biomeNames[o.primary_biome] ?? o.primary_biome}
                  </div>
                )}
                {o.evolution_condition && (
                  <p className="mt-2 text-xs text-muted">
                    Known condition: {o.evolution_condition}
                    {o.evolution_condition_source?.includes("VERIFY") && (
                      <span className="ml-1 text-warn">(unverified)</span>
                    )}
                  </p>
                )}
                <button
                  disabled={!affordable || busyId !== null}
                  onClick={() => evolve(o)}
                  className="hard-hover mt-3 w-full border border-accent bg-accent px-4 py-2 font-display text-xl tracking-widest text-bg disabled:opacity-40"
                >
                  {busyId === o.id ? "EVOLVING…" : `EVOLVE · ${fmt(o.cost)}`}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
