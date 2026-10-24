"use client";

import { useMemo, useState } from "react";
import type { SpeciesOption } from "../lib/types";

interface Props {
  species: SpeciesOption[];
  biomeNames: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function SpeciesPicker({ species, biomeNames, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [biome, setBiome] = useState("");

  const groups = useMemo(() => [...new Set(species.map((s) => s.group_name))].sort(), [species]);
  const biomes = useMemo(
    () => [...new Set(species.map((s) => s.primary_biome).filter((b): b is string => !!b))].sort(),
    [species],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return species.filter(
      (s) =>
        (!group || s.group_name === group) &&
        (!biome || s.primary_biome === biome) &&
        (!q || s.name_en.toLowerCase().includes(q) || (s.name_jp ?? "").includes(q)),
    );
  }, [species, query, group, biome]);

  const selectClass =
    "border border-border bg-bg px-3 py-2 font-mono text-xs uppercase outline-none focus:border-accent";

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="search species"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${selectClass} min-w-48 flex-1`}
        />
        <select value={group} onChange={(e) => setGroup(e.target.value)} className={selectClass}>
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select value={biome} onChange={(e) => setBiome(e.target.value)} className={selectClass}>
          <option value="">All biomes</option>
          {biomes.map((b) => (
            <option key={b} value={b}>
              {biomeNames[b] ?? b}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
        {filtered.length} / {species.length} species
      </p>

      <div className="grid max-h-[28rem] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => {
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`hard-hover border p-3 text-left ${
                active ? "border-accent bg-accent-dim/40" : "border-border bg-panel-2"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-display text-2xl tracking-wider">{s.name_en}</span>
                {s.spirit_line && (
                  <span className="border border-warn px-1 font-mono text-[10px] uppercase text-warn">
                    spirit
                  </span>
                )}
              </div>
              {s.name_jp && <div className="font-mono text-xs text-muted">{s.name_jp}</div>}
              <div className="mt-2 font-mono text-[11px] uppercase tracking-wide text-muted">
                {s.group_name}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-wide text-accent">
                {s.primary_biome ? (biomeNames[s.primary_biome] ?? s.primary_biome) : "biome unknown"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
