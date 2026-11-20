import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { CoverArt, NovelCard, SearchField, SiteHeader } from "@/components/LibraryChrome";
import type { NovelModel } from "@/lib/models";
import { getReadingProgress } from "@/lib/readerPreferences";
import { trpc } from "@/lib/trpc";

const genres = ["All stories", "Fantasy", "Action", "Romance", "Sci-Fi"] as const;
type GenreFilter = (typeof genres)[number];

type NovelListRow = {
  id: number;
  slug: string;
  title: string;
  author: string;
  genre: NovelModel["genre"];
  coverUrl: string | null;
  synopsis: string;
  latestChapter: { id: number; chapterNumber: number; title: string } | null;
};

function toModel(row: NovelListRow): NovelModel {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    author: row.author,
    genre: row.genre,
    coverUrl: row.coverUrl,
    synopsis: row.synopsis,
    latestChapter: row.latestChapter ? {
      id: String(row.latestChapter.id),
      chapterNumber: row.latestChapter.chapterNumber,
      title: row.latestChapter.title,
    } : null,
  };
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState<GenreFilter>("All stories");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const library = trpc.novels.list.useQuery(undefined, { retry: 1 });

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("library-search")?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const libraryBooks = useMemo(() => (library.data ?? []).map(toModel), [library.data]);
  const catalog = libraryBooks;
  const visibleNovels = useMemo(() => catalog.filter(novel => {
    const genreMatches = activeGenre === "All stories" || novel.genre === activeGenre;
    const searchMatches = !deferredSearch || `${novel.title} ${novel.author} ${novel.genre}`.toLocaleLowerCase().includes(deferredSearch);
    return genreMatches && searchMatches;
  }), [catalog, activeGenre, deferredSearch]);
  const showFeature = activeGenre === "All stories" && !deferredSearch && visibleNovels.length > 0;
  const featured = showFeature ? visibleNovels[0] : null;
  const gridNovels = featured ? visibleNovels : visibleNovels;

  return (
    <div className="app-page">
      <SiteHeader active="browse" />
      <main className="page-shell">
        <section className="home-intro">
          <div className="intro-copy">
            <div className="eyebrow"><span className="eyebrow-line" />A reading room for the curious</div>
            <h1>Good stories<br /><em>stay with you.</em></h1>
            <p>Find a new world, meet its people, and come back whenever you have a moment.</p>
            <a href="#the-shelf" className="text-link">Explore the shelf <ArrowDownRight size={16} /></a>
          </div>
          <div className="intro-note" aria-label="A note about Sʀꜱɪɴ ᴡᴇʙ">
            <span className="note-star"><Sparkles size={18} /></span>
            <div><span className="note-kicker">A little space to read</span><p>New chapters, familiar characters, and a place to pick up right where you left off.</p></div>
            <span className="note-number">01 / 04</span>
          </div>
        </section>

        <section className="discovery-bar" aria-label="Find a story">
          <SearchField value={search} onChange={setSearch} />
          <span className="search-caption">Try a title, an author, or a genre</span>
        </section>

        {featured ? (
          <section className="featured-story" aria-label="Featured story">
            <Link href={`/novel/${encodeURIComponent(featured.id)}`} className="featured-cover-link">
              <CoverArt title={featured.title} coverUrl={featured.coverUrl} className="featured-cover" />
            </Link>
            <div className="featured-copy">
              <div className="eyebrow"><span className="ember-dot" />The story we’re keeping close</div>
              <span className="genre-label">{featured.genre} · Staff pick</span>
              <h2>{featured.title}</h2>
              <p className="featured-author">A story by {featured.author}</p>
              <p className="featured-synopsis">{featured.synopsis}</p>
              <Link href={`/novel/${encodeURIComponent(featured.id)}`} className="button button-primary">Step into the story <ArrowRight size={17} /></Link>
            </div>
            <div className="featured-mark" aria-hidden="true">S<span>ᴡ</span></div>
          </section>
        ) : null}

        <section id="the-shelf" className="shelf-section">
          <div className="shelf-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />The open shelf</div>
              <h2>{deferredSearch ? "Stories worth a look" : "Find your next world."}</h2>
            </div>
            <span className="shelf-count">{String(visibleNovels.length).padStart(2, "0")} {visibleNovels.length === 1 ? "story" : "stories"}</span>
          </div>
          <div className="genre-tabs" role="tablist" aria-label="Filter stories by genre">
            {genres.map(genre => (
              <button key={genre} type="button" role="tab" aria-selected={activeGenre === genre} className={activeGenre === genre ? "genre-tab selected" : "genre-tab"} onClick={() => setActiveGenre(genre)}>
                {genre}
              </button>
            ))}
          </div>

          {library.isPending ? <div className="library-state"><span className="loading-mark" />Gathering the stories…</div> : null}
          {library.error ? <div className="inline-notice" role="alert">စာအုပ်စင်ကို ဖွင့်၍မရပါ။ <button type="button" className="text-button" onClick={() => void library.refetch()}>ပြန်ကြိုးစားရန်</button></div> : null}
          {!library.isPending && visibleNovels.length ? (
            <div className="novel-grid">
              {gridNovels.map(novel => {
                const progress = getReadingProgress(novel.id);
                return <NovelCard key={novel.id} novel={novel} progressLabel={progress ? "Pick up again" : undefined} />;
              })}
            </div>
          ) : null}
          {!library.isPending && !library.error && !visibleNovels.length ? (
            <div className="empty-state"><span className="empty-orbit"><Sparkles size={22} /></span><h3>No stories on this shelf yet.</h3><p>Novel နှင့် chapter အသစ်များကို Admin Dashboard မှသာ ထုတ်ဝေနိုင်ပါသည်။</p>{deferredSearch || activeGenre !== "All stories" ? <button className="button button-quiet" onClick={() => { setSearch(""); setActiveGenre("All stories"); }}>Clear filters</button> : <Link className="button button-quiet" href="/admin">Admin Dashboard <ArrowRight size={14} /></Link>}</div>
          ) : null}
        </section>
        <footer className="site-footer"><span>Sʀꜱɪɴ ᴡᴇʙ</span><span>Made for the next chapter.</span><Link href="/admin">Admin Dashboard <ArrowRight size={14} /></Link></footer>
      </main>
    </div>
  );
}
