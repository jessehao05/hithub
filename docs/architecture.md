# Architecture

The handoff document: how HitHub fits together, how to run and change it, and what is unfinished. For the reasoning behind individual decisions in more depth, see [plan.md](./plan.md). For the product idea, see [overview.md](./overview.md).

## What it is

A GitHub-style contribution heatmap for tennis. One hour of tennis is one "contribution". Sessions are logged as rows in a Notion database; the site reads them and renders a year grid, a year selector, and a "Tennis activity" section listing a month's or a day's sessions.

It is a single-user, read-only site. There are no accounts, no database of its own, and no way to write data through the app.

## Stack

| Piece | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS 4, plus CSS custom properties in `src/app/globals.css` |
| Data | Notion API via `@notionhq/client` v5 |
| Hosting | Vercel (target) |

> **This Next.js version differs from older ones.** APIs and conventions have changed — see [AGENTS.md](../AGENTS.md). Check `node_modules/next/dist/docs/` before relying on memory of Next.js. In particular, `unstable_cache` is replaced by `'use cache'`, which requires `cacheComponents: true`.

## Request flow

There is no separate frontend and backend. Every component is a **server component**: it runs on the server, and the browser receives rendered HTML. Nothing on the client holds data or calls Notion.

```
Browser                   Next.js server                                        Notion
───────                   ──────────────                                        ──────
GET /?year=&day=   ──>    src/app/page.tsx
                            │ getActivities()             src/data/activities.ts
                            │   ├─ fetchActivities() ─────────────────────────>  data source query
                            │   │   rows → Activity[]     src/data/notion.ts    <── rows, paginated
                            │   └─ read view cookie; strip partners/location if locked
                            │
                            │ aggregate the array         src/lib/activities.ts, src/lib/heatmap.ts
                            │ render                      src/components/*
HTML  <─────────────────────┘
```

- **Every page load is a full Notion fetch.** Nothing is cached between requests, so a Notion edit appears on the next refresh.
- **All page state is in the URL** (`?year=2025&day=2025-06-22`). Clicking a square or a year is a `<Link>` navigation, which is a new server render and a new Notion fetch.
- **Entering data happens entirely in Notion.** The integration is read-only, and the app never writes.

### Unlock flow

```
POST /unlock (password) ──> unlock()  src/app/unlock/actions.ts
                              ├─ sha256("hithub-view:" + input) vs. same hash of VIEW_PASSWORD
                              └─ Set-Cookie hithub_view=<hash hex>; httpOnly; 1 year; redirect /
GET / (with cookie)     ──> getActivities() keeps partners and location
```

## Code map

Each layer only knows the one below it. Swapping Notion for another source would touch `src/data/notion.ts` only.

| Path | Layer | Role |
|---|---|---|
| `src/app/page.tsx` | Page | Home: range total, heatmap, year selector, tennis activity. Calls `getActivities()` once and passes the array down. |
| `src/app/unlock/page.tsx`, `actions.ts` | Page | Password form and the Server Action that sets the view cookie. Not linked from anywhere. |
| `src/app/layout.tsx`, `globals.css`, `icon.png` | Page | Root layout, theme tokens, favicon. |
| `src/components/heatmap.tsx` | UI | The week-column grid and its legend. Each day is a `<Link>`. |
| `src/components/year-selector.tsx` | UI | GitHub's right-hand year rail. |
| `src/components/tennis-activity.tsx` | UI | One component for both states (month summary, day with sessions). |
| `src/data/activities.ts` | Access | `getActivities()`, **the only way pages read data**. Applies restricted mode. `server-only`. |
| `src/data/notion.ts` | Source | The only module that talks to Notion. Fetches every row and maps it to an `Activity`. `server-only`. |
| `src/lib/activities.ts` | Logic | The `Activity` type and aggregations (`minutesByDate`, `rangeSummary`, `sessionsInRange`, `firstActivityYear`). Pure. |
| `src/lib/heatmap.ts` | Logic | Grid math, color buckets, `TIMEZONE`, `today()`, date formatting. Pure. |
| `src/lib/links.ts` | Logic | `homeHref()`, the one builder for home-page URLs. |
| `docs/` | Docs | This file, [plan.md](./plan.md), [overview.md](./overview.md), [notion-db.md](./notion-db.md). |
| `images/` | Reference | GitHub screenshots the design copies. Not served. |

## Data model

The Notion database `tennis_activities` is the source of truth. Its schema is in [notion-db.md](./notion-db.md). Each row becomes one `Activity`:

| Notion property | Type | `Activity` field | If empty |
|---|---|---|---|
| Name | title | `title` | `'Untitled'` |
| Date | date | `playedOn` (`'YYYY-MM-DD'`) | row skipped, warning logged |
| Minutes | number | `durationMinutes` | row skipped, warning logged |
| Partners | multi-select | `partners` (sorted) | `[]` |
| Location | select | `location` | `null` |
| YT | url | `videoUrl` | `null` |
| Notes | text | — | not read |

- **Property names are hardcoded** in `toActivity()`. Renaming or retyping one in Notion makes every request throw `Notion property "X" is missing or not a Y`. That's deliberate, so the page fails loudly instead of rendering empty. Update `src/data/notion.ts` alongside any schema change in Notion.
- **"Contributions" are computed at read time** (`durationMinutes / 60`). Never store a derived count.
- **Rows come back in creation order.** `sessionsInRange` relies on a stable sort to keep same-day sessions in the order they were logged.

## Key decisions

Each has a fuller explanation in [plan.md](./plan.md).

