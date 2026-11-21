export type Genre = "Fantasy" | "Action" | "Romance" | "Sci-Fi";

export interface ChapterModel {
  id: string;
  chapterNumber: number;
  title: string;
  content?: string;
  isPaid?: boolean;
  isUnlocked?: boolean;
}

export interface LatestChapterModel {
  id: string;
  chapterNumber: number;
  title: string;
}

export interface NovelModel {
  id: string;
  slug?: string;
  title: string;
  author: string;
  genre: Genre;
  coverUrl: string | null;
  synopsis: string;
  latestChapter?: LatestChapterModel | null;
  chapters?: ChapterModel[];
}
