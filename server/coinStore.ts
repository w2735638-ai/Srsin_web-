import { and, asc, eq, sql } from "drizzle-orm";
import {
  chapterUnlocks,
  chapters,
  coinTransactions,
  novels,
  readerAccounts,
} from "../drizzle/schema";
import type { RuntimeEnvSource } from "./_core/env";
import { getDb } from "./db";

export const CHAPTER_UNLOCK_COST = 15;

export async function createReaderAccount(
  email: string,
  passwordHash: string,
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  await db
    .insert(readerAccounts)
    .values({ email: email.trim(), passwordHash, coins: 0 });
  const [created] = await db
    .select({
      id: readerAccounts.id,
      email: readerAccounts.email,
      coins: readerAccounts.coins,
      createdAt: readerAccounts.createdAt,
    })
    .from(readerAccounts)
    .where(eq(readerAccounts.email, email.trim()))
    .limit(1);
  if (!created) throw new Error("Reader account could not be loaded after saving");
  return created;
}

export async function listReaderAccounts(runtimeEnv?: RuntimeEnvSource) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  return db
    .select({
      id: readerAccounts.id,
      email: readerAccounts.email,
      coins: readerAccounts.coins,
      createdAt: readerAccounts.createdAt,
      lastLoginAt: readerAccounts.lastLoginAt,
    })
    .from(readerAccounts)
    .orderBy(asc(readerAccounts.email));
}

export async function topUpReaderCoins(
  accountId: number,
  amount: number,
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");

  return db.transaction(async tx => {
    const [account] = await tx
      .select({
        id: readerAccounts.id,
        email: readerAccounts.email,
        coins: readerAccounts.coins,
      })
      .from(readerAccounts)
      .where(eq(readerAccounts.id, accountId))
      .limit(1);
    if (!account) return null;
    if (account.coins > 2_147_483_647 - amount) {
      throw new Error("Coin balance limit would be exceeded.");
    }
    const balance = account.coins + amount;
    await tx
      .update(readerAccounts)
      .set({ coins: balance })
      .where(eq(readerAccounts.id, accountId));
    await tx.insert(coinTransactions).values({
      accountId,
      kind: "admin_topup",
      amount,
      balanceAfter: balance,
      note: "Admin coin top-up",
    });
    return { id: account.id, email: account.email, coins: balance };
  });
}

export async function listAdminChapters(
  novelId: number,
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  return db
    .select({
      id: chapters.id,
      novelId: chapters.novelId,
      chapterNumber: chapters.chapterNumber,
      title: chapters.title,
      isPaid: chapters.isPaid,
      status: chapters.status,
    })
    .from(chapters)
    .where(eq(chapters.novelId, novelId))
    .orderBy(asc(chapters.chapterNumber));
}

export async function setChapterPricing(
  chapterId: number,
  isPaid: boolean,
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  const [chapter] = await db
    .select({ id: chapters.id, novelId: chapters.novelId })
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);
  if (!chapter) return null;
  await db.update(chapters).set({ isPaid }).where(eq(chapters.id, chapterId));
  await db
    .update(novels)
    .set({ updatedAt: new Date() })
    .where(eq(novels.id, chapter.novelId));
  const [updated] = await db
    .select({
      id: chapters.id,
      novelId: chapters.novelId,
      chapterNumber: chapters.chapterNumber,
      title: chapters.title,
      isPaid: chapters.isPaid,
    })
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);
  return updated ?? null;
}

export async function unlockReaderChapter(
  accountId: number,
  chapterId: number,
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  const [chapter] = await db
    .select({ id: chapters.id, isPaid: chapters.isPaid })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.status, "published")))
    .limit(1);
  if (!chapter) return { status: "not_found" as const };
  if (!chapter.isPaid) {
    const [account] = await db
      .select({ coins: readerAccounts.coins })
      .from(readerAccounts)
      .where(eq(readerAccounts.id, accountId))
      .limit(1);
    return { status: "free" as const, coins: account?.coins ?? 0, charged: 0 };
  }

  return db.transaction(async tx => {
    const [account] = await tx
      .select({
        id: readerAccounts.id,
        coins: readerAccounts.coins,
      })
      .from(readerAccounts)
      .where(eq(readerAccounts.id, accountId))
      .limit(1);
    if (!account) return { status: "account_missing" as const };

    const [existing] = await tx
      .select({ id: chapterUnlocks.id })
      .from(chapterUnlocks)
      .where(
        and(
          eq(chapterUnlocks.accountId, accountId),
          eq(chapterUnlocks.chapterId, chapterId),
        ),
      )
      .limit(1);
    if (existing) {
      return { status: "already_unlocked" as const, coins: account.coins, charged: 0 };
    }
    if (account.coins < CHAPTER_UNLOCK_COST) {
      return { status: "insufficient" as const, coins: account.coins, charged: 0 };
    }

    const balance = account.coins - CHAPTER_UNLOCK_COST;
    await tx
      .update(readerAccounts)
      .set({ coins: sql`${readerAccounts.coins} - ${CHAPTER_UNLOCK_COST}` })
      .where(eq(readerAccounts.id, accountId));
    await tx.insert(coinTransactions).values({
      accountId,
      chapterId,
      kind: "chapter_unlock",
      amount: -CHAPTER_UNLOCK_COST,
      balanceAfter: balance,
      note: `Unlocked chapter ${chapterId}`,
    });
    await tx
      .insert(chapterUnlocks)
      .values({ accountId, chapterId, coinsCharged: CHAPTER_UNLOCK_COST });
    return {
      status: "unlocked" as const,
      coins: balance,
      charged: CHAPTER_UNLOCK_COST,
    };
  });
}

export async function getReaderChapter(
  chapterId: number,
  accountId?: number,
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  const [chapter] = await db
    .select({
      id: chapters.id,
      novelId: chapters.novelId,
      chapterNumber: chapters.chapterNumber,
      title: chapters.title,
      content: chapters.content,
      isPaid: chapters.isPaid,
      novelTitle: novels.title,
      author: novels.author,
      genre: novels.genre,
    })
    .from(chapters)
    .innerJoin(novels, eq(chapters.novelId, novels.id))
    .where(and(eq(chapters.id, chapterId), eq(chapters.status, "published")))
    .limit(1);
  if (!chapter) return { access: "not_found" as const };
  if (!chapter.isPaid) return { access: "available" as const, chapter };
  if (!accountId) {
    const { content: _content, ...metadata } = chapter;
    return { access: "login_required" as const, chapter: metadata };
  }

  const [unlock] = await db
    .select({ id: chapterUnlocks.id })
    .from(chapterUnlocks)
    .where(
      and(
        eq(chapterUnlocks.accountId, accountId),
        eq(chapterUnlocks.chapterId, chapterId),
      ),
    )
    .limit(1);
  if (!unlock) {
    const { content: _content, ...metadata } = chapter;
    return { access: "unlock_required" as const, chapter: metadata };
  }
  return { access: "available" as const, chapter };
                        }
  
