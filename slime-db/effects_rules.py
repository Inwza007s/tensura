"""Rule-based game effects for every skill. Pure function of (title, tier_group, effect text)."""
import re

UNIT = {"common": 1.0, "extra": 2.0, "unique": 4.0, "ultimate": 8.0, "other": 1.0}
STATS = ["str", "vit", "agi", "mag", "wil"]

# archetype -> (regex, priority). Higher score wins; ties broken by priority order below.
ARCH = [
    ("str", r"strength|strengthen|berserk|frenzy|physical|slash|blade|sword|weapon|throw|martial|punch|impact|melee|muscle|force|momentum|claw|fang|bite|crush|armor fusion|overcomer"),
    ("vit", r"armor|barrier|defen[cs]e|durab|harden|tough|immovable|iron|shield|invulner|immun|scale|shell|body double|endure|survivor"),
    ("agi", r"speed|accelerat|motion|flight|fly|float|teleport|reaction|dodge|evad|agil|swift|travel|instant|shadow|footing|jump|vibration"),
    ("mag", r"magic|mana|magicule|spell|flame|fire|lightning|thunder|water|wind|earth|gravity|element|ice|light|dark|poison|sound|wave|weather|space|spatial|time|temporal|dimension|breath|cannon|aura|world|law"),
    ("wil", r"mind|thought|perception|sense|eye|intuition|haki|coercion|charm|dominat|hypno|will|soul|spirit|calculat|predict|analy|detect|memory|telepath|communicat|precogni|future|sight|vision|smell|hearing|appraisal|decipher|oath|faith"),
    ("regen", r"regenerat|heal|recover|resurrect|revive|rest"),
    ("income", r"magicule|energy|store|storage|breeder|reactor|creat|craft|manufactur|forge|produc|cook|synthes|transmut|build"),
    ("reward", r"devour|\beat|eaten|consum|absorb|steal|copy|imitat|loot|scaveng|gourmand|glutton|predat|feed|harvest|drain|plunder|greed|starved|gourmet"),
    ("xp", r"learn|record|research|investig|sage|study|decipher|knowledge|train|experience|evolv|growth|adapt|analy|appraisal|memory|wisdom|guide|support"),
    ("win", r"attack|battle|combat|fight|kill|defeat|damage|strike|assassin|sure-kill|domination|manipulat|control|paraly|curse|fear|intimidat|overwhelm|pressure|sniper|tyrant|hero|commander|leader|supporter|boost"),
]
PRIORITY = [a for a, _ in ARCH]

OVERRIDES = {  # hand-tuned notable skills: list of (kind, stat, value)
    "Great Sage": [("stat_flat", "wil", 6), ("xp_pct", None, 20), ("win_pct", None, 3)],
    "Raphael": [("stat_flat", "wil", 12), ("stat_flat", "mag", 8), ("xp_pct", None, 40), ("win_pct", None, 6)],
    "Predator": [("reward_pct", None, 25), ("stat_flat", "vit", 3), ("income_pct", None, 8)],
    "Gluttony": [("reward_pct", None, 40), ("stat_flat", "vit", 5), ("income_pct", None, 12)],
    "Beelzebuth": [("reward_pct", None, 60), ("stat_flat", "vit", 8), ("stat_flat", "mag", 8), ("income_pct", None, 20)],
    "Azathoth": [("reward_pct", None, 60), ("xp_pct", None, 40), ("stat_flat", "mag", 12), ("win_pct", None, 8)],
    "Scavenger": [("reward_pct", None, 15), ("income_pct", None, 5)],
    "Infinite Regeneration": [("stamina_regen_pct", None, 40), ("stat_flat", "vit", 5)],
    "Self-Regeneration": [("stamina_regen_pct", None, 12), ("stat_flat", "vit", 1)],
    "Ultraspeed Regeneration": [("stamina_regen_pct", None, 25), ("stat_flat", "vit", 3)],
    "Mana Manipulation": [("income_pct", None, 12), ("stat_flat", "mag", 3)],
    "Thought Acceleration": [("xp_pct", None, 10), ("stat_flat", "wil", 3), ("stat_flat", "agi", 2)],
    "Ultraspeed Thought": [("xp_pct", None, 18), ("stat_flat", "wil", 5), ("stat_flat", "agi", 3)],
    "Sage": [("xp_pct", None, 12), ("stat_flat", "wil", 3)],
    "Chosen One": [("win_pct", None, 5), ("xp_pct", None, 10)],
    "True Hero": [("win_pct", None, 8), ("xp_pct", None, 15), ("stat_flat", "str", 6)],
    "Berserker": [("stat_flat", "str", 5), ("stat_flat", "vit", 3)],
    "Chef": [("stamina_regen_pct", None, 15), ("reward_pct", None, 8)],
    "Researcher": [("xp_pct", None, 10), ("income_pct", None, 8)],
    "Creator": [("income_pct", None, 15), ("stat_flat", "mag", 4)],
    "Uriel": [("stat_flat", "vit", 12), ("stat_flat", "mag", 8), ("win_pct", None, 6)],
    "Lucifer": [("stat_flat", "wil", 10), ("stat_flat", "mag", 10), ("win_pct", None, 8)],
}


def classify(title, tier_group, effect):
    unit = UNIT.get(tier_group, 1.0)
    if title in OVERRIDES:
        return [(k, s, v) for k, s, v in OVERRIDES[title]], "override"
    text = f"{title} {effect or ''}".lower()
    scores = []
    for name, rx in ARCH:
        n = len(re.findall(rx, text))
        if n:
            scores.append((n, -PRIORITY.index(name), name))
    scores.sort(reverse=True)
    picks = [s[2] for s in scores[:3]]
    mult = [1.0, 0.6, 0.4]
    out = []
    if not picks:
        v = max(1, round(unit * 0.4))
        return [("stat_flat", s, v) for s in STATS], "fallback"
    for name, m in zip(picks, mult):
        if name in STATS:
            out.append(("stat_flat", name, max(1, round(unit * m))))
        elif name == "regen":
            out.append(("stamina_regen_pct", None, round(unit * 3 * m, 1)))
        elif name == "income":
            out.append(("income_pct", None, round(unit * 3 * m, 1)))
        elif name == "reward":
            out.append(("reward_pct", None, round(unit * 3 * m, 1)))
        elif name == "xp":
            out.append(("xp_pct", None, round(unit * 3 * m, 1)))
        elif name == "win":
            out.append(("win_pct", None, round(unit * 0.6 * m, 1)))
    return out, "rule"


LABEL = {"str": "STR", "vit": "VIT", "agi": "AGI", "mag": "MAG", "wil": "WIL"}


def describe(effects):
    parts = []
    for kind, stat, v in effects:
        v = int(v) if float(v).is_integer() else v
        if kind == "stat_flat":
            parts.append(f"+{v} {LABEL[stat]}")
        elif kind == "win_pct":
            parts.append(f"+{v}% win chance")
        elif kind == "reward_pct":
            parts.append(f"+{v}% hunt magicules")
        elif kind == "xp_pct":
            parts.append(f"+{v}% XP")
        elif kind == "income_pct":
            parts.append(f"+{v}% magicule income")
        elif kind == "stamina_regen_pct":
            parts.append(f"+{v}% stamina regen")
    return ", ".join(parts)
