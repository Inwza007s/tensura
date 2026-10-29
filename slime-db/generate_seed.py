#!/usr/bin/env python3
"""Generate 002_slime_seed.sql from tensura_reference.xlsx and skills_parsed.json.
Usage: python generate_seed.py tensura_reference.xlsx skills_parsed.json 002_slime_seed.sql
"""
import json, re, sys
from openpyxl import load_workbook

XLSX, PARSED, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
wb = load_workbook(XLSX, data_only=True)
parsed = {x["title"]: x for x in json.load(open(PARSED, encoding="utf-8"))}

def q(v):
    if v is None or v == "":
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"
def arr(lst):
    lst = [x for x in lst if x]
    return "ARRAY[" + ",".join(q(x) for x in lst) + "]::text[]" if lst else "'{}'::text[]"
def rows(sheet, start=2):
    for r in wb[sheet].iter_rows(min_row=start, values_only=True):
        if r and r[0] not in (None, ""):
            yield r
def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
out = ["-- Generated seed for the Slime game. Run after 001_slime_schema.sql.", "begin;", ""]
def insert(table, cols, data, batch=100):
    for i in range(0, len(data), batch):
        out.append(f"insert into {table} ({', '.join(cols)}) values")
        out.append(",\n".join("  (" + ", ".join(r) + ")" for r in data[i:i + batch]) + ";")
    out.append("")

# ---- biomes
bslug = {}
data = []
for r in rows("Biomes"):
    if r[0] == "Total": continue
    bslug[r[0]] = slug(r[0]); data.append([q(slug(r[0])), q(r[0]), q(r[1] or "")])
insert("slime_biomes", ["id", "name", "description"], data)

# ---- species
sa = {r[0]: r for r in rows("Species_All") if str(r[0]).startswith("SP")}
sb = {r[0]: r for r in rows("Species_Biome")}
ef = {r[0]: r for r in rows("Evolution_Full")}
start_by_name = {}
for r in rows("Start_Species"):
    if r[0] and r[3]:
        start_by_name[r[0]] = dict(weight=r[4] or 0, selectable=bool(r[9]))
parent = {i: (r[8] or "") for i, r in sa.items()}
def root(i):
    seen = set()
    while parent.get(i):
        if i in seen: raise SystemExit(f"cycle in species tree at {i}")
        seen.add(i); i = parent[i]
    return i
SPIRIT = {"Angel", "Daemon", "Elemental", "Pixie", "Dryad"}
root_name = {i: sa[root(i)][3] for i in sa}
first_root_for = {}
for i, r in sa.items():
    if not parent[i] and r[3] not in first_root_for: first_root_for[r[3]] = i
data = []
for i, r in sa.items():
    status = ef[i][4]
    st = start_by_name.get(r[3]) if (not parent[i] and first_root_for.get(r[3]) == i) else None
    weight = st["weight"] if st else 0
    selectable = st["selectable"] if st else False
    spirit = root_name[i] if root_name[i] in SPIRIT else None
    b = sb[i]
    data.append([q(i), q(r[3]), q(r[4]), q(r[5]), q(r[6]), q(r[1]), q(r[2] or "Main"),
                 q(parent[i] or None), q(r[9] or 0), q(root(i)), q(status), repr(float(weight)),
                 q(selectable), q(spirit),
                 q(bslug.get(b[5])), q(bslug.get(b[6])), q(b[9]), q(b[8]), q(b[7]),
                 q(ef[i][12]), q(ef[i][13]), q(r[10])])
insert("slime_species", ["id", "name_en", "name_jp", "reading", "gloss", "group_name", "media", "parent_id", "depth",
                         "root_id", "start_status", "start_weight", "start_selectable", "spirit_line",
                         "primary_biome", "secondary_biome", "biome_confidence", "biome_basis", "biome_note",
                         "evolution_condition", "evolution_condition_source", "source"], data, 60)

# ---- cross links
insert("slime_species_cross_links", ["from_label", "to_label", "how", "confidence", "source"],
       [[q(r[0]), q(r[1]), q(r[2]), q(r[3]), q(r[4])] for r in rows("Cross_Links")])

# ---- skills
sd = list(rows("Skill_Database"))
sd = [r for r in sd if r[13]]
used = set(); ids = {}
for r in sd:
    s = slug(r[0]) or "skill"; base = s; n = 2
    while s in used: s = f"{base}_{n}"; n += 1
    used.add(s); ids[r[0]] = s
def tier_group(cat):
    for k in ("Ultimate", "Unique", "Extra", "Common"):
        if k in (cat or ""): return k.lower()
    return "other"
