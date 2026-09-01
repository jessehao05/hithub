'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createActivity,
  getUserByUsername,
  upsertLocation,
  upsertPartners,
} from '@/db/queries';
import { CURRENT_USERNAME } from '@/lib/user';

function splitNames(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

export async function addActivity(formData: FormData) {
  const user = await getUserByUsername(CURRENT_USERNAME);
  if (!user) throw new Error(`No user named '${CURRENT_USERNAME}'.`);

  const playedOn = String(formData.get('playedOn') ?? '');
  const durationMinutes = Number(formData.get('durationMinutes'));
  const title = String(formData.get('title') ?? '').trim();

  // The form enforces these in the browser; these guard a direct POST, which
  // Server Actions are reachable by.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)) throw new Error('Invalid date.');
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
    throw new Error('Duration must be a positive whole number of minutes.');
  }
  if (!title) throw new Error('Title is required.');

  // A newly typed location wins over the dropdown selection.
  const newLocation = String(formData.get('newLocation') ?? '').trim();
  const locationId = newLocation
    ? await upsertLocation(user.id, newLocation)
    : String(formData.get('locationId') ?? '') || null;

  // Deduped because checking "Alex" and also typing it resolves to one id,
  // which would otherwise violate the activity_partners primary key.
  const partnerIds = [
    ...new Set([
      ...formData.getAll('partnerIds').map(String),
      ...(await upsertPartners(user.id, splitNames(formData.get('newPartners')))),
    ]),
  ];

  await createActivity({
    userId: user.id,
    playedOn,
    durationMinutes,
    title,
    videoUrl: String(formData.get('videoUrl') ?? '').trim() || null,
    locationId,
    partnerIds,
  });

  revalidatePath('/');
  redirect('/');
}
