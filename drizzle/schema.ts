import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const NOVEL_GENRES = ["Fantasy", "Action", "Romance", "Sci-Fi"] as const;
export type NovelGenre = (typeof NOVEL_GENRES)[number];

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export const novels = sqliteTable("novels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  genre: text("genre", { enum: NOVEL_GENRES }).notNull(),
  coverUrl: text("coverUrl"),
  synopsis: text("synopsis").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export const chapters = sqliteTable(
  "chapters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    novelId: integer("novelId")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapterNumber").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .default("published")
      .notNull(),
    isPaid: integer("isPaid", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  table => [
    uniqueIndex("chapters_novel_number_unique").on(table.novelId, table.chapterNumber),
    index("chapters_novel_status_number_idx").on(
      table.novelId,
      table.status,
      table.chapterNumber
    ),
  ]
);

export const readerAccounts = sqliteTable(
  "reader_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    passwordHash: text("passwordHash").notNull(),
    coins: integer("coins").default(0).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    lastLoginAt: integer("lastLoginAt", { mode: "timestamp" }),
  },
  table => [uniqueIndex("reader_accounts_email_unique").on(table.email)]
);

export const readerSessions = sqliteTable(
  "reader_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("accountId")
      .notNull()
      .references(() => readerAccounts.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  table => [
    uniqueIndex("reader_sessions_token_unique").on(table.tokenHash),
    index("reader_sessions_account_expiry_idx").on(table.accountId, table.expiresAt),
  ]
);

export const chapterUnlocks = sqliteTable(
  "chapter_unlocks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("accountId")
      .notNull()
      .references(() => readerAccounts.id, { onDelete: "cascade" }),
    chapterId: integer("chapterId")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    coinsCharged: integer("coinsCharged").default(15).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  table => [
    uniqueIndex("chapter_unlock_account_chapter_unique").on(
      table.accountId,
      table.chapterId
    ),
    index("chapter_unlock_chapter_idx").on(table.chapterId),
  ]
);

export const coinTransactions = sqliteTable(
  "coin_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("accountId")
      .notNull()
      .references(() => readerAccounts.id, { onDelete: "cascade" }),
    chapterId: integer("chapterId").references(() => chapters.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["admin_topup", "chapter_unlock"] }).notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balanceAfter").notNull(),
    note: text("note"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  table => [
    index("coin_transactions_account_time_idx").on(table.accountId, table.createdAt),
    index("coin_transactions_chapter_idx").on(table.chapterId),
  ]
);

export const novelRelations = relations(novels, ({ many }) => ({
  chapters: many(chapters),
}));

export const chapterRelations = relations(chapters, ({ one }) => ({
  novel: one(novels, { fields: [chapters.novelId], references: [novels.id] }),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Novel = typeof novels.$inferSelect;
export type NewNovel = typeof novels.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
export type ReaderAccount = typeof readerAccounts.$inferSelect;
export type ReaderSessionUser = Pick<ReaderAccount, "id" | "email" | "coins">;
