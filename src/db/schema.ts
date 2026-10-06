import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const groupStatus = pgEnum("group_status", ["open", "closed", "drawn"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  displayNameConfirmed: boolean("display_name_confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_uq").on(table.providerId, table.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    budget: numeric("budget", { precision: 8, scale: 2 }),
    exchangeDate: date("exchange_date"),
    status: groupStatus("status").notNull().default("open"),
    joinCode: text("join_code").notNull(),
    inviteToken: text("invite_token").notNull(),
    adminId: text("admin_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    drawnAt: timestamp("drawn_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("groups_join_code_uq").on(table.joinCode),
    uniqueIndex("groups_invite_token_uq").on(table.inviteToken),
    check("groups_join_code_six_digits", sql`${table.joinCode} ~ '^[0-9]{6}$'`),
    check("groups_budget_positive", sql`${table.budget} is null or ${table.budget} > 0`),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    favoriteColor: text("favorite_color"),
    topSize: text("top_size"),
    bottomSize: text("bottom_size"),
    shoeSize: text("shoe_size"),
    giftNotes: text("gift_notes"),
    giftDataCompleted: boolean("gift_data_completed").notNull().default(false),
    previousAnswerConfirmed: boolean("previous_answer_confirmed").notNull().default(false),
    previousRecipientId: text("previous_recipient_id").references(() => user.id, { onDelete: "restrict" }),
    previousAnswerKind: text("previous_answer_kind"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("memberships_user_id_idx").on(table.userId),
    check(
      "memberships_previous_answer_kind",
      sql`${table.previousAnswerKind} is null or ${table.previousAnswerKind} in ('participant', 'not_participated', 'absent')`,
    ),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    giverId: text("giver_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    recipientId: text("recipient_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.giverId] }),
    uniqueIndex("assignments_one_recipient_per_group_uq").on(table.groupId, table.recipientId),
    check("assignments_not_self", sql`${table.giverId} <> ${table.recipientId}`),
  ],
);

export const codeLookupLimits = pgTable(
  "code_lookup_limits",
  {
    keyHash: text("key_hash").primaryKey(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(1),
  },
  (table) => [check("code_lookup_attempts_positive", sql`${table.attempts} > 0`)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(memberships),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const groupRelations = relations(groups, ({ many, one }) => ({
  admin: one(user, { fields: [groups.adminId], references: [user.id] }),
  memberships: many(memberships),
  assignments: many(assignments),
}));

export const membershipRelations = relations(memberships, ({ one }) => ({
  group: one(groups, { fields: [memberships.groupId], references: [groups.id] }),
  user: one(user, { fields: [memberships.userId], references: [user.id] }),
}));

export const schema = {
  user,
  session,
  account,
  verification,
  groups,
  memberships,
  assignments,
  codeLookupLimits,
};
