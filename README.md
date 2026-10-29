# Slime (Tensura) game

Next.js 16 · App Router · TypeScript · Tailwind v4 · Supabase (tables prefixed `slime_`).

## Routes (path → file → what it is)

| Path | File | Page |
|---|---|---|
| `/` | `app/page.tsx` | Save slots (3) + reincarnation: random roll or choose species |
| `/character/:id` | `app/character/[id]/page.tsx` | **Status**: species, biome, body, level, stats |
| `/character/:id/hunt` | `app/character/[id]/hunt/page.tsx` | **Hunt**: stamina, fight prey in your biome, devour for skills |
| `/character/:id/evolve` | `app/character/[id]/evolve/page.tsx` | **Evolve**: magicules, next forms, full evolution line |
| `/character/:id/skills` | `app/character/[id]/skills/page.tsx` | **Skills**: mine by tier + all 294 skills |

Layouts: `app/layout.tsx` (every page: theme, fonts, navbar) and `app/character/[id]/layout.tsx`
(every `/character/:id/*` page: loads the character once and shares it).

## Folders

- `app/components/` UI pieces (NavBar, AuthGate, SpeciesPicker, CharacterCard, StatsPanel, HuntPanel, EvolutionPanel, LineTree, SkillsView, ...)
- `app/lib/` Supabase client, API calls, types, session hook, character context

## Setup

1. `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Database: run the SQL files 001 → 006 (in `slime-db/`) in the Supabase SQL editor
3. `npm install` then `npm run dev`
