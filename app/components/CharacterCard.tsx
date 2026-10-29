import type { CharacterDetail } from "../lib/types";

interface Props {
  detail: CharacterDetail;
  biomeNames: Record<string, string>;
}

const confidenceColor = { High: "text-ok", Medium: "text-warn", Low: "text-danger" } as const;

export default function CharacterCard({ detail, biomeNames }: Props) {
  const { character: c, skills } = detail;
  const sp = c.species;
  const biomeLabel = (id: string | null) => (id ? (biomeNames[id] ?? id) : null);
  const bonus = skills.length > 1;

  return (
    <section className="bracket border border-border bg-panel p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        {c.start_mode === "random" ? "Random roll" : "Chosen start"} · {c.name}
      </p>
      <h2 className="mt-1 font-display text-6xl tracking-widest text-accent">{sp.name_en}</h2>
      {sp.name_jp && <p className="font-mono text-sm text-muted">{sp.name_jp}</p>}
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">{sp.group_name}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="border border-border bg-panel-2 p-4">
          <h3 className="font-display text-xl tracking-widest">START BIOME</h3>
          <p className="mt-1 font-mono text-sm text-accent">
            {biomeLabel(c.biome_id) ?? "Unknown"}
            {sp.secondary_biome && (
              <span className="text-muted"> / {biomeLabel(sp.secondary_biome)}</span>
            )}
          </p>
          {sp.biome_confidence && (
            <p className={`mt-1 font-mono text-[11px] uppercase ${confidenceColor[sp.biome_confidence]}`}>
              wiki confidence: {sp.biome_confidence}
            </p>
          )}
        </div>

        <div className="border border-border bg-panel-2 p-4">
          <h3 className="font-display text-xl tracking-widest">BODY</h3>
          {c.has_body ? (
            <p className="mt-1 font-mono text-sm text-ok">Material body</p>
          ) : (
            <>
              <p className="mt-1 font-mono text-sm text-warn">BODYLESS · {sp.spirit_line}</p>
              <p className="mt-1 text-xs text-muted">
                Spirit lines start in their own area and need a material body to stay in the
                material world for long.
              </p>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 font-mono text-xs uppercase tracking-wider text-muted">
        {skills.length} skill{skills.length === 1 ? "" : "s"} owned{bonus ? " · bonus Unique roll!" : ""}
      </p>
    </section>
  );
}
