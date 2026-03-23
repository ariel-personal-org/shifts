import {
  pgTable,
  serial,
  varchar,
  boolean,
  integer,
  timestamp,
  date,
  text,
  jsonb,
  uuid,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Teams ───────────────────────────────────────────────────────────────────
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  is_admin: boolean('is_admin').notNull().default(false),
  team_id: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

// ─── Schedules ───────────────────────────────────────────────────────────────
export const schedules = pgTable('schedules', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  cycle_start_time: varchar('cycle_start_time', { length: 5 }).notNull(), // "09:00"
  shift_duration_hours: integer('shift_duration_hours').notNull(),
  capacity: integer('capacity').notNull(),
  primary_team_id: integer('primary_team_id')
    .notNull()
    .references(() => teams.id),
  timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

// ─── Shifts ───────────────────────────────────────────────────────────────────
export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  schedule_id: integer('schedule_id')
    .notNull()
    .references(() => schedules.id, { onDelete: 'cascade' }),
  start_datetime: timestamp('start_datetime').notNull(),
  end_datetime: timestamp('end_datetime').notNull(),
  index: integer('index').notNull(),
});

// ─── Schedule Members ─────────────────────────────────────────────────────────
export const scheduleMembers = pgTable(
  'schedule_members',
  {
    schedule_id: integer('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.schedule_id, t.user_id] }),
  })
);

// ─── Shift Users (ONE state per shift/user) ───────────────────────────────────
export const shiftUsers = pgTable(
  'shift_users',
  {
    shift_id: integer('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    state: varchar('state', { length: 10 }).notNull().default('available'), // 'in_shift' | 'available' | 'home'
  },
  (t) => ({
    pk: primaryKey({ columns: [t.shift_id, t.user_id] }),
  })
);

// ─── Home Request Shifts (flat, no parent table) ──────────────────────────────
export const homeRequestShifts = pgTable(
  'home_request_shifts',
  {
    id: serial('id').primaryKey(),
    request_id: uuid('request_id').notNull(), // groups related shifts (backend-generated)
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    schedule_id: integer('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    shift_id: integer('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    decision: varchar('decision', { length: 10 }).notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    unique_shift_user: unique().on(t.shift_id, t.user_id),
  })
);

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').notNull().defaultNow(),
  type: varchar('type', { length: 60 }).notNull(),
  payload_json: jsonb('payload_json'),
  is_read: boolean('is_read').notNull().default(false),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  actor_user_id: integer('actor_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  affected_user_id: integer('affected_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  schedule_id: integer('schedule_id').references(() => schedules.id, {
    onDelete: 'set null',
  }),
  shift_id: integer('shift_id').references(() => shifts.id, {
    onDelete: 'set null',
  }),
  action: varchar('action', { length: 100 }).notNull(),
  old_value_json: jsonb('old_value_json'),
  new_value_json: jsonb('new_value_json'),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const teamsRelations = relations(teams, ({ many }) => ({
  users: many(users),
  schedules: many(schedules),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.team_id], references: [teams.id] }),
  scheduleMembers: many(scheduleMembers),
  shiftUsers: many(shiftUsers),
  homeRequestShifts: many(homeRequestShifts),
  notifications: many(notifications),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  primaryTeam: one(teams, {
    fields: [schedules.primary_team_id],
    references: [teams.id],
  }),
  shifts: many(shifts),
  members: many(scheduleMembers),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  schedule: one(schedules, {
    fields: [shifts.schedule_id],
    references: [schedules.id],
  }),
  shiftUsers: many(shiftUsers),
  homeRequestShifts: many(homeRequestShifts),
}));
