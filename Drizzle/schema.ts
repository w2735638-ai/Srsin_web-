import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const NOVEL_GENRES = ["Fantasy", "Action", "Romance", "Sci-Fi"] as const;
export type NovelGenre = (typeof NOVEL_GENRES)[number];

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const novels = mysqlTable("novels", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  author: varchar("author", { length: 160 }).notNull(),
  genre: mysqlEnum("genre", NOVEL_GENRES).notNull(),
  coverUrl: text("coverUrl"),
  synopsis: text("synopsis").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const chapters = mysqlTable(
  "chapters",
  {
    id: int("id").autoincrement().primaryKey(),
    novelId: int("novelId")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    chapterNumber: int("chapterNumber").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    content: longtext("content").notNull(),
    status: mysqlEnum("status", ["draft", "published"]).default("published").notNull(),
    isPaid: boolean("isPaid").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("chapters_novel_number_unique").on(table.novelId, table.chapterNumber),
    index("chapters_novel_status_number_idx").on(table.novelId, table.status, table.chapterNumber),
  ],
);

export const readerAccounts = mysqlTable(
  "reader_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    coins: int("coins").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastLoginAt: timestamp("lastLoginAt"),
  },
  table => [uniqueIndex("reader_accounts_email_unique").on(table.email)],
);

export const readerSessions = mysqlTable(
  "reader_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    accountId: int("accountId")
      .notNull()
      .references(() => readerAccounts.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("reader_sessions_token_unique").on(table.tokenHash),
    index("reader_sessions_account_expiry_idx").on(table.accountId, table.expiresAt),
  ],
);

export const chapterUnlocks = mysqlTable(
  "chapter_unlocks",
  {
    id: int("id").autoincrement().primaryKey(),
    accountId: int("accountId")
      .notNull()
      .references(() => readerAccounts.id, { onDelete: "cascade" }),
    chapterId: int("chapterId")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    coinsCharged: int("coinsCharged").default(15).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("chapter_unlock_account_chapter_unique").on(table.accountId, table.chapterId),
    index("chapter_unlock_chapter_idx").on(table.chapterId),
  ],
);

export const coinTransactions = mysqlTable(
  "coin_transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    accountId: int("accountId")
      .notNull()
      .references(() => readerAccounts.id, { onDelete: "cascade" }),
    chapterId: int("chapterId").references(() => chapters.id, { onDelete: "set null" }),
    kind: mysqlEnum("kind", ["admin_topup", "chapter_unlock"]).notNull(),
    amount: int("amount").notNull(),
    balanceAfter: int("balanceAfter").notNull(),
    note: varchar("note", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("coin_transactions_account_time_idx").on(table.accountId, table.createdAt),
    index("coin_transactions_chapter_idx").on(table.chapterId),
  ],
);

export const novelRelations = relations(novels, ({ many }) => ({ chapters: many(chapters) }));

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
