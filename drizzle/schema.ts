import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role").default("user").notNull(),
  coins: integer("coins").default(0).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const novels = sqliteTable("novels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  author: text("author"),
  description: text("description"),
  coverUrl: text("coverUrl"),
  status: text("status").default("ongoing").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const chapters = sqliteTable("chapters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  novelId: integer("novelId")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapterNumber").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isFree: integer("isFree", { mode: "boolean" }).default(false).notNull(),
  coinPrice: integer("coinPrice").default(15).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const unlockedChapters = sqliteTable(
  "unlocked_chapters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chapterId: integer("chapterId")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    coinsSpent: integer("coinsSpent").default(15).notNull(),
    unlockedAt: integer("unlockedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  },
  table => ({
    userChapterIdx: uniqueIndex("unlocked_user_chapter_idx").on(table.userId, table.chapterId),
  }),
);

export const coinTransactions = sqliteTable("coin_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  note: text("note"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Novel = typeof novels.$inferSelect;
export type InsertNovel = typeof novels.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = typeof chapters.$inferInsert;
  
