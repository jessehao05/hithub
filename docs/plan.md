# Plan

Technical plan for the idea in [overview.md](./overview.md). Decisions here are settled unless noted.

## Decisions

- **Stack:** Next.js (App Router) + TypeScript + Postgres (Neon) + Drizzle + Tailwind, deployed on Vercel.
- **Locations are stored but not displayed.** Captured on every activity so the data accumulates from day one; no location UI on the homepage in v1. The analysis comes later.
- **One user.** A deployment shows a single user's data, set by `CURRENT_USERNAME`. No accounts, no login, no per-user URLs.
- **The app has one fixed timezone**, `America/Chicago`, set in one constant. Not the server clock, which is UTC on Vercel. See [gotcha 3](#3-today-needs-a-timezone-too).

### Why this stack

The centerpiece is a visual (the heatmap and the day detail panel), which is React's home turf, and Next.js keeps client and server in one deployable in one language. Neon and Vercel both have free tiers this app will never outgrow. Drizzle over Prisma because the queries are simple aggregations that read better in near-SQL.

## Scope

Feasibility is high — this is a small app. One table of activities and a calendar grid. Every stat in the overview is a single `GROUP BY` over a few hundred rows. No real-time, no scale concerns, no third-party integrations in v1.

**Deferred:** Strava / Google Calendar import, export, social features, mobile app. The overview already notes that importing still bottoms out in manual entry — so manual entry *is* the product, and import must not shape the v1 architecture.

## Schema

```
users(id, username UNIQUE, email, created_at)
partners(id, user_id, name)
locations(id, user_id, name)
activities(id, user_id, played_on DATE, duration_minutes INT, title, video_url, location_id NULL, created_at)
activity_partners(activity_id, partner_id)
```

`username` is how the app finds its one user (`CURRENT_USERNAME`), and is shown as the page heading. `duration_minutes` rather than hours so a 90-minute session isn't rounded into a lie — "contributions" is `duration_minutes / 60`, computed at read time. Never store a derived count.

`title` is the commit-message equivalent: a short one-line label for the session, replacing the "short description" from the original overview. It is **required** — commit messages are, and a session with no label is hard to scan in a list. Long-form notes are not a v1 field; if they're wanted later, add a nullable `body` alongside it, mirroring a commit's subject/body split.

`location_id` is nullable, and one location per activity — unlike partners, which is many-to-many. It is a `locations` table rather than a text column for exactly the reason partners is: `Centennial`, `centennial`, and `Centennial Park` would be three different courts to a `GROUP BY`, and "where have I played most" is the stat that breaks. Same failure, same fix.

**The column only pays off if the form collects it.** Storing location now is worth doing precisely because backfilling a year of "where was that session" from memory is impossible — but that only holds if the add-activity form has a location field from day one. A stored-but-never-populated column buys nothing. The homepage stays location-free; the *form* does not.

## Three things that will bite

Everything else in this app can be as simple as you like. These are worth getting right up front. The third was found while building step 3 — it is the first one wearing a different hat.

### 1. Dates, not timestamps

A timestamp is a *point in time*. A heatmap square is a *calendar day*. Converting between them requires a timezone, and that conversion can move the day.

Concrete failure: a 9:00 PM session on Aug 27 in Nashville (UTC−5) stored as a timestamp is `2026-08-28T02:00:00Z`. Any code reading the day back in UTC — a server component on Vercel, or `.toISOString().slice(0,10)` — puts it on **Aug 28**. Wrong square.

What makes it nasty is that it is *inconsistent*. Morning sessions land correctly; evening sessions slide forward one day. It isn't a uniform off-by-one you would spot immediately, it's a silent skew that starts attributing Friday evenings to Saturday and corrupts the day-of-week stats.

**Fix:** store the day as a `DATE`. No time component means nothing to convert.

```ts
playedOn: date('played_on', { mode: 'string' }).notNull(),  // '2026-08-27'
```

`mode: 'string'` matters. Postgres `DATE` values can come back through node drivers as a JS `Date` pinned to UTC midnight, which then renders as the *previous* day in any negative-offset timezone — reintroducing the same bug. Keeping it a `'2026-08-27'` string from database to DOM means no conversion happens anywhere.

If start times are wanted later, add a nullable `start_time TIME` that is display-only and never feeds the grid.

### 2. Partners as rows, not strings

The tempting version is a text column on the activity: `partners: "Alex, Sam"`. It works for three weeks and then degrades.

- **The key stat breaks.** "Who have I played the most with" becomes string splitting that assumes every name was typed identically. `Alex`, `alex`, `Alex Chen`, and `Alex ` are four different people to a `GROUP BY`. Over a year of logging, drift is guaranteed.
- **No autocomplete.** A table lets the form offer people already played before — which is what *prevents* the drift. The schema choice and the input UX are the same decision.
- **Renames rewrite history.** A name change becomes string surgery across every row.

**Fix:** a `partners` table plus a join table, since the relationship is many-to-many — one session has several partners, one partner appears in many sessions. The headline stat then becomes boring, which is the goal:

```sql
SELECT p.name, COUNT(*) AS sessions, SUM(a.duration_minutes)/60.0 AS hours
FROM activity_partners ap
JOIN partners p   ON p.id = ap.partner_id
JOIN activities a ON a.id = ap.activity_id
WHERE a.user_id = $1
GROUP BY p.name
ORDER BY hours DESC;
```

Partners are a personal roster — rows you own, not user accounts.

### 3. "Today" needs a timezone too

Storing `played_on` as a `DATE` removes timezones from the *stored history*. It does not answer "what day is it right now" — and that question is asked in two places: the last column of the grid, and the date the log form defaults to.

`new Date()` on the server uses the server's clock. Locally that is your machine; on Vercel it is UTC. At 9:30 PM Central on Aug 31:

| Zone | Sees the date as |
|---|---|
| America/Chicago | 2026-08-31 |
| America/New_York | 2026-08-31 |
| **UTC** | **2026-09-01** |

So deployed, every evening session would default to tomorrow, and the grid would open a new column about five hours early.

**Fix:** one `TIMEZONE` constant and a `today()` that converts through `Intl.DateTimeFormat` with that named zone. Nothing reads the ambient process clock for calendar purposes.

Use the IANA name rather than a fixed `-5` offset — `America/Chicago` switches between CDT and CST on its own.

> Preferred over setting a `TZ` environment variable. `TZ` works, but Node reads it at process start, so it has to be set in Vercel's project settings rather than `.env.local`, and nothing in the code shows that it depends on deployment config. An explicit conversion behaves the same on Windows and on a UTC box, with nothing to configure.

Changing zones is a one-line edit because every caller funnels through `today()`. If both Central *and* Eastern users ever need to coexist, that becomes a `timezone` column on `users` threaded into the same function — contained, for the same reason.

## Heatmap rendering

A CSS grid, 53 columns x 7 rows, one div per day. No charting library — a dependency here costs more than it saves.

Each day's color is bucketed by **total hours played that day**, summed across all sessions on that date. Five levels, matching GitHub's scale:

| Level | Hours played | Dark (default) | Light |
|---|---|---|---|
| 0 | none | `#161b22` | `#ebedf0` |
| 1 | 0 – 1 | `#0e4429` | `#9be9a8` |
| 2 | 1 – 2 | `#006d32` | `#40c463` |
| 3 | 2 – 3 | `#26a641` | `#30a14e` |
| 4 | 3+ | `#39d353` | `#216e39` |

Keep the thresholds in one exported constant so they can be tuned once real data exists.

**Dark theme is the default.** Light is the secondary theme, not the baseline — build and check the dark palette first, and treat light as the variant that has to keep up.

Note that the two ramps run in opposite directions: in dark theme intensity *brightens* (near-black to vivid green), in light theme it *darkens* (pale green to deep green). This is not a detail to paper over with a single set of colors and an opacity trick — a shared ramp will wash out at one end in one theme or the other. Define both ramps explicitly as CSS custom properties and swap them at the theme boundary.

> The site defaulting to dark does not mean assuming dark. Respect `prefers-color-scheme` for visitors who have set a light preference, with dark as the fallback when no preference is expressed.

> Note that GitHub buckets by quartile relative to your own max, not by fixed thresholds. Fixed thresholds are the better choice here: hours are an absolute, meaningful unit, whereas quartiles would paint a light week in dark green and make the grid non-comparable across time.

## "Tennis activity" section

Sits below the grid, and is the equivalent of GitHub's "Commit activity". Two states:

**Default — no square selected.** Header is the current month ("August 2026") with a summary stat beneath it: *"Played 25.5 hours in 10 sessions."* No session list.

**Selected — a square clicked.** Header is the day ("August 15, 2026"), subheader is that day's summary stat (*"Played 4 hours in 2 sessions"*), followed by the list of that day's sessions.

Each session row:

| Element | Placement | GitHub analog |
|---|---|---|
| **Title** | main subheader | the blue repo-name link |
| **Hours** | beside the title | commit count |
| **Partners** | below the title | — |
| **YouTube URL** | below the title, only when present | — |

All four fields are shown to every visitor, with no separate private variant of the panel. One rendering path, so a public and private version can't drift apart.

**Location is deliberately absent from this list.** It is recorded on every activity but rendered nowhere in v1. When the location analysis is built, its visibility is a fresh decision rather than an inherited one — a public log of which courts someone frequents and when is more sensitive than partner names, so it may belong on the owner's view only, even though everything else here is public.

Build this as **one component taking a date range**, not two. Both states are the same shape — header, summary stat, optional session list — differing only in the range (a month vs. a single day) and whether the list renders. The summary stat is the same aggregate query either way.

**Which month is the default.** For the current view, the current month. For a past year, **December** — the last month of that year.

Both are the same rule: *the default month is the last month in the displayed range.* Worth stating that way because it means no branch on "is this a past year" — the component takes a range and defaults to its final month, and both cases fall out. Hardcoding `now()` would special-case the common view and then need unpicking later.

> Note that the grid is a rolling 53 weeks, not a calendar year, so the current view normally spans parts of two calendar years and its last month is simply the current one. A year selector would switch the range to a calendar year (Jan–Dec), where the same rule lands on December.

## Scaffolding steps

Verified against Node 24 / npm 11.

**1. Scaffold in place**

```bash
npx create-next-app@latest .
```

Answers: TypeScript **yes**, ESLint **yes**, Tailwind **yes**, `src/` **yes**, App Router **yes**, Turbopack **yes**, custom import alias **no**.

`create-next-app` refuses to scaffold into a folder containing files it does not recognize. It allows `.git`, `.gitignore`, `README.md`, `docs/`, and `.vscode/`, but `images/` is not on that list. If it complains, move it aside and back:

```bash
mv images ../hithub-images-tmp    # scaffold, then:
mv ../hithub-images-tmp images
```

**2. Database**

Create a project at [neon.tech](https://neon.tech) (free tier, no card). Put the pooled connection string in `.env.local`:

```
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
```

Confirm `.env*.local` is gitignored. `create-next-app` adds it, but the current `.gitignore` only has `.vscode/` — verify after scaffolding.

**3. Drizzle**

```bash
npm i drizzle-orm @neondatabase/serverless
npm i -D drizzle-kit tsx
```

**4. Schema + push**

Write `src/db/schema.ts` and `drizzle.config.ts`, then:

```bash
npx drizzle-kit push
```

`push` syncs the schema directly, which is right for solo development. Switch to `generate` + `migrate` once there is data worth not losing.

**5. Seed**

`src/db/seed.ts`, run with `npx tsx src/db/seed.ts`, inserting ~30 activities across the last year with 3–4 recurring partners, 2–3 recurring locations, and a few multi-session days to exercise the color buckets. Seed locations even though nothing displays them yet — it means the location analysis has data to build against the day it starts. Do this *before* any UI — it is what makes the heatmap and stats verifiable against numbers checkable by hand.

**No auth.** The one user is hardcoded as `CURRENT_USERNAME` in `src/lib/user.ts`, and every place that needs the user imports it from there.

## Built so far

Build steps 1–3 are done and verified. Where the code lives:

| Path | Role |
|---|---|
| `src/db/schema.ts` | The four tables |
| `src/db/connect.ts` | Connection for CLI scripts — `tsx` does not load `.env.local`, so this calls `loadEnvFile` |
| `src/db/index.ts` | Connection for the app — Next loads env itself, so this is a module-scope `db` |
| `src/db/queries.ts` | Reads used by pages |
| `src/db/seed.ts` / `report.ts` | `npm run seed`, `npm run report` |
| `src/lib/heatmap.ts` | Grid math, buckets, `TIMEZONE`, `today()` — pure, no DB |
| `src/lib/user.ts` | `CURRENT_USERNAME`, the one user the app shows |
| `src/components/heatmap.tsx` | The 53x7 grid |
| `src/app/page.tsx` | Home: grid, year total, legend |

Two connection files is deliberate, not duplication: the CLI one loads `.env.local` because `tsx` will not, and the app one must not.

### Decisions made while building

- **Pages render per request** via `await connection()` in each page. Without it the build prerenders them static, freezing both the data and `today` at build time. This Next version's docs prefer `connection()` over `export const dynamic = 'force-dynamic'` because it ties rendering to the incoming request.
- **No Tailwind `dark:` utilities anywhere.** They key off `prefers-color-scheme: dark`, so a visitor with *no* preference would get the dark background with light-mode text. Colors go through `--muted`, `--border`, and `--heat-*` tokens instead, with light as the `prefers-color-scheme: light` override. This is what "dark is the default" actually requires.
- **Notion is the only input; the `/new` log form was removed.** Sessions are entered in a Notion database and synced in. Keeping a second entry path would mean two sources of truth, and on a public deployment the form's Server Action would accept writes from anyone.
- **React Compiler: no.** It only transforms client components, and there is almost no client state here. One line to enable later if the grid ever gets hover or filtering.

### Verified

`npm run report` against the seed: 51.75 hours, 32 sessions, 27 days, buckets 6 / 13 / 4 / 4. The rendered grid matches all of it, `played_on` arrives as a string, and a real form POST created an activity on the right square with `location_id` populated and a mix of existing and newly created partners linked.

## Build order

Each step has a check that either passes or doesn't.

1. ~~Schema + seed script~~ **done** → verified: aggregation queries return sane numbers
2. ~~Heatmap rendering from real data, no auth, hardcoded user~~ **done** → verified: squares and their shades match the seed data
3. ~~Add-activity form, including a location field~~ **done** → verified: a new row appears on the grid at the right date and shade, and its `location_id` is populated in the database even though nothing renders it
4. "Tennis activity" section, default month state first, then day-selected state → verify: both states render from the same component, and the day totals match the squares above them
5. Stats page → verify: totals match hand-computed values from the seed
6. Activity history page — every session in a chosen timeframe, GitHub's commits list → verify: the session rows reuse the same component as the tennis activity section, and the range total matches the grid

Steps 1–4 produce something genuinely usable. Step 6 is mostly free if step 4 was built range-parameterized as described above — it is the same component over a wider range.
