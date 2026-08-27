# Plan

Technical plan for the idea in [overview.md](./overview.md). Decisions here are settled unless noted.

## Decisions

- **Stack:** Next.js (App Router) + TypeScript + Postgres (Neon) + Drizzle + Tailwind, deployed on Vercel.
- **Locations are stored but not displayed.** Captured on every activity so the data accumulates from day one; no location UI on the homepage in v1. The analysis comes later.
- **Public profiles.** A user's grid is viewable at `/u/<username>` without logging in.
- **Auth guards writes only.** Since reads are public, there is no permission logic on the display path — auth only protects logging and editing.

### Why this stack

The centerpiece is a visual (the heatmap and the day detail panel), which is React's home turf, and Next.js keeps client and server in one deployable in one language. Neon and Vercel both have free tiers this app will never outgrow. Drizzle over Prisma because the queries are simple aggregations that read better in near-SQL.

## Scope

Feasibility is high — this is a small app. One table of activities, a login, a form, and a calendar grid. Every stat in the overview is a single `GROUP BY` over a few hundred rows. No real-time, no scale concerns, no third-party integrations in v1.

**Deferred:** Strava / Google Calendar import, export, social features, mobile app. The overview already notes that importing still bottoms out in manual entry — so manual entry *is* the product, and import must not shape the v1 architecture.

## Schema

```
users(id, username UNIQUE, email, created_at)
partners(id, user_id, name)
locations(id, user_id, name)
activities(id, user_id, played_on DATE, duration_minutes INT, title, video_url, location_id NULL, created_at)
activity_partners(activity_id, partner_id)
```

`username` exists so public profile URLs resolve. `duration_minutes` rather than hours so a 90-minute session isn't rounded into a lie — "contributions" is `duration_minutes / 60`, computed at read time. Never store a derived count.

`title` is the commit-message equivalent: a short one-line label for the session, replacing the "short description" from the original overview. It is **required** — commit messages are, and a session with no label is hard to scan in a list. Long-form notes are not a v1 field; if they're wanted later, add a nullable `body` alongside it, mirroring a commit's subject/body split.

`location_id` is nullable, and one location per activity — unlike partners, which is many-to-many. It is a `locations` table rather than a text column for exactly the reason partners is: `Centennial`, `centennial`, and `Centennial Park` would be three different courts to a `GROUP BY`, and "where have I played most" is the stat that breaks. Same failure, same fix.

**The column only pays off if the form collects it.** Storing location now is worth doing precisely because backfilling a year of "where was that session" from memory is impossible — but that only holds if the add-activity form has a location field from day one. A stored-but-never-populated column buys nothing. The homepage stays location-free; the *form* does not.

## Two things that will bite

Everything else in this app can be as simple as you like. These two are worth getting right up front.

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
- **It blocks public profiles.** "Played with Alex" should eventually link to Alex's grid. A comma-separated string can't hold that; a foreign key can.

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

Partners are a personal roster — rows you own, not user accounts. If a partner later turns out to have their own profile, that is one nullable `linked_user_id` added by `ALTER TABLE`. Safe to defer; do not add it now.

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

> Note that GitHub buckets by quartile relative to your own max, not by fixed thresholds. Fixed thresholds are the better choice here: hours are an absolute, meaningful unit, whereas quartiles would paint a light week in dark green and make the grid non-comparable across time and between profiles.

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

All four fields are public — this is what `/u/<username>` shows to a logged-out visitor, with no separate private variant of the panel. One rendering path, so a public and private version can't drift apart.

**Location is deliberately absent from this list.** It is recorded on every activity but rendered nowhere in v1. When the location analysis is built, its visibility is a fresh decision rather than an inherited one — a public log of which courts someone frequents and when is more sensitive than partner names, so it may belong on the owner's view only, even though everything else here is public.

Build this as **one component taking a date range**, not two. Both states are the same shape — header, summary stat, optional session list — differing only in the range (a month vs. a single day) and whether the list renders. The summary stat is the same aggregate query either way.

> **Open:** the default state is specified as the *current* month. If the grid later allows selecting a past year, "current month" stops being the obvious default for that view. Not a v1 problem — noting it so the range parameter isn't hardcoded to `now()`.

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

**Do not install `next-auth` yet.** Hardcode a user id through build step 4 below. Auth is a clean bolt-on later; installing it early means fighting session plumbing before there are squares on a screen.

## Build order

Each step has a check that either passes or doesn't.

1. Schema + seed script → verify: aggregation queries return sane numbers
2. Heatmap rendering from real data, no auth, hardcoded user → verify: squares and their shades match the seed data
3. Add-activity form, including a location field → verify: a new row appears on the grid at the right date and shade, and its `location_id` is populated in the database even though nothing renders it
4. "Tennis activity" section, default month state first, then day-selected state → verify: both states render from the same component, and the day totals match the squares above them
5. Auth (`next-auth@beta` + `@auth/drizzle-adapter`, GitHub provider) + `user_id` scoping → verify: a second account sees an empty grid, and a logged-out visitor can still view `/u/<username>`
6. Stats page → verify: totals match hand-computed values from the seed
7. Activity history page — every session in a chosen timeframe, GitHub's commits list → verify: the session rows reuse the same component as the tennis activity section, and the range total matches the grid

Steps 1–4 produce something genuinely usable solo. Step 5 is what turns it into a product. Step 7 is mostly free if step 4 was built range-parameterized as described above — it is the same component over a wider range.