**Data**
- **Notion is the only input.** An earlier version used Postgres (Neon) + Drizzle, a seed script, and a `/new` form. All were removed: two input paths meant two sources of truth, and a public form would accept writes from anyone.
- **Fetch everything, aggregate in memory.** Notion can't do `GROUP BY`/`SUM`. At a few hundred rows, one paginated fetch plus plain array functions is simpler and faster than several filtered queries. Server-side Notion filters only become worth it at thousands of rows.
- **Partners and Location are select options, not free text.** This keeps "who/where did I play most" groupable, and renaming an option renames it everywhere.

**Dates and time**
- **Dates are `'YYYY-MM-DD'` strings end to end.** They never pass through `new Date()` for storage or comparison, so no timezone conversion can move a session to the wrong square. String comparison is a valid date comparison. Keep "Include time" off on the Notion Date property.
- **One app timezone,** `TIMEZONE = 'America/Chicago'` in `src/lib/heatmap.ts`. `today()` converts through `Intl.DateTimeFormat`, never the server clock, which is UTC on Vercel.

**Rendering**
- **Pages render per request** (`await connection()`), so neither data nor `today` freezes at build time.
- **State lives in the URL.** This keeps every component a server component and makes selected days shareable. Every link goes through `homeHref()` so a click inside 2025 keeps `year=2025`.
- **Dark is the default theme.** Light applies only under `prefers-color-scheme: light`. Never use Tailwind `dark:` utilities, because a visitor with no preference would get mixed themes. Colors come from the `--*` tokens in `globals.css`.
- **Heatmap buckets** are fixed hour thresholds (`LEVEL_THRESHOLD_HOURS`), not GitHub's relative quartiles, so the grid is comparable across years.

## Restricted mode

Visitors see title, date, duration, and YouTube link by default. Partners and location are available only to viewers who have unlocked with `VIEW_PASSWORD`.

- **Filtering happens on the server**, in `getActivities()`, before anything renders. A field hidden with CSS or client JavaScript would still be in the page payload.
- **The public fields are an allowlist** (`toPublic()`). A new `Activity` field stays private until it is added there.
- **Location is never rendered**, even when unlocked. Its visibility is an open decision for when location stats are built.
- **The cookie holds a hash of the password**, compared in constant time. Changing `VIEW_PASSWORD` signs everyone out. If `VIEW_PASSWORD` is unset, nobody can unlock.
- **Both `src/data/` modules import `server-only`.** Importing either into a client component is a build error.

**Rules for anyone extending this:**
1. Read activities only through `getActivities()`, never `fetchActivities()` directly from a page.
2. Anything passed as props to a `'use client'` component is serialized into the page. Only pass data that has already been filtered.
3. If you add caching, cache `fetchActivities()` (raw, server-side) only. Never cache `getActivities()` or a rendered page, or the unlocked view can be served to locked visitors.

## Running it

**Prerequisites:** Node 24, npm, a Notion integration with read access connected to the database (database `•••` → Connections).

**`.env.local`** (gitignored; set the same on Vercel):

```
NOTION_TOKEN="ntn_..."        # the integration's secret
NOTION_DATA_SOURCE_ID="..."   # database → ••• → Manage data sources → copy ID (NOT the database ID from the URL)
VIEW_PASSWORD="..."           # unlocks partners at /unlock; unset disables unlocking
```

**Commands:**

```bash
npm run dev     # http://localhost:3000
npm run build   # production build + typecheck
npm run lint
```

**To check restricted mode:** open `/` in a private window to see the locked view. Unlock at `/unlock`. To lock again, delete the `hithub_view` cookie.

## Troubleshooting

| Symptom | Cause |
|---|---|
| 500, `Could not find data_source with ID` | The integration isn't connected to the database, or `NOTION_DATA_SOURCE_ID` is the database ID rather than the data source ID. |
| 500, `Notion property "X" is missing or not a Y` | A property was renamed or retyped in Notion. Rename it back, or update `toActivity()`. |
| A session is missing from the grid | Its Date or Minutes is empty; check the server log for `Skipping Notion row`. |
| A session is on the wrong day | Its Date has a time attached. Turn "Include time" off. |
| Correct password but still locked | `VIEW_PASSWORD` changed or the server wasn't restarted after editing `.env.local`. |

## Known gaps and risks

- **No caching.** Each page view and each click is a full Notion fetch, typically a few hundred milliseconds per 100 rows. Notion allows about 3 requests per second; the client retries rate-limited requests. To add caching, see the rules under [Restricted mode](#restricted-mode) and the `'use cache'` docs in `node_modules/next/dist/docs/`.
- **No error UI.** If Notion is down or misconfigured, visitors get Next's default error page. There is no `error.tsx`.
- **No tests and no verified dataset.** The Postgres version was checked against a hand-computed seed; the Notion version has not been. The aggregations in `src/lib/` are pure and easy to unit test.
- **Unlocking is basic.** One shared password, no rate limit on `/unlock`, no lock/logout button. Use a long passphrase. If per-person access is ever needed, move to email magic links; `getActivities()` stays the same.
- **Leftover boilerplate.** `README.md` is the `create-next-app` default, and `metadata.description` in `layout.tsx` still says "Generated by create next app".
- **Notes is not read.** [overview.md](./overview.md) wants quick notes on a day's sessions. Add it to `Activity` and decide whether it belongs in `toPublic()`.
- **Partner initials.** [notion-db.md](./notion-db.md) once considered initials for public display. Several collide (MK, PS, SK), so use full names in Notion and derive initials at render time if needed.

## What's next

From the build order in [plan.md](./plan.md#build-order):

1. **Stats page:** most-played partners and locations, totals. It's a pure function over `getActivities()`. Decide whether location stats need the unlocked view.
2. **Activity history page:** every session in a chosen timeframe, reusing `TennisActivity` over a wider range.
3. Deferred: Strava / Google Calendar import, export, social features.
