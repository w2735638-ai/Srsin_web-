import type { ChapterModel } from "./models";

export type ReaderTheme = "light" | "dark" | "sepia";
export type ReaderSize = "small" | "medium" | "large";

const PREFERENCES_KEY = "ink-ember:reader-preferences:v1";
const PROGRESS_KEY = "ink-ember:reading-progress:v1";

interface Preferences {
  theme: ReaderTheme;
  size: ReaderSize;
}

export interface ReadingProgress {
  chapterId: string;
  scrollRatio: number;
  updatedAt: number;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadReaderPreferences(): Preferences {
  return readJson<Preferences>(PREFERENCES_KEY, { theme: "light", size: "medium" });
}

export function saveReaderPreferences(preferences: Preferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Private browsing and storage quota errors should not interrupt reading.
  }
}

export function getReadingProgress(novelId: string): ReadingProgress | null {
  const progress = readJson<Record<string, ReadingProgress>>(PROGRESS_KEY, {});
  return progress[novelId] ?? null;
}

export function saveReadingProgress(novelId: string, chapterId: string, scrollRatio: number) {
  const progress = readJson<Record<string, ReadingProgress>>(PROGRESS_KEY, {});
  progress[novelId] = {
    chapterId,
    scrollRatio: Math.max(0, Math.min(1, scrollRatio)),
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // The current chapter remains readable even when progress cannot be persisted.
  }
}

export function resumeChapterId(novelId: string, chapters: ChapterModel[]) {
  const savedId = getReadingProgress(novelId)?.chapterId;
  return chapters.find(chapter => chapter.id === savedId)?.id ?? chapters[0]?.id ?? null;
}
