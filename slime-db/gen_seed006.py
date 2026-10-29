#!/usr/bin/env python3
"""Generate 006_slime_stats_seed.sql: species base stats, skill game effects, species innate skills."""
import json, re, sys
sys.path.insert(0, "/mnt/user-data/outputs/tensura-wiki-research/scripts")
sys.path.insert(0, "/home/claude/gen")
import parse_skills as ps
import effects_rules as er
from collections import defaultdict
from openpyxl import load_workbook

XLSX, SKILLS_JSONL, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
wb = load_workbook(XLSX, data_only=True)

def q(v):
    if v is None or v == "": return "NULL"
    if isinstance(v, (int, float)): return repr(v)
    return "'" + str(v).replace("'", "''") + "'"
def rows(sheet):
    for r in wb[sheet].iter_rows(min_row=2, values_only=True):
        if r and r[0] not in (None, ""): yield r
def slug(s): return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

out = ["-- Generated: species stats, skill effects, species innate skills. Run after 005.", "begin;", ""]
def insert(table, cols, data, batch=150, tail=""):
    for i in range(0, len(data), batch):
        out.append(f"insert into {table} ({', '.join(cols)}) values")
        out.append(",\n".join("  (" + ", ".join(r) + ")" for r in data[i:i + batch]) + tail + ";")
    out.append("")

# ---------------- species base stats ----------------
PROFILE = {
    "Humanity": (1, 1, 1, 1, 1), "Demi-human / Sprite": (1, 1, 1, 1.2, 1.1),
    "Demi-human / Beastfolk": (1.3, 1.2, 1.3, 0.6, 0.8), "Spirit / Angel": (1, 0.9, 1.2, 1.5, 1.2),
    "Spirit / Daemon": (1.1, 1, 1, 1.5, 1.3), "Spirit / Elemental": (0.7, 0.8, 1.2, 1.7, 1.2),
    "Spirit / Fairy": (0.6, 0.7, 1.3, 1.6, 1.3), "Spirit / Misc": (1.2, 1.2, 1, 1.5, 1.3),
    "Monster / Majin": (1.3, 1.3, 0.9, 0.9, 1), "Monster / Magic beast": (1.2, 1, 1.3, 0.7, 0.8),
    "Monster / Dragon": (1.4, 1.4, 1, 1.3, 1.2), "Monster / Undead": (1, 1.2, 0.7, 0.9, 0.7),
    "Monster / Specter": (0.8, 0.8, 1.3, 1.2, 1.1), "Monster / Golem": (1.3, 1.7, 0.5, 0.4, 0.6),
    "Monster / Other": (1, 1, 1, 1, 1),
}
FALLBACK = {"Plant": (0.5, 1.5, 0.3, 1, 1.1), "Demi-human": (1.1, 1, 1.1, 0.9, 0.9),
            "Spirit": (1.1, 1, 1.1, 1.4, 1.2), "Monster": (1.2, 1.1, 1.1, 0.8, 0.8), "Undead": (1, 1.2, 0.7, 0.9, 0.7)}
BASE_TOTAL, GROWTH = 20.0, 1.6
data = []
for r in rows("Species_All"):
    if not str(r[0]).startswith("SP"): continue
    sid, group, depth = r[0], r[1], int(r[9] or 0)
    w = PROFILE.get(group) or FALLBACK.get(group.split(" / ")[0]) or (1, 1, 1, 1, 1)
    total = BASE_TOTAL * GROWTH ** depth
    vals = [max(1, round(total * x / sum(w))) for x in w]
    data.append([q(sid)] + [str(v) for v in vals])
insert("slime_species_stats", ["species_id", "str", "vit", "agi", "mag", "wil"], data, 100,
       " on conflict (species_id) do update set str = excluded.str, vit = excluded.vit, agi = excluded.agi, mag = excluded.mag, wil = excluded.wil")

# ---------------- skill effects ----------------
def tier_group(cat):
    for k in ("Ultimate", "Unique", "Extra", "Common"):
        if k in (cat or ""): return k.lower()
    return "other"
sd = [r for r in rows("Skill_Database") if r[13]]
ids = {}; used = set()
for r in sd:
    s = slug(r[0]) or "skill"; base = s; n = 2
    while s in used: s = f"{base}_{n}"; n += 1
    used.add(s); ids[r[0]] = s       # same slug rule as generate_seed.py
eff_rows = []; upd = []
for r in sd:
    effects, mode = er.classify(r[0], tier_group(r[2]), r[12])
    desc = er.describe(effects)
    upd.append((ids[r[0]], desc))
    for kind, stat, v in effects:
        eff_rows.append([q(ids[r[0]]), q(kind), q(stat), repr(float(v))])
out.append("delete from slime_skill_effects;")
insert("slime_skill_effects", ["skill_id", "kind", "stat", "value"], eff_rows, 300)
out.append("update slime_skills s set game_effect = v.d from (values")
out.append(",\n".join(f"  ({q(i)}, {q(d)})" for i, d in upd))
out.append(") as v(id, d) where s.id = v.id;")
out.append("")

# ---------------- species innate skills (evidence only) ----------------
sp = defaultdict(list)
for r in rows("Species_All"):
    if str(r[0]).startswith("SP") and r[2] == "Main": sp[re.sub(r"\s*\(.*\)$", "", r[3]).lower()].append(r[0])
tier = {r[0]: tier_group(r[2]) for r in sd}
links = {}   # (species_id, skill title) -> evidence
for l in open(SKILLS_JSONL, encoding="utf-8"):
    page = json.loads(l)
    if page.get("status") != "ok": continue
    ib = ps.infobox(page["wikitext"])
    if not ib: continue
    for f in ("race", "intrinsic"):
        for n in ps.names(ib.get(f, "")):
            for sid in sp.get(re.sub(r"\s*\(.*\)$", "", n).strip().lower(), []):
                links[(sid, page["title"])] = "Skill page infobox lists this species"
for f in ("species.jsonl", "retry.jsonl", "round3.jsonl"):
    for l in open("/mnt/user-data/uploads/" + f, encoding="utf-8"):
        page = json.loads(l)
        if page.get("status") != "ok": continue
        body = re.split(r"==\s*Navigation", page["wikitext"])[0]
        for m in re.findall(r"\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]", body):
            t = m.strip()
            if t in tier and tier[t] in ("common", "extra"):
                for sid in sp.get(re.sub(r"\s*\(.*\)$", "", page["title"]).lower(), []):
                    links.setdefault((sid, t), "Species wiki page mentions the skill")
data = [[q(sid), q(ids[t]), q(ev)] for (sid, t), ev in sorted(links.items()) if tier.get(t) in ("common", "extra")]
out.append("delete from slime_species_skills;")
insert("slime_species_skills", ["species_id", "skill_id", "evidence"], data, 200, " on conflict do nothing")
out.append("-- backfill: existing characters get the innate skills of their current species")
out.append("insert into slime_character_skills (character_id, skill_id, source) "
           "select c.id, ss.skill_id, 'species' from slime_characters c "
           "join slime_species_skills ss on ss.species_id = c.species_id on conflict do nothing;")
out += ["commit;", ""]
open(OUT, "w", encoding="utf-8").write("\n".join(out))
nsp = len({d[0] for d in data})
print("species stats", len(rows("Species_All") if False else []), "effects", len(eff_rows), "skills", len(upd), "species_skills", len(data), "species with skills", nsp)
