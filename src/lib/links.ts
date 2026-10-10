/**
 * The home page's whole state is its query string, so every link that isn't a
 * reset has to carry the parts it isn't changing — a day square clicked inside
 * 2025 must stay in 2025. One builder, so no caller has to remember that.
 */
export function homeHref({ year, day }: { year?: number; day?: string }): string {
  const params = new URLSearchParams();
  if (year !== undefined) params.set('year', String(year));
  if (day !== undefined) params.set('day', day);
  const query = params.toString();
  return query ? `/?${query}` : '/';
}
