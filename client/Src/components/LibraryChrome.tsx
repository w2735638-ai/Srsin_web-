import { ArrowRight, BookOpen, Coins, LogOut, Moon, Search, Sun } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import type { NovelModel } from "@/lib/models";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

export function SiteHeader({ active = "browse" }: { active?: "browse" | "admin" }) {
  const { theme, toggleTheme } = useTheme();
  const account = trpc.account.me.useQuery(undefined, { retry: false, refetchInterval: 5000, staleTime: 0 });
  const utils = trpc.useUtils();
  const logout = trpc.account.logout.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.account.me.invalidate(), utils.novels.details.invalidate()]);
    },
  });

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand" aria-label="Sʀꜱɪɴ ᴡᴇʙ home">
          <span className="brand-mark" aria-hidden="true"><BookOpen size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">Sʀꜱɪɴ ᴡᴇʙ</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/" className={active === "browse" ? "nav-link active" : "nav-link"}>Browse stories</Link>
          <Link href="/admin" className={active === "admin" ? "nav-link active" : "nav-link"}>Admin</Link>
        </nav>
        <div className="header-account">
          {account.data ? (
            <>
              <span className="coin-balance" aria-live="polite" title="Your current coin balance"><Coins size={15} /><span>Coins: <strong>{account.data.coins}</strong></span></span>
              <span className="account-email" title={account.data.email}>{account.data.email}</span>
              <button type="button" className="header-logout" onClick={() => logout.mutate()} disabled={logout.isPending} aria-label="Log out"><LogOut size={15} /><span>Log out</span></button>
            </>
          ) : (
            <Link href="/login" className="header-login">Log in <ArrowRight size={14} /></Link>
          )}
          <button type="button" className="theme-toggle" onClick={() => toggleTheme?.()} aria-pressed={theme === "dark"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span className="theme-toggle-label">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="search-field">
      <Search size={19} strokeWidth={1.8} aria-hidden="true" />
      <span className="sr-only">Search titles or authors</span>
      <input value={value} onChange={event => onChange(event.target.value)} placeholder="Search titles, authors, or a feeling…" />
      <kbd>⌘ K</kbd>
    </label>
  );
}

export function CoverArt({ title, coverUrl, className = "" }: { title: string; coverUrl: string | null; className?: string }) {
  const fallback = title.trim().slice(0, 1).toUpperCase() || "I";
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const showFallback = !coverUrl || failedCoverUrl === coverUrl;
  return (
    <div className={`cover-art ${className}`} aria-label={`Cover art for ${title}`}>
      {coverUrl ? <img src={coverUrl} alt={`Cover art for ${title}`} loading="lazy" decoding="async" style={failedCoverUrl === coverUrl ? { display: "none" } : undefined} onLoad={() => setFailedCoverUrl(current => current === coverUrl ? null : current)} onError={() => setFailedCoverUrl(coverUrl)} /> : null}
      {showFallback ? <span className="cover-fallback" aria-hidden="true">{fallback}</span> : null}
      <span className="cover-edge" aria-hidden="true" />
    </div>
  );
}

export function NovelCard({ novel, progressLabel }: { novel: NovelModel; progressLabel?: string }) {
  return (
    <article className="novel-card">
      <Link href={`/novel/${encodeURIComponent(novel.id)}`} className="novel-cover-link" aria-label={`Open ${novel.title}`}>
        <CoverArt title={novel.title} coverUrl={novel.coverUrl} />
        <span className="card-arrow" aria-hidden="true"><ArrowRight size={17} /></span>
      </Link>
      <div className="novel-card-copy">
        <div className="card-meta-row"><span className="genre-label">{novel.genre}</span>{progressLabel ? <span className="resume-hint">{progressLabel}</span> : null}</div>
        <Link href={`/novel/${encodeURIComponent(novel.id)}`} className="novel-title-link"><h3>{novel.title}</h3></Link>
        <p className="novel-author">by {novel.author}</p>
        <div className="latest-chapter"><span className="chapter-dot" />Latest · {novel.latestChapter?.title ?? "A new story"}</div>
      </div>
    </article>
  );
}