data = []; people = []; links = []
for r in sd:
    t = r[0]; p = parsed.get(t, {})
    tg = tier_group(r[2])
    pool = tg == "unique" and r[3] == "Main story" and r[4] != "Yes"
    data.append([q(ids[t]), q(t), q(t), q(tg), q(None if r[1] == "(no infobox)" else r[1]),
                 arr([c.strip() for c in (r[2] or "").split("/")]), q(r[3]), q(r[4] == "Yes"),
                 arr(p.get("alias", []) + p.get("alter", [])), q(r[12]), q(r[13]), q(r[14]), q(pool)])
    for kind, key in (("current", "user"), ("former", "fuser")):
        for person in p.get(key, []): people.append([q(ids[t]), q(person), q(kind)])
    for rel, key in (("evolves_from", "prev"), ("evolves_to", "next"), ("sub_skill", "subskills")):
        for name in p.get(key, []):
            links.append([q(ids[t]), q(rel), q(name), q(ids.get(name))])
insert("slime_skills", ["id", "name", "wiki_title", "tier_group", "tier_wiki", "wiki_categories", "scope",
                        "noncanon_page", "aliases", "effect", "wiki_url", "source", "in_unique_pool"], data, 50)
insert("slime_skill_links", ["skill_id", "relation", "related_name", "related_skill_id"], links, 200)
seen = set(); uniq = []
for p in people:
    k = tuple(p)
    if k not in seen: seen.add(k); uniq.append(p)
insert("slime_skill_users", ["skill_id", "person", "kind"], uniq, 200)

# ---- config
bs = [dict(item=r[0], rule=r[1], value=r[2], source=r[3]) for r in rows("Body_Swap")]
cfg = [("start.unique_skills_base", "1", "Unique skills every new character gets"),
       ("start.second_unique_chance.random", "0.01", "Chance of a 2nd Unique skill, random species (confirmed 1%)"),
       ("start.second_unique_chance.chosen", "0.001", "Chance of a 2nd Unique skill, player-chosen species (confirmed 0.1%)"),
       ("body.self_create_requires_max_stage", "true", "Spirit lines may build their own body only at max evolution stage"),
       ("body.swap.allowed", "true", "Bodies can be swapped"),
       ("body.swap.rules", json.dumps(bs, ensure_ascii=False), "Cost / cooldown notes from Body_Swap sheet (no canon numbers)")]
insert("slime_config", ["key", "value", "note"], [[q(k), q(v) + "::jsonb", q(n)] for k, v, n in cfg])

# ---- spirit rules / fuel / body methods
sr = list(rows("Spirit_Rules"))
home = {}
for r in sr:
    if r[0] in SPIRIT and r[1] and r[1] != "-" and r[0] not in home: home[r[0]] = r[1]
insert("slime_spirit_rules", ["line", "topic", "home_area", "without_body", "with_body", "difficulty", "source"],
       [[q(r[0]), q(r[2]), q(r[1]), q(r[3]), q(r[4]), q(r[5]), q(r[6])] for r in sr if r[0] and r[0] != "Line"])
LINES = {"Angel": (6, "Seraph", "Chain Angel -> Power -> Virtue -> Dominion -> Throne -> Cherub -> Seraph (order inferred)"),
         "Daemon": (6, "Devil lord (Divine devil also counts)", "Per your text a Devil lord or Divine devil can create a flesh body at once"),
         "Elemental": (5, "Elemental lord (flame / land / wind)", "Lesser -> Medium -> Greater -> Lord"),
         "Pixie": (1, "Chatty pixie", "Only evolution listed"),
         "Dryad": (0, "Has a tree body from birth", "Bound to its tree; needs a Dryas doll to leave the forest")}
insert("slime_spirit_lines", ["line", "home_area", "steps_to_max", "self_create_unlock_at", "note"],
       [[q(k), q(home.get(k)), q(v[0]), q(v[1]), q(v[2])] for k, v in LINES.items()])
fuel = []
for r in wb["Spirit_Fuel"].iter_rows(min_row=2, max_row=10, values_only=True):
    if not r[0]: continue
    unl = r[2] == "Unlimited"
    fuel.append([q(r[0]), q(r[1]), q(None if unl or r[2] in (None, "") else float(r[2])),
                 q(None if unl or r[3] in (None, "") else float(r[3])), q(unl), q(r[4]), q(r[5]), q(r[6])])
insert("slime_spirit_fuel", ["stage", "fuel", "days_min", "days_max", "unlimited", "mode", "fails_when", "source"], fuel)
bm = []
for r in wb["Body_Acquisition"].iter_rows(min_row=2, max_row=5, values_only=True):
    bm.append([q(int(r[0])), q(r[1]), q(r[2]), q(r[3]), q(r[4]), q(r[5]), q(r[6])])
insert("slime_body_methods", ["id", "method", "how", "stability", "examples", "limits", "source"], bm)
out += ["commit;", ""]
open(OUT, "w", encoding="utf-8").write("\n".join(out))
print("species", len(sa), "skills", len(sd), "links", len(links), "users", len(uniq), "pool",
      sum(1 for d in data if d[-1] == "true"))
