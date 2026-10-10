import 'server-only';
import {
  Client,
  collectAllDataSourceRows,
  isFullPage,
  type PageObjectResponse,
} from '@notionhq/client';
import type { Activity } from '@/lib/activities';

/**
 * The only module that talks to Notion. Pages never import this directly —
 * they go through `getActivities()` in ./activities.ts, which applies the
 * restricted-mode filter. `server-only` makes importing it into a client
 * component a build error, since it holds the token.
 */
const notion = new Client({ auth: process.env.NOTION_TOKEN });

type Properties = PageObjectResponse['properties'];
type Property = Properties[string];

/**
 * A property by name and type. Notion returns every property on every row,
 * empty or not, so a missing one means it was renamed or retyped in Notion —
 * which throws, rather than quietly reading every row as empty.
 */
function prop<T extends Property['type']>(props: Properties, name: string, type: T) {
  const p = props[name];
  if (p?.type !== type) throw new Error(`Notion property "${name}" is missing or not a ${type}`);
  return p as Extract<Property, { type: T }>;
}

/** Null when the row is missing a date or minutes, which the grid can't place. */
function toActivity(page: PageObjectResponse): Activity | null {
  const p = page.properties;
  const date = prop(p, 'Date', 'date').date;
  const minutes = prop(p, 'Minutes', 'number').number;
  if (!date || minutes === null) {
    console.warn(`Skipping Notion row ${page.url}: missing Date or Minutes`);
    return null;
  }

  return {
    id: page.id,
    // 'YYYY-MM-DD' as long as the Date property has "Include time" off. With a
    // time it comes back as a datetime, and the slice keeps the day part.
    playedOn: date.start.slice(0, 10),
    durationMinutes: minutes,
    title:
      prop(p, 'Name', 'title')
        .title.map((t) => t.plain_text)
        .join('') || 'Untitled',
    videoUrl: prop(p, 'YT', 'url').url,
    partners: prop(p, 'Partners', 'multi_select')
      .multi_select.map((o) => o.name)
      .sort((a, b) => a.localeCompare(b)),
    location: prop(p, 'Location', 'select').select?.name ?? null,
  };
}

/** Every row, in creation order. The helper pages past Notion's per-query limits. */
export async function fetchActivities(): Promise<Activity[]> {
  const rows = await collectAllDataSourceRows(notion, {
    data_source_id: process.env.NOTION_DATA_SOURCE_ID!,
  });
  return rows
    .filter(isFullPage)
    .map(toActivity)
    .filter((a) => a !== null);
}
