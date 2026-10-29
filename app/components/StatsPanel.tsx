"use client";

import { useState } from "react";
import { allocateStat } from "../lib/api";
import type { StatKey, StatSheet } from "../lib/types";

interface Props {
  characterId: string;
  stats: StatSheet;
  onChange: (s: StatSheet) => void;
}

const STATS: { key: StatKey; label: string; hint: string }[] = [
  { key: "str", label: "STR", hint: "physical power" },
  { key: "vit", label: "VIT", hint: "toughness" },
  { key: "agi", label: "AGI", hint: "speed" },
  { key: "mag", label: "MAG", hint: "magic power" },
  { key: "wil", label: "WIL", hint: "mind and perception" },
];

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function StatsPanel({ characterId, stats, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(stat: StatKey, points: number) {
    setError(null);
    setBusy(true);
    try {
      onChange(await allocateStat(characterId, stat, points));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const pct = Math.min(100, (stats.exp / stats.exp_needed) * 100);
  const b = stats.bonus;
  const bonuses = [
    b.win_pct ? `+${fmt(b.win_pct)}% win chance` : null,
    b.reward_pct ? `+${fmt(b.reward_pct)}% hunt magicules` : null,
    b.xp_pct ? `+${fmt(b.xp_pct)}% XP` : null,
    b.income_pct ? `+${fmt(b.income_pct)}% magicule income` : null,
    b.stamina_regen_pct ? `+${fmt(b.stamina_regen_pct)}% stamina regen` : null,
  ].filter(Boolean);

  return (
    <section className="border border-border bg-panel p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl tracking-widest text-accent">LEVEL {stats.level}</h2>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            XP {fmt(stats.exp)} / {fmt(stats.exp_needed)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Power</p>
          <p className="font-display text-4xl tracking-wider">{fmt(stats.power)}</p>
        </div>
      </div>
      <div className="mt-2 h-2 border border-border bg-bg">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-4 font-mono text-xs uppercase tracking-wider">
        Free stat points:{" "}
        <span className={stats.stat_points > 0 ? "text-warn" : "text-muted"}>{stats.stat_points}</span>
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="text-left uppercase text-muted">
              <th className="border border-border px-3 py-2">Stat</th>
              <th className="border border-border px-3 py-2">Species</th>
              <th className="border border-border px-3 py-2">Level</th>
              <th className="border border-border px-3 py-2">Points</th>
              <th className="border border-border px-3 py-2">Skills</th>
              <th className="border border-border px-3 py-2 text-accent">Total</th>
              <th className="border border-border px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {STATS.map((s) => (
              <tr key={s.key}>
                <td className="border border-border px-3 py-2">
                  <span className="font-display text-xl tracking-wider">{s.label}</span>{" "}
                  <span className="text-[10px] text-muted">{s.hint}</span>
                </td>
                <td className="border border-border px-3 py-2">{fmt(stats.base[s.key])}</td>
                <td className="border border-border px-3 py-2">+{fmt(stats.auto)}</td>
                <td className="border border-border px-3 py-2">+{fmt(stats.alloc[s.key])}</td>
                <td className="border border-border px-3 py-2">+{fmt(stats.skill[s.key])}</td>
                <td className="border border-border px-3 py-2 text-accent">{fmt(stats.total[s.key])}</td>
                <td className="border border-border px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      disabled={busy || stats.stat_points < 1}
                      onClick={() => add(s.key, 1)}
                      className="hard-hover border border-accent px-2 py-1 text-accent disabled:opacity-30"
                    >
                      +1
                    </button>
                    <button
                      disabled={busy || stats.stat_points < 5}
                      onClick={() => add(s.key, 5)}
                      className="hard-hover border border-accent px-2 py-1 text-accent disabled:opacity-30"
                    >
                      +5
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="mt-3 font-mono text-xs text-danger">{error}</p>}
      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted">
        Power decides hunts: STR and MAG count most, then VIT, AGI, WIL. Species stats come from its group and
        evolution tier (placeholder values). Skill bonus: {bonuses.length ? bonuses.join(" · ") : "none yet"}.
      </p>
    </section>
  );
}
