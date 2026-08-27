import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Personal rosters, not user accounts. The (user_id, name) unique constraint is
// what keeps `Alex` and `Alex ` from becoming two people in a GROUP BY.
export const partners = pgTable(
  'partners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  (t) => [unique('partners_user_id_name_unique').on(t.userId, t.name)],
);

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  (t) => [unique('locations_user_id_name_unique').on(t.userId, t.name)],
);

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // A calendar day, never a timestamp. `mode: 'string'` keeps it a
    // '2026-08-27' string from database to DOM so no timezone conversion can
    // move the square.
    playedOn: date('played_on', { mode: 'string' }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    title: text('title').notNull(),
    videoUrl: text('video_url'),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activities_user_id_played_on_idx').on(t.userId, t.playedOn)],
);

export const activityPartners = pgTable(
  'activity_partners',
  {
    activityId: uuid('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.partnerId] })],
);
