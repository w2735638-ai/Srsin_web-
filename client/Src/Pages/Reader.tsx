import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Coins, LockKeyhole, Moon, Sun, Type } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { CoinUnlockDialog, INSUFFICIENT_COINS_ALERT } from "@/components/CoinUnlockDialog";
import { useTheme } from "@/contexts/ThemeContext";
import type { ChapterModel, NovelModel } from "@/lib/models";
import { getReadingProgress, loadReaderPreferences, saveReaderPreferences, saveReadingProgress, type ReaderSize, type ReaderTheme } from "@/lib/readerPreferences";
import { trpc } from "@/lib/trpc";

const themes: { value: ReaderTheme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "sepia", label: "Sepia", icon: BookOpen },
  { value: "dark", label: "Dark", icon: Moon },
];
const sizes: { value: ReaderSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export default function Reader() {
  const [, params] = useRoute("/read/:novelId/:chapterId");
  const novelId = decodeURIComponent(params?.novelId ?? "");
  const chapterId = decodeURIComponent(params?.chapterId ?? "");
  const numericNovelId = Number(novelId);
  const numericChapterId = Number(chapterId);
  const { theme: siteTheme, setTheme: setSiteTheme } = useTheme();
  const details = trpc.novels.details.useQuery({ id: Number.isFinite(numericNovelId) && numericNovelId > 0 ? numericNovelId : 1 }, { enabled: numericNovelId > 0 });
  const chapterQuery = trpc.chapters.getForReading.useQuery(
    { id: Number.isFinite(numericChapterId) && numericChapterId > 0 ? numericChapterId : 1 },
    { enabled: numericChapterId > 0, retry: false },
  );
  const account = trpc.account.me.useQuery(undefined, { retry: false, refetchInterval: 5000 });
  const [, navigate] = useLocation();
  const [preferences, setPreferences] = useState(() => {
    const saved = loadReaderPreferences();
    return saved.theme === "sepia" ? saved : { ...saved, theme: siteTheme };
  });
  const [pendingChapter, setPendingChapter] = useState<ChapterModel | null>(null);
  const [unlockError, setUnlockError] = useState("");
  const utils = trpc.useUtils();
  const unlock = trpc.chapters.unlock.useMutation();
  const novel: NovelModel | undefined = details.data ? {
    id: String(details.data.id), title: details.data.title, author: details.data.author, genre: details.data.genre,
    coverUrl: details.data.coverUrl, synopsis: details.data.synopsis,
    chapters: details.data.chapters.map(item => ({ id: String(item.id), chapterNumber: item.chapterNumber, title: item.title, isPaid: item.isPaid, isUnlocked: item.isUnlocked })),
  } : undefined;
  const chapters = novel?.chapters ?? [];
  const chapterMeta = chapters.find(item => item.id === chapterId);
  const authorizedChapter = chapterQuery.data?.access === "available" ? chapterQuery.data.chapter : undefined;
  const chapter: ChapterModel | undefined = authorizedChapter ? {
    id: String(authorizedChapter.id),
    chapterNumber: authorizedChapter.chapterNumber,
    title: authorizedChapter.title,
    content: authorizedChapter.content,
    isPaid: authorizedChapter.isPaid,
    isUnlocked: true,
  } : undefined;
  const chapterIndex = chapterMeta ? chapters.findIndex(item => item.id === chapterMeta.id) : -1;
  const previous = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const next = chapterIndex >= 0 && chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;
  const paragraphs = useMemo(() => chapter?.content?.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean) ?? [], [chapter?.content]);

  useEffect(() => {
    saveReaderPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (preferences.theme !== "sepia" && preferences.theme !== siteTheme) {
      setPreferences(current => current.theme === "sepia" ? current : { ...current, theme: siteTheme });
    }
  }, [siteTheme, preferences.theme]);

  useEffect(() => {
    if (!chapter) return;
    const saved = getReadingProgress(novelId);
    const restoreRatio = saved?.chapterId === chapter.id ? saved.scrollRatio : 0;
    const timer = window.setTimeout(() => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: maxScroll * restoreRatio, behavior: "instant" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [chapter?.id, novelId, chapter]);

  useEffect(() => {
    if (!chapter) return;
    let frame = 0;
    const store = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        saveReadingProgress(novelId, chapter.id, window.scrollY / maxScroll);
      });
    };
    store();
    window.addEventListener("scroll", store, { passive: true });
    return () => {
      window.removeEventListener("scroll", store);
      cancelAnimationFrame(frame);
    };
  }, [chapter?.id, novelId, chapter]);

  const openChapter = (target: ChapterModel) => {
    const targetPath = `/read/${encodeURIComponent(novelId)}/${encodeURIComponent(target.id)}`;
    if (!target.isPaid || target.isUnlocked) {
      navigate(targetPath);
      return;
    }
    if (!account.data) {
      navigate(`/login?next=${encodeURIComponent(targetPath)}`);
      return;
    }
    setUnlockError("");
    setPendingChapter(target);
  };

  const confirmUnlock = async () => {
    if (!pendingChapter) return;
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
      const targetPath = `/read/${encodeURIComponent(novelId)}/${encodeURIComponent(pendingChapter.id)}`;
      const targetId = Number(pendingChapter.id);
      setPendingChapter(null);
      setUnlockError("");
      await Promise.all([utils.account.me.invalidate(), utils.novels.details.invalidate()]);
      if (pendingChapter.id === chapterId) {
        await utils.chapters.getForReading.invalidate({ id: targetId });
      } else {
        navigate(targetPath);
      }
    } catch (error) {
      setPendingChapter(null);
      const message = error instanceof Error ? error.message : "Unable to unlock this chapter.";
      if (message.toLowerCase().includes("sign in") || message.toLowerCase().includes("unauthorized")) {
        const targetPath = `/read/${encodeURIComponent(novelId)}/${encodeURIComponent(pendingChapter.id)}`;
        navigate(`/login?next=${encodeURIComponent(targetPath)}`);
      } else {
        setUnlockError(message);
      }
    }
  };

  if (!novel && details.isPending) return <div className="page-loading"><Link href="/" className="reader-gate-brand">Sʀꜱɪɴ ᴡᴇʙ</Link><span className="loading-mark" />Opening your page…</div>;
  if (!novel) return <div className="not-found"><Link href="/" className="reader-gate-brand">Sʀꜱɪɴ ᴡᴇʙ</Link><span className="eyebrow">A quiet little detour</span><h1>This story isn’t here.</h1><Link href="/" className="button button-primary"><ArrowLeft size={16} /> Back to the shelf</Link></div>;

  if (chapterQuery.isPending) return <div className="page-loading"><Link href="/" className="reader-gate-brand">Sʀꜱɪɴ ᴡᴇʙ</Link><span className="loading-mark" />Opening your page…</div>;
  if (chapterQuery.error) return <div className="not-found"><Link href="/" className="reader-gate-brand">Sʀꜱɪɴ ᴡᴇʙ</Link><span className="eyebrow">A quiet little detour</span><h1>This chapter isn’t available right now.</h1><Link href={`/novel/${encodeURIComponent(novelId)}`} className="button button-primary"><ArrowLeft size={16} /> Back to the story</Link></div>;
  if (chapterQuery.data?.access === "login_required") {
    const returnPath = `/read/${encodeURIComponent(novelId)}/${encodeURIComponent(chapterId)}`;
    return <div className="reader-gate"><Link href="/" className="reader-gate-brand">Sʀꜱɪɴ ᴡᴇʙ</Link><span className="login-icon"><LockKeyhole size={21} /></span><span className="eyebrow">Account required</span><h1>ဝင်ရောက်ပြီး ဖတ်ရှုပါ</h1><p>ဤအခန်းကို ဖတ်ရန် Admin မှ ဖန်တီးထားသော account ဖြင့် အရင်ဝင်ရောက်ပါ။</p><Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="button button-primary">Log in <ArrowRight size={16} /></Link><Link href={`/novel/${encodeURIComponent(novelId)}`} className="back-link">စာအုပ်အခန်းများသို့ ပြန်ရန်</Link></div>;
  }
  if (chapterQuery.data?.access === "unlock_required") {
    const lockedChapter: ChapterModel = { id: chapterId, chapterNumber: chapterQuery.data.chapter.chapterNumber, title: chapterQuery.data.chapter.title, isPaid: true, isUnlocked: false };
    return <div className="reader-gate"><Link href="/" className="reader-gate-brand">Sʀꜱɪɴ ᴡᴇʙ</Link><span className="login-icon"><Coins size={21} /></span><span className="eyebrow">Paid chapter · 15 coins</span><h1>{lockedChapter.title}</h1><p>ဤအခန်းကို ဖတ်ရန် 15 Coin ဖြင့် တစ်ကြိမ်သာ ဖွင့်ပါ။ ဖွင့်ပြီးနောက် အချိန်မရွေး ပြန်ဖတ်နိုင်ပါသည်။</p>{unlockError ? <p className="form-error" role="alert">{unlockError}</p> : null}<button type="button" className="button button-primary" onClick={() => openChapter(lockedChapter)}>အခန်းဖွင့်ရန် <Coins size={16} /></button><Link href={`/novel/${encodeURIComponent(novelId)}`} className="back-link">စာအုပ်အခန်းများသို့ ပြန်ရန်</Link>{pendingChapter ? <CoinUnlockDialog chapterTitle={pendingChapter.title} pending={unlock.isPending} onCancel={() => setPendingChapter(null)} onConfirm={() => void confirmUnlock()} /> : null}</div>;
  }
  if (!chapter) return <div className="not-found"><Link href="/" className="reader-gate-brand">Sʀꜱɪɴ ᴡᴇʙ</Link><span className="eyebrow">A quiet little detour</span><h1>This chapter isn’t here.</h1><Link href={`/novel/${encodeURIComponent(novelId)}`} className="button button-primary"><ArrowLeft size={16} /> Back to the story</Link></div>;

  return (
    <div className={`reader-page reader-${preferences.theme} reader-size-${preferences.size}`}>
      <div className="reader-topbar">
        <div className="reader-topbar-inner">
          <Link href={`/novel/${encodeURIComponent(novelId)}`} className="reader-back" aria-label="Back to story details — Sʀꜱɪɴ ᴡᴇʙ"><ArrowLeft size={17} /><span>Sʀꜱɪɴ ᴡᴇʙ</span></Link>
          <div className="reader-book-label"><span>{novel.title}</span><i>·</i><span>Chapter {chapter.chapterNumber}</span></div>
          {account.data ? <span className="reader-coin-balance" aria-live="polite"><Coins size={14} />{account.data.coins}</span> : <Link href="/login" className="reader-login-link">Log in</Link>}
          <div className="reader-progress-track" aria-label={`Chapter ${chapter.chapterNumber} of ${chapters.length}`}><span style={{ width: `${((chapterIndex + 1) / Math.max(chapters.length, 1)) * 100}%` }} /></div>
        </div>
      </div>
      <main className="reading-layout">
        <div className="reader-toolbar" aria-label="Reading preferences">
          <div className="reader-control-group">
            <span className="reader-control-label"><Sun size={14} /> Paper</span>
            <div className="segmented-control">
              {themes.map(({ value, label, icon: Icon }) => <button key={value} type="button" title={`${label} theme`} aria-label={`${label} theme`} aria-pressed={preferences.theme === value} className={preferences.theme === value ? "selected" : ""} onClick={() => { setPreferences(current => ({ ...current, theme: value })); if (value !== "sepia") setSiteTheme?.(value); }}><Icon size={15} /><span>{label}</span></button>)}
            </div>
          </div>
          <div className="reader-control-group size-control">
            <span className="reader-control-label"><Type size={14} /> Type size</span>
            <div className="segmented-control size-segment">
              {sizes.map(({ value, label }) => <button key={value} type="button" aria-pressed={preferences.size === value} className={preferences.size === value ? "selected" : ""} onClick={() => setPreferences(current => ({ ...current, size: value }))}>{label}</button>)}
            </div>
          </div>
        </div>
        {unlockError ? <p className="form-error reader-unlock-error" role="alert">{unlockError}</p> : null}
        <article className="reader-article">
          <div className="chapter-kicker"><span className="chapter-kicker-rule" />{novel.genre} <span>·</span> Chapter {String(chapter.chapterNumber).padStart(2, "0")}{chapter.isPaid ? <span className="paid-kicker"><Coins size={13} /> Paid</span> : null}</div>
          <h1>{chapter.title}</h1>
          <p className="chapter-byline">{novel.title} <span>by {novel.author}</span></p>
          <div className="reader-divider"><span>✦</span></div>
          <div className="reader-copy">
            {paragraphs.map((paragraph, index) => <p key={`${chapter.id}-${index}`} lang={/[\u1000-\u109f]/i.test(paragraph) ? "my" : "en"}>{paragraph}</p>)}
          </div>
          <div className="reader-endmark"><span /><BookOpen size={18} /><span /></div>
          <p className="progress-saved"><Check size={14} /> Your place is saved on this device</p>
        </article>
        <nav className="chapter-navigation" aria-label="Chapter navigation">
          {previous ? <button className="chapter-nav-button previous" onClick={() => openChapter(previous)}><span className="nav-icon"><ChevronLeft size={18} /></span><span><small>Previous chapter</small><strong>{previous.title}</strong></span></button> : <Link href={`/novel/${encodeURIComponent(novelId)}`} className="chapter-nav-button previous"><span className="nav-icon"><ArrowLeft size={18} /></span><span><small>Back to story</small><strong>All chapters</strong></span></Link>}
          {next ? <button className="chapter-nav-button next" onClick={() => openChapter(next)}><span><small>Up next</small><strong>{next.title}</strong></span><span className="nav-icon"><ChevronRight size={18} /></span></button> : <Link href={`/novel/${encodeURIComponent(novelId)}`} className="chapter-nav-button next"><span><small>You’ve reached the latest</small><strong>Return to the story</strong></span><span className="nav-icon"><ArrowRight size={18} /></span></Link>}
        </nav>
      </main>
      {pendingChapter ? <CoinUnlockDialog chapterTitle={pendingChapter.title} pending={unlock.isPending} onCancel={() => setPendingChapter(null)} onConfirm={() => void confirmUnlock()} /> : null}
    </div>
  );
}
