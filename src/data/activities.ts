import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { Activity } from '@/lib/activities';
import { fetchActivities } from './notion';

/**
 * Restricted mode is the default. Entering VIEW_PASSWORD at /unlock sets a
 * cookie that shows partners and location too. The filtering happens here, on
 * the server, before anything renders — hiding fields in the browser would
 * still ship them to it.
 */

export const VIEW_COOKIE = 'hithub_view';

/**
 * What the cookie holds once unlocked. Derived from the password rather than
 * the password itself, and changing VIEW_PASSWORD signs every viewer out.
 */
export function viewToken(password: string): Buffer {
  return createHash('sha256').update(`hithub-view:${password}`).digest();
}

/** True when `token` matches VIEW_PASSWORD. Never true when it isn't set. */
export function matchesViewPassword(token: Buffer): boolean {
  const password = process.env.VIEW_PASSWORD;
  if (!password) return false;
  const expected = viewToken(password);
  return token.length === expected.length && timingSafeEqual(token, expected);
}

async function isUnlocked(): Promise<boolean> {
  const cookie = (await cookies()).get(VIEW_COOKIE)?.value;
  return cookie !== undefined && matchesViewPassword(Buffer.from(cookie, 'hex'));
}

/**
 * The public fields, listed rather than the private ones deleted, so a field
 * added to Activity later stays hidden until it is added here.
 */
function toPublic({ id, playedOn, durationMinutes, title, videoUrl }: Activity): Activity {
  return { id, playedOn, durationMinutes, title, videoUrl };
}

/** Every activity this viewer may see. The only way pages read activities. */
export async function getActivities(): Promise<Activity[]> {
  const [activities, unlocked] = await Promise.all([fetchActivities(), isUnlocked()]);
  return unlocked ? activities : activities.map(toPublic);
}
