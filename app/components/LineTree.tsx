import type { LineSpecies } from "../lib/types";

interface Props {
  line: LineSpecies[];
  currentId: string;
}

// whole evolution line of the character, indented by depth; the path to the current form is highlighted
export default function LineTree({ line, currentId }: Props) {
  const byId = new Map(line.map((s) => [s.id, s]));
  const children = new Map<string, LineSpecies[]>();
  const roots: LineSpecies[] = [];
  for (const s of line) {
    if (s.parent_id && byId.has(s.parent_id)) {
      children.set(s.parent_id, [...(children.get(s.parent_id) ?? []), s]);
    } else {
      roots.push(s);
    }
  }
  const onPath = new Set<string>();
  for (let cur = byId.get(currentId); cur; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) {
    onPath.add(cur.id);
  }

  const render = (s: LineSpecies, level: number): React.ReactNode => (
    <li key={s.id}>
      <div
        style={{ marginLeft: level * 20 }}
        className={`my-1 flex items-center gap-2 border px-3 py-1 font-mono text-xs ${
          s.id === currentId
            ? "border-accent bg-accent-dim/50 text-white"
            : onPath.has(s.id)
              ? "border-accent/60 text-accent"
              : "border-border text-muted"
        }`}
      >
        <span className="font-display text-lg tracking-wider">{s.name_en}</span>
        {s.name_jp && <span className="text-[11px]">{s.name_jp}</span>}
        {s.id === currentId && (
          <span className="ml-auto border border-accent px-1 text-[10px] uppercase text-accent">you are here</span>
        )}
      </div>
      {(children.get(s.id) ?? []).length > 0 && (
        <ul>{children.get(s.id)!.map((c) => render(c, level + 1))}</ul>
      )}
    </li>
  );

  return (
    <section className="border border-border bg-panel p-6">
      <h2 className="font-display text-3xl tracking-widest">EVOLUTION LINE</h2>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {line.length} forms · the branch you are on is highlighted
      </p>
      <ul className="mt-3 max-h-96 overflow-y-auto pr-1">{roots.map((r) => render(r, 0))}</ul>
    </section>
  );
}
