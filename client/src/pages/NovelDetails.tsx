import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Clock3, Coins, Feather, LockKeyhole } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { CoinUnlockDialog, INSUFFICIENT_COINS_ALERT } from "@/components/CoinUnlockDialog";
import { CoverArt, SiteHeader } from "@/components/LibraryChrome";
import type { ChapterModel, NovelModel } from "@/lib/models";
import { getReadingProgress, resumeChapterId } from "@/lib/readerPreferences";
import { trpc } from "@/lib/trpc";

export default function NovelDetails() {
  const [, params] = useRoute("/novel/:id");
  const rawId = decodeURIComponent(params?.id ?? "");
  const numericId = Number(rawId);
  const details = trpc.novels.details.useQuery({ id: Number.isFinite(numericId) && numericId > 0 ? numericId : 1 }, { enabled: numericId > 0 });
  const account = trpc.account.me.useQuery(undefined, { retry: false, refetchInterval: 5000 });
  const [, navigate] = useLocation();
  const [pendingChapter, setPendingChapter] = useState<ChapterModel | null>(null);
  const [unlockError, setUnlockError] = useState("");
  const utils = trpc.useUtils();
  const unlock = trpc.chapters.unlock.useMutation();
  const savedProgress = getReadingProgress(rawId);
  const novel: NovelModel | undefined = details.data ? {
    id: String(details.data.id),
    slug: details.data.slug,
    title: details.data.title,
    author: details.data.author,
    genre: details.data.genre,
    coverUrl: details.data.coverUrl,
    synopsis: details.data.synopsis,
    chapters: details.data.chapters.map(chapter => ({
      id: String(chapter.id),
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      isPaid: chapter.isPaid,
      isUnlocked: chapter.isUnlocked,
    })),
  } : undefined;
  const chapters: ChapterModel[] = novel?.chapters ?? [];

  if (!novel && details.isPending) return <div className="page-loading"><span className="loading-mark" />Opening the story…</div>;
  if (!novel) return <div className="not-found"><span className="eyebrow">A quiet little detour</span><h1>That story isn’t here.</h1><Link href="/" className="button button-primary"><ArrowLeft size={16} /> Back to the shelf</Link></div>;

  const startChapterId = resumeChapterId(rawId, chapters);
  const startLabel = savedProgress && chapters.some(chapter => chapter.id === savedProgress.chapterId) ? "Continue reading" : "Start reading";
  const pathFor = (chapter: ChapterModel) => `/read/${encodeURIComponent(rawId)}/${encodeURIComponent(chapter.id)}`;

  const openChapter = (chapter: ChapterModel) => {
    const path = pathFor(chapter);
    if (!chapter.isPaid || chapter.isUnlocked) {
      navigate(path);
      return;
    }
    if (!account.data) {
      navigate(`/login?next=${encodeURIComponent(path)}`);
      return;
    }
    setUnlockError("");
    setPendingChapter(chapter);
  };

  const confirmUnlock = async () => {
    if (!pendingChapter) return;
    setUnlockError("");
    try {
      const result = await unlock.mutateAsync({ chapterId: Number(pendingChapter.id) });
      if (result.status === "insufficient") {
        setPendingChapter(null);
        window.alert(INSUFFICIENT_COINS_ALERT);
        return;
      }
      if (result.status === "not_found" || result.status === "account_missing") {
        setPendingChapter(null);
        setUnlockError("This chapter could not be unlocked. Please try again.");
        return;
      }
      const path = pathFor(pendingChapter);
      setPendingChapter(null);
      await Promise.all([utils.account.me.invalidate(), utils.novels.details.invalidate()]);
      navigate(path);
    } catch (error) {
      setPendingChapter(null);
      const message = error instanceof Error ? error.message : "Unable to unlock this chapter.";
      if (message.toLowerCase().includes("sign in") || message.toLowerCase().includes("unauthorized")) {
        navigate(`/login?next=${encodeURIComponent(pathFor(pendingChapter))}`);
      } else {
        setUnlockError(message);
      }
    }
  };

  return (
    <div className="app-page">
      <SiteHeader active="browse" />
      <main className="page-shell detail-shell">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> All stories</Link>
        <section className="detail-hero">
          <div className="detail-cover-wrap"><CoverArt title={novel.title} coverUrl={novel.coverUrl} className="detail-cover" /><span className="cover-caption">A story in {novel.genre}</span></div>
          <div className="detail-copy">
            <div className="eyebrow"><span className="ember-dot" />A story by {novel.author}</div>
            <h1>{novel.title}</h1>
            <div className="detail-byline"><Feather size={15} /> Written by {novel.author} <span className="detail-divider">·</span> {novel.genre}</div>
            <p className="detail-synopsis">{novel.synopsis}</p>
            <div className="detail-actions">
              {startChapterId ? <button className="button button-primary" onClick={() => { const chapter = chapters.find(item => item.id === startChapterId); if (chapter) openChapter(chapter); }}><BookOpen size={17} />{startLabel}<ArrowRight size={16} /></button> : <span className="button button-disabled"><BookOpen size={17} /> Chapters coming soon</span>}
              <span className="chapter-count"><Clock3 size={15} />{chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}</span>
            </div>
            {savedProgress && chapters.some(chapter => chapter.id === savedProgress.chapterId) ? <p className="resume-message">Your place is saved on this device.</p> : null}
            {account.data ? <p className="detail-coin-note"><Coins size={14} />Your balance: <strong>{account.data.coins} coins</strong></p> : null}
            {unlockError ? <p className="form-error" role="alert">{unlockError}</p> : null}
          </div>
        </section>

        <section className="chapter-section">
          <div className="chapter-section-head"><div><div className="eyebrow"><span className="eyebrow-line" />The chapters</div><h2>Take it one page at a time.</h2></div><span className="shelf-count">{String(chapters.length).padStart(2, "0")} chapters</span></div>
          {chapters.length ? <ol className="chapter-list">
            {chapters.map(chapter => {
              const locked = Boolean(chapter.isPaid && !chapter.isUnlocked);
              return <li key={chapter.id}>
                <button type="button" className="chapter-row chapter-row-button" onClick={() => openChapter(chapter)}>
                  <span className="chapter-number">{String(chapter.chapterNumber).padStart(2, "0")}</span>
                  <span className="chapter-row-title">{chapter.title}</span>
                  <span className={locked ? "chapter-read-link chapter-paid-link" : "chapter-read-link"}>
                    {locked ? <><LockKeyhole size={14} /><span>Unlock · 15</span><Coins size={14} /></> : <>Read <ArrowRight size={15} /></>}
                  </span>
                </button>
              </li>;
            })}
          </ol> : <div className="empty-chapters"><p>The first chapter is on its way.</p><span>Come back soon and see where the story goes.</span></div>}
        </section>
      </main>
      <footer className="site-footer page-shell"><span>Sʀꜱɪɴ ᴡᴇʙ</span><span>Stories, at your pace.</span><Link href="/admin">Admin Dashboard <ArrowRight size={14} /></Link></footer>
      {pendingChapter ? <CoinUnlockDialog chapterTitle={pendingChapter.title} pending={unlock.isPending} onCancel={() => setPendingChapter(null)} onConfirm={() => void confirmUnlock()} /> : null}
    </div>
  );
}
