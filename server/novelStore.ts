import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { chapterUnlocks, chapters, novels, type NovelGenre } from "../drizzle/schema";
import type { RuntimeEnvSource } from "./_core/env";
import { getDb } from "./db";

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function listNovels(
  options: { query?: string; genre?: NovelGenre } = {},
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");

  const filters = [];
  if (options.genre) filters.push(eq(novels.genre, options.genre));
  const query = options.query?.trim();
  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    filters.push(
      or(
        sql`${novels.title} LIKE ${pattern} ESCAPE '\\'`,
        sql`${novels.author} LIKE ${pattern} ESCAPE '\\'`,
      )!,
    );
  }

  const rows = await db
    .select()
    .from(novels)
    .where(and(...filters))
    .orderBy(desc(novels.updatedAt), desc(novels.id));
  if (rows.length === 0) return [];

  const chapterRows = await db
    .select({
      id: chapters.id,
      novelId: chapters.novelId,
      chapterNumber: chapters.chapterNumber,
      title: chapters.title,
      createdAt: chapters.createdAt,
    })
    .from(chapters)
    .where(
      and(
        inArray(
          chapters.novelId,
          rows.map(row => row.id),
        ),
        eq(chapters.status, "published"),
      ),
    )
    .orderBy(desc(chapters.chapterNumber));

  const latest = new Map<number, (typeof chapterRows)[number]>();
  for (const chapter of chapterRows) {
    if (!latest.has(chapter.novelId)) latest.set(chapter.novelId, chapter);
  }
  return rows.map(row => ({ ...row, latestChapter: latest.get(row.id) ?? null }));
}

export async function getNovelWithChapters(
  id: number,
  accountId?: number,
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  const [novel] = await db.select().from(novels).where(eq(novels.id, id)).limit(1);
  if (!novel) return null;

  const publishedChapters = await db
    .select({
      id: chapters.id,
      novelId: chapters.novelId,
      chapterNumber: chapters.chapterNumber,
      title: chapters.title,
      isPaid: chapters.isPaid,
      createdAt: chapters.createdAt,
    })
    .from(chapters)
    .where(and(eq(chapters.novelId, id), eq(chapters.status, "published")))
    .orderBy(asc(chapters.chapterNumber));

  let unlockedIds = new Set<number>();
  if (accountId && publishedChapters.length) {
    const unlocked = await db
      .select({ chapterId: chapterUnlocks.chapterId })
      .from(chapterUnlocks)
      .where(
        and(
          eq(chapterUnlocks.accountId, accountId),
          inArray(
            chapterUnlocks.chapterId,
            publishedChapters.map(chapter => chapter.id),
          ),
        ),
      );
    unlockedIds = new Set(unlocked.map(row => row.chapterId));
  }

  return {
    ...novel,
    chapters: publishedChapters.map(chapter => ({
      ...chapter,
      isUnlocked: !chapter.isPaid || unlockedIds.has(chapter.id),
    })),
  };
}

function makeSlug(title: string) {
  const stem =
    title
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 150) || "novel";
  return `${stem}-${nanoid(7)}`;
}

export async function createNovel(
  input: {
    title: string;
    author: string;
    genre: NovelGenre;
    coverUrl: string;
    synopsis: string;
  },
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  const slug = makeSlug(input.title);
  await db
    .insert(novels)
    .values({ ...input, slug, coverUrl: input.coverUrl || null });
  const [created] = await db
    .select()
    .from(novels)
    .where(eq(novels.slug, slug))
    .limit(1);
  if (!created) throw new Error("Novel could not be loaded after saving");
  return created;
}

export async function publishChapter(
  input: {
    novelId: number;
    chapterNumber: number;
    title: string;
    content: string;
    isPaid: boolean;
  },
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  const [novel] = await db
    .select({ id: novels.id })
    .from(novels)
    .where(eq(novels.id, input.novelId))
    .limit(1);
  if (!novel) return null;

  await db.insert(chapters).values({ ...input, status: "published" });
  await db
    .update(novels)
    .set({ updatedAt: new Date() })
    .where(eq(novels.id, input.novelId));
  const [created] = await db
    .select()
    .from(chapters)
    .where(
      and(
        eq(chapters.novelId, input.novelId),
        eq(chapters.chapterNumber, input.chapterNumber),
      ),
    )
    .limit(1);
  return created ?? null;
}

export async function updateNovel(
  input: {
    id: number;
    title: string;
    author: string;
    genre: NovelGenre;
    coverUrl: string;
    synopsis: string;
  },
  runtimeEnv?: RuntimeEnvSource,
) {
  const db = await getDb(runtimeEnv);
  if (!db) throw new Error("Database is not available");
  const [existing] = await db
    .select({ id: novels.id })
    .from(novels)
    .where(eq(novels.id, input.id))
    .limit(1);
  if (!existing) return null;
  await db
    .update(novels)
    .set({
      title: input.title,
      author: input.author,
      genre: input.genre,
      coverUrl: input.coverUrl || null,
      synopsis: input.synopsis,
      updatedAt: new Date(),
    })
    .where(eq(novels.id, input.id));
  const [updated] = await db
    .select()
    .from(novels)
    .where(eq(novels.id, input.id))
    .limit(1);
  return updated ?? null;
      }
