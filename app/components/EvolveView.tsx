"use client";

import { useEffect, useState } from "react";
import { fetchLine } from "../lib/api";
import { useCharacter } from "../lib/CharacterContext";
import type { LineSpecies } from "../lib/types";
import EvolutionPanel from "./EvolutionPanel";
import LineTree from "./LineTree";

export default function EvolveView() {
  const { id, detail, biomeNames, refreshKey, reload } = useCharacter();
  const sp = detail.character.species;
  const [line, setLine] = useState<LineSpecies[]>([]);

  useEffect(() => {
    fetchLine(sp.root_id ?? sp.id).then(setLine).catch(() => undefined);
  }, [sp.root_id, sp.id]);

  return (
    <div className="space-y-8">
      <p className="font-display text-3xl tracking-widest">
        {sp.name_en} <span className="font-mono text-sm text-muted">{sp.group_name}</span>
      </p>
      <EvolutionPanel
        characterId={id}
        speciesId={sp.id}
        biomeNames={biomeNames}
        onEvolved={() => reload()}
        refreshKey={refreshKey}
      />
      <LineTree line={line} currentId={sp.id} />
    </div>
  );
}
