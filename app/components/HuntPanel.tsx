"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHuntStatus, fetchPreyPreview, hunt } from "../lib/api";
import type { HuntResult, HuntStatus, PreyPreview } from "../lib/types";

interface Props {
  characterId: string;
  biomeId: string | null;
  biomeNames: Record<string, string>;
  onHunted: (result: HuntResult) => void; // lets the page resync magicules and skills
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function HuntPanel({ characterId, biomeId, biomeNames, onHunted }: Props) {
  const [state, setState] = useState<{ status: HuntStatus; receivedAt: number } | null>(null);
  const [prey, setPrey] = useState<PreyPreview[]>([]);
  const [log, setLog] = useState<HuntResult[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const status = await fetchHuntStatus(characterId);
      setState({ status, receivedAt: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [characterId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!biomeId) return;
    fetchPreyPreview(biomeId).then(setPrey).catch(() => undefined);
  }, [biomeId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const s = state?.status;
  const stamina = s
    ? Math.min(s.stamina_max, s.stamina + (s.regen_per_hour * Math.max(0, now - state.receivedAt)) / 3_600_000)
    : 0;
  const canHunt = !!s && stamina >= s.cost && !busy;

  async function doHunt() {
    setError(null);
    setBusy(true);
    try {
      const r = await hunt(characterId);
      setLog((l) => [r, ...l].slice(0, 8));
      setState({
        status: { ...(s as HuntStatus), stamina: r.stamina },
        receivedAt: Date.now(),
      });
      onHunted(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      load();
    } finally {
      setBusy(false);
    }
  }

  const biomeLabel = biomeId ? (biomeNames[biomeId] ?? biomeId) : "unknown";
  const shown = prey.slice(0, 18);

  return (
    <section className="bracket border border-border bg-panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-4xl tracking-widest text-accent">HUNT</h2>
        <span className="font-mono text-xs uppercase tracking-wider text-muted">biome: {biomeLabel}</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="border border-border bg-panel-2 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Stamina</p>
          <p className="font-display text-5xl tracking-wider">
            {s ? fmt(stamina) : "–"}
            <span className="ml-2 font-mono text-sm text-muted">/ {s ? s.stamina_max : "–"}</span>
          </p>
          <div className="mt-2 h-2 border border-border bg-bg">
            <div
              className="h-full bg-accent"
              style={{ width: `${s ? Math.min(100, (stamina / s.stamina_max) * 100) : 0}%` }}
            />
          </div>
        </div>
        <div className="border border-border bg-panel-2 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Devour</p>
          {s && s.devour.length > 0 ? (
            <ul className="mt-1 font-mono text-sm text-ok">
              {s.devour.map((d) => (
                <li key={d.skill}>
                  {d.skill} · {Math.round(d.chance * 100)}% to learn a skill
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted">
              No devour skill. You can still hunt for magicules, but you cannot learn skills from prey.
              Skills like Predator or Scavenger unlock devouring.
            </p>
          )}
        </div>
      </div>

      <button
        disabled={!canHunt}
        onClick={doHunt}
        className="hard-hover mt-5 w-full border border-accent bg-accent px-6 py-4 font-display text-3xl tracking-widest text-bg disabled:opacity-40"
      >
        {busy ? "HUNTING…" : s && stamina < s.cost ? "RESTING…" : "HUNT"}
      </button>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted">
        Costs {s ? s.cost : 1} stamina, regains {s ? s.regen_per_hour : "–"} per hour. Numbers are placeholders.
      </p>
      {error && <p className="mt-3 font-mono text-xs text-danger">{error}</p>}

      {log.length > 0 && (
        <ul className="mt-5 space-y-2">
          {log.map((r, i) => (
            <li
              key={`${r.synced_at}-${i}`}
              className={`border px-3 py-2 font-mono text-xs ${
                r.won ? "border-ok/60 text-ok" : "border-danger/60 text-danger"
              }`}
            >
              {r.won ? "WON" : "LOST"} vs {r.prey.name_en}
              <span className="text-muted"> (tier {r.prey.depth}, {Math.round(r.win_chance * 100)}% to win)</span>
              {r.won && <span> · +{fmt(r.reward)} magicules{r.devoured ? " (devoured)" : ""}</span>}
              {r.skill && (
                <div className="mt-1 text-warn">
                  NEW SKILL: {r.skill.name}
                  {r.skill.effect && <span className="text-muted"> — {r.skill.effect}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 font-display text-xl tracking-widest">LIVES HERE ({prey.length})</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {shown.map((p) => (
          <span key={p.id} className="border border-border bg-panel-2 px-2 py-1 font-mono text-[11px] text-muted">
            {p.name_en} <span className="text-accent">T{p.depth}</span>
          </span>
        ))}
        {prey.length > shown.length && (
          <span className="px-2 py-1 font-mono text-[11px] text-muted">+{prey.length - shown.length} more</span>
        )}
      </div>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted">
        Tier = how far the creature sits in its evolution line. You meet prey up to two tiers above you.
      </p>
    </section>
  );
}
