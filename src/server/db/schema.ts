import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const id = () => bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity();
const date = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: id(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  emailVerifiedAt: date("email_verified_at"),
  password: varchar({ length: 255 }),
  plan: varchar({ length: 255 }).notNull().default("free"),
  tutorialDismissedAt: date("tutorial_dismissed_at"),
  isAdmin: boolean("is_admin").notNull().default(false),
  rememberToken: varchar("remember_token", { length: 100 }),
  provider: varchar({ length: 255 }),
  providerId: varchar("provider_id", { length: 255 }),
  createdAt: date("created_at"),
  updatedAt: date("updated_at"),
  deletedAt: date("deleted_at"),
}, (table) => [uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`)]);

export const userSettings = pgTable("user_settings", {
  id: id(),
  userId: bigint("user_id", { mode: "number" }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  theme: varchar({ length: 255 }).notNull().default("light"),
  darkMode: varchar("dark_mode", { length: 255 }).notNull().default("system"),
  showRemainingTasks: boolean("show_remaining_tasks").notNull().default(false),
  showElapsedTime: boolean("show_elapsed_time").notNull().default(false),
  showCelebration: boolean("show_celebration").notNull().default(false),
  createdAt: date("created_at"),
  updatedAt: date("updated_at"),
});

export const routines = pgTable("routines", {
  id: id(),
  userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar({ length: 255 }).notNull(),
  tasks: jsonb().$type<string[]>().notNull(),
  createdAt: date("created_at"),
  updatedAt: date("updated_at"),
});

export const histories = pgTable("histories", {
  id: id(),
  userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  routineId: bigint("routine_id", { mode: "number" }).notNull().references(() => routines.id, { onDelete: "cascade" }),
  title: varchar({ length: 255 }).notNull(),
  tasks: jsonb().$type<string[]>().notNull(),
  startedAt: date("started_at").notNull(),
  finishedAt: date("finished_at"),
  completed: boolean().notNull().default(false),
  createdAt: date("created_at"),
  updatedAt: date("updated_at"),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  email: varchar({ length: 255 }).primaryKey(),
  token: varchar({ length: 64 }).notNull(),
  createdAt: date("created_at"),
});

export const sessions = pgTable("sessions", {
  id: varchar({ length: 64 }).primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: date("expires_at").notNull(),
  createdAt: date("created_at").notNull(),
});

export const rateLimits = pgTable("rate_limits", {
  id: id(),
  key: varchar({ length: 255 }).notNull(),
  createdAt: date("created_at").notNull(),
}, (table) => [index("rate_limits_key_created_at_index").on(table.key, table.createdAt)]);

export type UserRow = typeof users.$inferSelect;
export type UserSettingsRow = typeof userSettings.$inferSelect;
export type RoutineRow = typeof routines.$inferSelect;
export type HistoryRow = typeof histories.$inferSelect;
export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type RateLimitRow = typeof rateLimits.$inferSelect;
