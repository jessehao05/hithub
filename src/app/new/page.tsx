import Link from 'next/link';
import { connection } from 'next/server';
import { getLocations, getPartners, getUserByUsername } from '@/db/queries';
import { today } from '@/lib/heatmap';
import { CURRENT_USERNAME } from '@/lib/user';
import { addActivity } from './actions';

const fieldClass =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm';
const labelClass = 'mb-1 block text-sm font-medium';

export default async function NewActivity() {
  // The partner and location lists change as sessions are logged, and the date
  // field defaults to today.
  await connection();

  const user = await getUserByUsername(CURRENT_USERNAME);
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-xl p-8">
        <p>
          No user named <strong>{CURRENT_USERNAME}</strong>. Run <code>npm run seed</code>.
        </p>
      </main>
    );
  }

  const [partnerRows, locationRows] = await Promise.all([
    getPartners(user.id),
    getLocations(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-xl p-8">
      <Link href="/" className="text-sm text-muted">
        &larr; Back
      </Link>
      <h1 className="mt-4 text-xl font-semibold">Log a session</h1>

      <form action={addActivity} className="mt-6 flex flex-col gap-5">
        <div>
          <label className={labelClass} htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={120}
            placeholder="Morning doubles"
            className={fieldClass}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className={labelClass} htmlFor="playedOn">
              Date
            </label>
            <input
              id="playedOn"
              name="playedOn"
              type="date"
              required
              defaultValue={today()}
              className={fieldClass}
            />
          </div>
          <div className="flex-1">
            <label className={labelClass} htmlFor="durationMinutes">
              Minutes
            </label>
            <input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              required
              min={1}
              step={5}
              defaultValue={60}
              className={fieldClass}
            />
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Partners</legend>
          {partnerRows.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-2">
              {partnerRows.map((partner) => (
                <label key={partner.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="partnerIds" value={partner.id} />
                  {partner.name}
                </label>
              ))}
            </div>
          )}
          <input
            name="newPartners"
            placeholder="Add someone new (comma separated)"
            className={fieldClass}
          />
        </fieldset>

        <div>
          <label className={labelClass} htmlFor="locationId">
            Location
          </label>
          <select id="locationId" name="locationId" defaultValue="" className={fieldClass}>
            <option value="">No location</option>
            {locationRows.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <input
            name="newLocation"
            placeholder="Or add a new one"
            className={`${fieldClass} mt-2`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="videoUrl">
            YouTube URL
          </label>
          <input
            id="videoUrl"
            name="videoUrl"
            type="url"
            placeholder="Optional"
            className={fieldClass}
          />
        </div>

        <button
          type="submit"
          className="rounded-md px-4 py-2 text-sm font-medium text-black"
          style={{ background: 'var(--heat-3)' }}
        >
          Log session
        </button>
      </form>
    </main>
  );
}
