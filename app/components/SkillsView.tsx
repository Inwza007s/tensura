"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAllSkills } from "../lib/api";
import { useCharacter } from "../lib/CharacterContext";
import type { SkillInfo, TierGroup } from "../lib/types";

const TIERS: { key: TierGroup; label: string }[] = [
  { key: "ultimate", label: "Ultimate" },
  { key: "unique", label: "Unique" },
  { key: "extra", label: "Extra" },
  { key: "common", label: "Common" },
  { key: "other", label: "Other" },
];

const tierColor: Record<TierGroup, string> = {
  ultimate: "text-danger border-danger",
  unique: "text-warn border-warn",
  extra: "text-accent border-accent",
  common: "text-muted border-border",
  other: "text-muted border-border",
};

function sourceLabel(src: string) {
  if (src === "start") return "Start roll";
  if (src === "species") return "Species skill";
  if (src.startsWith("devour")) return "Devoured";
  return src;
}

function SkillCard({ skill, badge, owned }: { skill: SkillInfo; badge?: string; owned?: boolean }) {
  return (
    <article className={`border bg-panel-2 p-4 ${owned ? "border-accent/60" : "border-border"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-2xl tracking-wider">{skill.name}</span>
        <span className="flex gap-2 font-mono text-[10px] uppercase">
          {badge && <span className="border border-ok px-1 text-ok">{badge}</span>}
          <span className={`border px-1 ${tierColor[skill.tier_group]}`}>{skill.tier_group}</span>
        </span>
      </div>
      {skill.game_effect && (
        <p className="mt-2 font-mono text-xs text-accent">In game: {skill.game_effect}</p>
      )}
      {skill.effect && <p className="mt-1 text-sm text-muted">{skill.effect}</p>}
      {skill.wiki_url && (
        <a
          href={skill.wiki_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-mono text-[11px] uppercase tracking-wider text-accent underline"
        >
          wiki page ↗
        </a>
      )}
    </article>
  );
}

export default function SkillsView() {
  const { detail } = useCharacter();
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [all, setAll] = useState<SkillInfo[]>([]);
  const [tier, setTier] = useState<TierGroup | "">("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(60);

  useEffect(() => {
    if (tab === "all" && all.length === 0) fetchAllSkills().then(setAll).catch(() => undefined);
  }, [tab, all.length]);

  const owned = useMemo(() => new Map(detail.skills.map((s) => [s.skill.id, s])), [detail.skills]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((s) => (!tier || s.tier_group === tier) && (!q || s.name.toLowerCase().includes(q)));
  }, [all, tier, query]);

  const tabBtn = (key: "mine" | "all", label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`hard-hover flex-1 border px-4 py-3 font-display text-2xl tracking-widest ${
        tab === key ? "border-accent bg-accent text-bg" : "border-border bg-panel-2 text-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {tabBtn("mine", `MY SKILLS (${detail.skills.length})`)}
        {tabBtn("all", "ALL SKILLS")}
      </div>

      {tab === "mine" && (
        <>
          {TIERS.map((t) => {
            const list = detail.skills.filter((s) => s.skill.tier_group === t.key);
            if (list.length === 0) return null;
            return (
              <section key={t.key}>
                <h2 className={`font-display text-3xl tracking-widest ${tierColor[t.key].split(" ")[0]}`}>
                  {t.label.toUpperCase()} <span className="font-mono text-sm text-muted">{list.length}</span>
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {list.map((s) => (
                    <SkillCard key={s.skill.id} skill={s.skill} badge={sourceLabel(s.source)} owned />
                  ))}
                </div>
              </section>
            );
          })}
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Every skill works the moment you own it: its in-game effect is added to your stats and hunts
            automatically (effects are placeholder values).
          </p>
        </>
      )}

      {tab === "all" && (
        <>
          <div className="flex flex-wrap gap-3">
            <input
              placeholder="search skills"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(60);
              }}
              className="min-w-48 flex-1 border border-border bg-bg px-3 py-2 font-mono text-xs uppercase outline-none focus:border-accent"
            />
            <select
              value={tier}
              onChange={(e) => {
                setTier(e.target.value as TierGroup | "");
                setLimit(60);
              }}
              className="border border-border bg-bg px-3 py-2 font-mono text-xs uppercase outline-none focus:border-accent"
            >
              <option value="">All tiers</option>
              {TIERS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            {filtered.length} / {all.length} skills · the highlighted ones are yours
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.slice(0, limit).map((s) => (
              <SkillCard
                key={s.id}
                skill={s}
                owned={owned.has(s.id)}
                badge={owned.has(s.id) ? "owned" : undefined}
              />
            ))}
          </div>
          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 60)}
              className="hard-hover border border-border bg-panel-2 px-6 py-3 font-display text-xl tracking-widest"
            >
              SHOW MORE
            </button>
          )}
        </>
      )}
    </div>
  );
}
