# Plan

Technical plan for the idea in [overview.md](./overview.md). Decisions here are settled unless noted.

## Decisions

- **Stack:** Next.js (App Router) + TypeScript + Notion API (`@notionhq/client`) + Tailwind, deployed on Vercel.
- **Notion is the data store.** Activities are rows in a Notion database ([notion-db.md](./notion-db.md)), read through the API on each request. There is no database of our own — no Postgres, no ORM, no migrations.
- **Locations are stored but not displayed.** Captured on every activity so the data accumulates from day one; no location UI on the homepage in v1. The analysis comes later.
- **One user.** A deployment shows a single user's data: whichever Notion database `NOTION_DATA_SOURCE_ID` points at. No accounts, no per-user URLs.
- **Restricted by default.** Visitors see title, date, duration, and video. Partners and location are shown only to viewers who have entered `VIEW_PASSWORD` at `/unlock`. See [the tennis activity section](#tennis-activity-section).
- **The app has one fixed timezone**, `America/Chicago`, set in one constant. Not the server clock, which is UTC on Vercel. See [gotcha 3](#3-today-needs-a-timezone-too).

### Why this stack

The centerpiece is a visual (the heatmap and the day detail panel), which is React's home turf, and Next.js keeps client and server in one deployable in one language. Vercel has a free tier this app will never outgrow.

With Notion as the source, the whole dataset — a few hundred rows — comes back in one fetch, and every aggregation is a pure pass over that array in memory. What used to be SQL `GROUP BY`s are plain functions in `src/lib/activities.ts`.

## Scope

Feasibility is high — this is a small app. One Notion database of activities and a calendar grid. Every stat in the overview is a single pass over a few hundred rows. No real-time, no scale concerns, and Notion is the only third-party integration.

**Deferred:** Strava / Google Calendar import, export, social features, mobile app. The overview already notes that importing still bottoms out in manual entry — so manual entry (now in Notion) *is* the product, and import must not shape the v1 architecture.

## Schema

Each Notion row becomes one `Activity` (`src/lib/activities.ts`):

| Notion property | Type | `Activity` field |
|---|---|---|
| Name | title | `title` (`'Untitled'` if blank) |
| Date | date | `playedOn` — `'YYYY-MM-DD'` |
| Minutes | number | `durationMinutes` |
| Location | select | `location` (nullable) |
| Partners | multi-select | `partners` |
| YT | url | `videoUrl` (nullable) |

Notes is in the Notion database but not read by the app. Rows missing Date or Minutes are skipped with a warning, since the grid can't place them. A property that is renamed or retyped in Notion throws, rather than quietly reading every row as empty.

`Minutes` rather than hours so a 90-minute session isn't rounded into a lie — "contributions" is `durationMinutes / 60`, computed at read time. Never store a derived count.

`Name` is the commit-message equivalent: a short one-line label for the session, replacing the "short description" from the original overview. Commit messages are required, and a session with no label is hard to scan in a list. Long-form notes go in the Notion `Notes` property, mirroring a commit's subject/body split, but are not displayed in v1.

`Location` is a select — one location per activity, unlike partners, which is a multi-select. It is a fixed option list rather than free text for exactly the reason partners is: `Centennial`, `centennial`, and `Centennial Park` would be three different courts to any grouping, and "where have I played most" is the stat that breaks. Same failure, same fix.

**The field only pays off if it is filled in.** Storing location now is worth doing precisely because backfilling a year of "where was that session" from memory is impossible. The homepage stays location-free; the Notion entry does not.

## Three things that will bite

Everything else in this app can be as simple as you like. These are worth getting right up front. The third was found while building step 3 — it is the first one wearing a different hat.

### 1. Dates, not timestamps

A timestamp is a *point in time*. A heatmap square is a *calendar day*. Converting between them requires a timezone, and that conversion can move the day.

Concrete failure: a 9:00 PM session on Aug 27 in Nashville (UTC−5) stored as a timestamp is `2026-08-28T02:00:00Z`. Any code reading the day back in UTC — a server component on Vercel, or `.toISOString().slice(0,10)` — puts it on **Aug 28**. Wrong square.

What makes it nasty is that it is *inconsistent*. Morning sessions land correctly; evening sessions slide forward one day. It isn't a uniform off-by-one you would spot immediately, it's a silent skew that starts attributing Friday evenings to Saturday and corrupts the day-of-week stats.

**Fix:** keep the day a `'YYYY-MM-DD'` string end to end. In Notion, leave the Date property's **Include time** off, so the API returns `'2026-08-27'` with nothing to convert. `toActivity` in `src/data/notion.ts` takes the first 10 characters, so a row that does have a time still lands on its written day.

Never pass it through `new Date()`. A JS `Date` built from `'2026-08-27'` is UTC midnight, which renders as the *previous* day in any negative-offset timezone — reintroducing the same bug. Keeping it a string from Notion to DOM means no conversion happens anywhere, and `'YYYY-MM-DD'` strings sort the same alphabetically as chronologically, so plain string comparison is a correct date comparison.

If start times are wanted later, read them as a separate display-only field that never feeds the grid.

### 2. Partners as options, not strings

The tempting version is a text property on the activity: `Partners: "Alex, Sam"`. It works for three weeks and then degrades.

- **The key stat breaks.** "Who have I played the most with" becomes string splitting that assumes every name was typed identically. `Alex`, `alex`, `Alex Chen`, and `Alex ` are four different people to any grouping. Over a year of logging, drift is guaranteed.
- **No autocomplete.** A fixed list lets entry offer people already played before — which is what *prevents* the drift. The data shape and the input UX are the same decision.
- **Renames rewrite history.** A name change becomes string surgery across every row.

**Fix:** a Notion multi-select. Its options are the roster: Notion autocompletes from them, and renaming an option renames it on every row. The headline stat then becomes boring, which is the goal — count and sum minutes per partner name across `partners` arrays.

Partners are a personal roster — names you own, not user accounts.

### 3. "Today" needs a timezone too

Storing `playedOn` as a date string removes timezones from the *stored history*. It does not answer "what day is it right now" — and that question decides the last column of the grid.

`new Date()` on the server uses the server's clock. Locally that is your machine; on Vercel it is UTC. At 9:30 PM Central on Aug 31:

| Zone | Sees the date as |
|---|---|
| America/Chicago | 2026-08-31 |
| America/New_York | 2026-08-31 |
| **UTC** | **2026-09-01** |

So deployed, the grid would open a new column about five hours early.

**Fix:** one `TIMEZONE` constant and a `today()` that converts through `Intl.DateTimeFormat` with that named zone. Nothing reads the ambient process clock for calendar purposes.

Use the IANA name rather than a fixed `-5` offset — `America/Chicago` switches between CDT and CST on its own.

> Preferred over setting a `TZ` environment variable. `TZ` works, but Node reads it at process start, so it has to be set in Vercel's project settings rather than `.env.local`, and nothing in the code shows that it depends on deployment config. An explicit conversion behaves the same on Windows and on a UTC box, with nothing to configure.

Changing zones is a one-line edit because every caller funnels through `today()`.

## Heatmap rendering

A CSS grid, one column per Sunday-first week x 7 rows, one div per day. The rolling view is 53 columns; a calendar year can need 54. Days outside the range are blank cells, so the first and last columns render partial. No charting library — a dependency here costs more than it saves.

Each day's color is bucketed by **total hours played that day**, summed across all sessions on that date. Five levels, matching GitHub's scale:

| Level | Hours played | Dark (default) | Light |
|---|---|---|---|
| 0 | none | `#161b22` | `#ebedf0` |
| 1 | up to 1 | `#0e4429` | `#9be9a8` |
| 2 | over 1, up to 2 | `#006d32` | `#40c463` |
| 3 | over 2, up to 3 | `#26a641` | `#30a14e` |
| 4 | over 3 | `#39d353` | `#216e39` |

Each upper bound is inclusive: exactly 2 hours is level 2. The thresholds live in one exported constant, `LEVEL_THRESHOLD_HOURS` in `src/lib/heatmap.ts`, so they can be tuned once real data exists.

**Dark theme is the default.** Light is the secondary theme, not the baseline — build and check the dark palette first, and treat light as the variant that has to keep up.

Note that the two ramps run in opposite directions: in dark theme intensity *brightens* (near-black to vivid green), in light theme it *darkens* (pale green to deep green). This is not a detail to paper over with a single set of colors and an opacity trick — a shared ramp will wash out at one end in one theme or the other. Define both ramps explicitly as CSS custom properties and swap them at the theme boundary.

> The site defaulting to dark does not mean assuming dark. Respect `prefers-color-scheme` for visitors who have set a light preference, with dark as the fallback when no preference is expressed.

> Note that GitHub buckets by quartile relative to your own max, not by fixed thresholds. Fixed thresholds are the better choice here: hours are an absolute, meaningful unit, whereas quartiles would paint a light week in dark green and make the grid non-comparable across time.

## "Tennis activity" section

Sits below the grid, and is the equivalent of GitHub's "Commit activity". Two states:

**Default — no square selected.** Header is the current month ("August 2026") with a summary stat beneath it: *"Played 25.5 hours in 10 sessions."* No session list.

**Selected — a square clicked.** Header is the day ("August 15, 2026"), subheader is that day's summary stat (*"Played 4 hours in 2 sessions"*), followed by the list of that day's sessions. A "← Back to August 2026" link above the section returns to the default state, and clicking the selected square again does the same.

A range with nothing in it reads *"No tennis logged"*.

Each session row:

| Element | Placement | GitHub analog |
|---|---|---|
| **Title** | main subheader | the blue repo-name link |
| **Hours** | beside the title | commit count |
| **Partners** | below the title, unlocked viewers only | — |
| **YouTube URL** | below the title, only when present | — |

There is one rendering path for every visitor. Restricted mode is not a second variant of the panel: `getActivities()` in `src/data/activities.ts` strips `partners` and `location` on the server before anything renders, and the component simply skips fields that are absent. Hiding them in the browser instead would still ship them to it.

The public fields are listed rather than the private ones deleted, so a field added to `Activity` later stays hidden until it is deliberately made public. Unlocking sets an `httpOnly` cookie holding a hash of `VIEW_PASSWORD`, so changing the password signs every viewer out. `/unlock` is not linked from anywhere.

**Location is deliberately absent from this list,** even for unlocked viewers. It is recorded on every activity but rendered nowhere in v1. When the location analysis is built, its visibility is a fresh decision rather than an inherited one — a log of which courts someone frequents and when is more sensitive than partner names.

Build this as **one component taking a date range**, not two. Both states are the same shape — header, summary stat, optional session list — differing only in the range (a month vs. a single day) and whether the list renders. The summary stat is the same aggregate either way.

**Which month is the default.** For the current view, the current month. For a past year, **December** — the last month of that year.

Both are the same rule: *the default month is the last month in the displayed range.* Worth stating that way because it means no branch on "is this a past year" — the component takes a range and defaults to its final month, and both cases fall out. Hardcoding `now()` would special-case the common view and then need unpicking later.

> Note that the grid is a rolling 53 weeks, not a calendar year, so the current view normally spans parts of two calendar years and its last month is simply the current one. The year selector beside the grid switches the range to a calendar year (Jan–Dec), where the same rule lands on December.

### Year selector

GitHub's right-hand year rail. It lists every year from the first logged session to the current one, newest first. The newest entry is the rolling view, not a calendar year — it links to `/` with no parameter, so selecting it is the same as selecting nothing. Every older year shows Jan 1 – Dec 31.

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

**2. Notion**

```bash
npm i @notionhq/client
```

Create an internal integration at [notion.so/profile/integrations](https://www.notion.so/profile/integrations) with read access, and connect it to the `tennis_activities` database (database `...` menu → Connections). Then put three values in `.env.local`:

```
NOTION_TOKEN="ntn_..."             # the integration's secret
NOTION_DATA_SOURCE_ID="..."        # database settings → Manage data sources → copy ID
VIEW_PASSWORD="..."                # unlocks partners at /unlock; unset means nobody can unlock
```

`.env*` is gitignored. On Vercel, set the same three in the project's environment variables.

It is a *data source* ID, not a database ID: `@notionhq/client` v5 queries data sources, and one Notion database can hold several.

**No auth beyond the view password.**

## Built so far

Build steps 1, 2, and 4 are done, now reading from Notion. Where the code lives:

| Path | Role |
|---|---|
| `src/data/notion.ts` | The only module that talks to Notion — fetches every row and maps it to an `Activity` |
| `src/data/activities.ts` | `getActivities()`, the only way pages read activities; applies restricted mode |
| `src/lib/activities.ts` | The `Activity` type and the aggregations — pure, no Notion |
| `src/lib/heatmap.ts` | Grid math, buckets, `TIMEZONE`, `today()` — pure, no data access |
| `src/lib/links.ts` | `homeHref()`, the one builder for home-page URLs |
| `src/components/heatmap.tsx` | The 53x7 grid and its legend |
| `src/components/tennis-activity.tsx` | The tennis activity section, both states |
| `src/components/year-selector.tsx` | The year rail |
| `src/app/page.tsx` | Home: grid, range total, year selector, tennis activity |
| `src/app/unlock/` | Password form that sets the view cookie |

Both `src/data/` modules import `server-only`, so pulling either into a client component is a build error — they hold the Notion token and the password check.

### Decisions made while building

- **Pages render per request** via `await connection()` in each page. Without it the build prerenders them static, freezing both the data and `today` at build time. This Next version's docs prefer `connection()` over `export const dynamic = 'force-dynamic'` because it ties rendering to the incoming request. It also means a Notion edit shows up on the next page load, with no sync step.
- **One fetch per request, then in-memory aggregation.** The home page calls `getActivities()` once and passes the array down; the heatmap, year selector, and tennis activity section all compute from it. Nothing caches between requests yet.
- **Selection lives in the URL.** The home page's whole state is `?year=` and `?day=`, so the grid stays a server component and a selected day is shareable. Every link goes through `homeHref()`, so a square clicked in 2025 keeps `year=2025`. A `day` outside the displayed range is ignored, as is a `year` not in the selector.
- **No Tailwind `dark:` utilities anywhere.** They key off `prefers-color-scheme: dark`, so a visitor with *no* preference would get the dark background with light-mode text. Colors go through `--muted`, `--border`, and `--heat-*` tokens instead, with light as the `prefers-color-scheme: light` override. This is what "dark is the default" actually requires.
- **Notion is the only input; the `/new` log form was removed.** Keeping a second entry path would mean two sources of truth, and on a public deployment the form's Server Action would accept writes from anyone.
- **Postgres and Drizzle were removed.** The first version stored activities in Neon via Drizzle, with a seed script. Both went once Notion became the only input; activities are now read straight from Notion.
- **React Compiler: no.** It only transforms client components, and there is almost no client state here. One line to enable later if the grid ever gets hover or filtering.

### Verified

The Postgres version was checked against its seed (hours, sessions, days, and bucket counts all matched the rendered grid). That seed no longer exists; the Notion version has no equivalent hand-checked dataset yet.

## Build order

Each step has a check that either passes or doesn't.

1. ~~Schema + seed script~~ **done**, since replaced by the Notion database → verified: aggregation queries return sane numbers
2. ~~Heatmap rendering from real data, no auth, hardcoded user~~ **done** → verified: squares and their shades match the seed data
3. ~~Add-activity form, including a location field~~ **done, then removed** — Notion is the entry form now
4. ~~"Tennis activity" section, default month state first, then day-selected state~~ **done** → both states render from the one `TennisActivity` component; day totals and squares are both sums of `durationMinutes` over the same array
5. Stats page → verify: totals match hand-computed values from the Notion data
6. Activity history page — every session in a chosen timeframe, GitHub's commits list → verify: the session rows reuse the same component as the tennis activity section, and the range total matches the grid

Steps 1–4 produce something genuinely usable. Step 6 is mostly free if step 4 was built range-parameterized as described above — it is the same component over a wider range.
