import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Coins, LockKeyhole, LogOut, Pencil, Plus, Send, ShieldCheck, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { SiteHeader } from "@/components/LibraryChrome";
import { NovelCoverField, type PendingNovelCover } from "@/components/NovelCoverField";
import { trpc } from "@/lib/trpc";

const genres = ["Fantasy", "Action", "Romance", "Sci-Fi"] as const;

export default function Admin() {
  const [adminPassword, setAdminPassword] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState<(typeof genres)[number]>("Fantasy");
  const [coverUrl, setCoverUrl] = useState("");
  const [pendingCover, setPendingCover] = useState<PendingNovelCover | null>(null);
  const [coverProcessing, setCoverProcessing] = useState(false);
  const [editingNovelId, setEditingNovelId] = useState<number | null>(null);
  const [synopsis, setSynopsis] = useState("");
  const [selectedNovelId, setSelectedNovelId] = useState("");
  const [chapterNumber, setChapterNumber] = useState("1");
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterContent, setChapterContent] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [topUpAmounts, setTopUpAmounts] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const utils = trpc.useUtils();
  const status = trpc.admin.status.useQuery(undefined, { retry: 1 });
  const authenticated = status.data?.authenticated ?? false;
  const library = trpc.novels.list.useQuery(undefined, { enabled: authenticated });
  const accounts = trpc.admin.listAccounts.useQuery(undefined, { enabled: authenticated, refetchInterval: authenticated ? 5000 : false });
  const managedChapters = trpc.admin.listChapters.useQuery(
    { novelId: Number(selectedNovelId) || 1 },
    { enabled: authenticated && Boolean(selectedNovelId) },
  );

  const login = trpc.admin.login.useMutation({
    onSuccess: async () => {
      setAdminPassword("");
      await utils.admin.status.invalidate();
      setNotice("Admin Dashboard သို့ ဝင်ရောက်ပြီးပါပြီ။");
    },
  });
  const logout = trpc.admin.logout.useMutation({
    onSuccess: () => { setNotice("Admin မှ ထွက်ပြီးပါပြီ။"); void utils.admin.status.invalidate(); },
  });
  const addNovel = trpc.admin.createNovel.useMutation({
    onSuccess: async novel => {
      await utils.novels.list.invalidate();
      setSelectedNovelId(String(novel.id));
      setNotice(`“${novel.title}” ကို စာအုပ်စင်သို့ ထည့်ပြီးပါပြီ။`);
      setEditingNovelId(null); setTitle(""); setAuthor(""); setGenre("Fantasy"); setCoverUrl(""); setPendingCover(null); setSynopsis("");
    },
  });
  const uploadCover = trpc.admin.uploadNovelCover.useMutation();
  const editNovel = trpc.admin.updateNovel.useMutation({
    onSuccess: async novel => {
      await Promise.all([utils.novels.list.invalidate(), utils.novels.details.invalidate()]);
      setSelectedNovelId(String(novel.id));
      setNotice(`“${novel.title}” мэдээллийг шинэчиллээ.`);
      setEditingNovelId(null); setTitle(""); setAuthor(""); setGenre("Fantasy"); setCoverUrl(""); setPendingCover(null); setSynopsis("");
    },
  });
  const publishChapter = trpc.admin.publishChapter.useMutation({
    onSuccess: async chapter => {
      await Promise.all([utils.novels.list.invalidate(), utils.novels.details.invalidate(), utils.admin.listChapters.invalidate()]);
      setNotice(`အခန်း ${chapter.chapterNumber} ကို ထုတ်ဝေပြီးပါပြီ။`);
      setChapterNumber(String(chapter.chapterNumber + 1)); setChapterTitle(""); setChapterContent(""); setIsPaid(false);
    },
  });
  const createAccount = trpc.admin.createAccount.useMutation({
    onSuccess: async account => {
      await utils.admin.listAccounts.invalidate();
      setNewEmail(""); setNewPassword("");
      setNotice(`${account.email} အတွက် reader account ဖန်တီးပြီးပါပြီ။`);
    },
  });
  const topUp = trpc.admin.topUpCoins.useMutation({
    onSuccess: async result => {
      setTopUpAmounts(current => ({ ...current, [result.id]: "" }));
      setNotice(`${result.email} ၏ လက်ကျန် Coin ကို ${result.coins} သို့ ဖြည့်ပြီးပါပြီ။`);
      await Promise.all([utils.admin.listAccounts.invalidate(), utils.account.me.invalidate()]);
    },
  });
  const setPaid = trpc.admin.setChapterPaid.useMutation({
    onSuccess: async chapter => {
      setNotice(`အခန်း ${chapter.chapterNumber} ကို ${chapter.isPaid ? "Paid" : "Free"} အဖြစ် ပြောင်းလဲပြီးပါပြီ။`);
      await Promise.all([utils.admin.listChapters.invalidate(), utils.novels.details.invalidate(), utils.novels.list.invalidate()]);
    },
  });

  const resetNovelEditor = () => {
    setEditingNovelId(null); setTitle(""); setAuthor(""); setGenre("Fantasy"); setCoverUrl(""); setPendingCover(null); setSynopsis("");
  };
  const beginEditingNovel = (novel: NonNullable<typeof library.data>[number]) => {
    setEditingNovelId(novel.id); setSelectedNovelId(String(novel.id)); setTitle(novel.title); setAuthor(novel.author);
    setGenre(novel.genre); setCoverUrl(novel.coverUrl ?? ""); setPendingCover(null); setSynopsis(novel.synopsis);
    document.getElementById("novel-editor-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const isNovelSaving = coverProcessing || uploadCover.isPending || addNovel.isPending || editNovel.isPending;

  const onLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    login.mutate({ password: adminPassword });
  };
  const onAddNovel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    try {
      let finalCoverUrl = coverUrl.trim();
      if (pendingCover) {
        const uploaded = await uploadCover.mutateAsync({ dataBase64: pendingCover.dataBase64, mimeType: pendingCover.mimeType });
        finalCoverUrl = uploaded.url;
        setCoverUrl(finalCoverUrl);
        setPendingCover(null);
      }
      const values = { title, author, genre, coverUrl: finalCoverUrl, synopsis };
      if (editingNovelId) await editNovel.mutateAsync({ id: editingNovelId, ...values });
      else await addNovel.mutateAsync(values);
    } catch {
      // Each mutation exposes its safe error message next to the form.
    }
  };
  const onPublish = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedNovelId) return;
    setNotice("");
    publishChapter.mutate({ novelId: Number(selectedNovelId), chapterNumber: Number(chapterNumber), title: chapterTitle, content: chapterContent, isPaid });
  };
  const onCreateAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    createAccount.mutate({ email: newEmail.trim(), password: newPassword });
  };
  const onTopUp = (event: FormEvent<HTMLFormElement>, accountId: number) => {
    event.preventDefault();
    const amount = Number(topUpAmounts[accountId]);
    if (Number.isInteger(amount) && amount > 0) topUp.mutate({ accountId, amount });
  };

  return (
    <div className="app-page admin-page">
      <SiteHeader active="admin" />
      <main className="page-shell admin-shell">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> စာအုပ်စင်သို့ ပြန်ရန်</Link>
        <div className="admin-heading">
          <div><div className="eyebrow"><span className="ember-dot" />Private controls</div><h1>Admin Dashboard<span>.</span></h1><p>စာအုပ်၊ account နှင့် coin စနစ်ကို စီမံပါ။</p></div>
          {authenticated ? <button className="button button-quiet signout-button" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={15} />ထွက်ရန်</button> : null}
        </div>

        {status.isPending ? <div className="library-state"><span className="loading-mark" />Admin access ကို စစ်ဆေးနေသည်…</div> : null}
        {status.error ? <div className="inline-notice error-notice">Admin Dashboard သို့ ချိတ်ဆက်၍ မရပါ။ ပြန်လည်ကြိုးစားပါ။</div> : null}
        {notice ? <div className="success-notice" role="status"><Check size={16} />{notice}</div> : null}

        {!status.isPending && !authenticated ? (
          <section className="admin-login-card">
            <div className="login-icon"><LockKeyhole size={21} /></div>
            <div className="login-copy"><span className="eyebrow">Admin only</span><h2>Admin ဝင်ရောက်ရန်</h2><p>လက်ရှိ အုပ်ချုပ်သူ၏ private password ကို ထည့်ပါ။</p></div>
            {!status.data?.passwordConfigured ? <div className="inline-notice error-notice">Server-side ADMIN_PASSWORD ကို protected project settings တွင် သတ်မှတ်ပါ။</div> : null}
            <form onSubmit={onLogin} className="login-form">
              <label className="field-label" htmlFor="admin-password">Admin password</label>
              <input id="admin-password" className="form-input" type="password" autoComplete="current-password" value={adminPassword} onChange={event => setAdminPassword(event.target.value)} placeholder="Password" required />
              {login.error ? <p className="form-error" role="alert">{login.error.message}</p> : null}
              <button className="button button-primary full-button" type="submit" disabled={login.isPending || !status.data?.passwordConfigured}>{login.isPending ? "စစ်ဆေးနေသည်…" : "Admin ဝင်ရန်"}<ArrowRight size={16} /></button>
              <p className="secure-note"><LockKeyhole size={13} />Password ကို server ဘက်တွင်သာ စစ်ဆေးပါသည်။</p>
            </form>
          </section>
        ) : null}

        {authenticated ? (
          <>
            <div className="admin-welcome"><span className="welcome-mark"><ShieldCheck size={17} /></span><span>ဤနေရာရှိ ပြောင်းလဲမှုများကို Admin ကသာ လုပ်ဆောင်နိုင်ပါသည်။ Reader account အသစ်များအတွက် public sign-up မရှိပါ။</span></div>
            <div className="admin-work-grid">
              <section className="admin-panel" id="novel-editor-panel">
                <div className="panel-heading"><span className="panel-step">01</span><div><span className="eyebrow">{editingNovelId ? "Edit novel" : "Library"}</span><h2>{editingNovelId ? "ဝတ္ထုအချက်အလက် ပြင်ဆင်ရန်" : "ဝတ္ထုအသစ်ထည့်ရန်"}</h2></div></div>
                <form className="admin-form" onSubmit={onAddNovel}>
                  <label className="field-label" htmlFor="novel-title">ဝတ္ထုအမည်</label><input id="novel-title" className="form-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Title" maxLength={180} required />
                  <div className="form-row">
                    <div><label className="field-label" htmlFor="novel-author">စာရေးသူ</label><input id="novel-author" className="form-input" value={author} onChange={event => setAuthor(event.target.value)} placeholder="Author" maxLength={160} required /></div>
                    <div><label className="field-label" htmlFor="novel-genre">အမျိုးအစား</label><select id="novel-genre" className="form-input" value={genre} onChange={event => setGenre(event.target.value as (typeof genres)[number])}>{genres.map(value => <option key={value}>{value}</option>)}</select></div>
                  </div>
                  <NovelCoverField value={coverUrl} pending={pendingCover} onChange={setCoverUrl} onPendingChange={setPendingCover} onProcessingChange={setCoverProcessing} disabled={uploadCover.isPending || addNovel.isPending || editNovel.isPending} />
                  <label className="field-label" htmlFor="novel-synopsis">အကျဉ်းချုပ်</label><textarea id="novel-synopsis" className="form-input form-textarea synopsis-textarea" value={synopsis} onChange={event => setSynopsis(event.target.value)} placeholder="Synopsis" maxLength={5000} required />
                  {addNovel.error ? <p className="form-error" role="alert">{addNovel.error.message}</p> : null}
                  {editNovel.error ? <p className="form-error" role="alert">{editNovel.error.message}</p> : null}
                  {uploadCover.error ? <p className="form-error" role="alert">{uploadCover.error.message}</p> : null}
                  <button className="button button-primary full-button" type="submit" disabled={isNovelSaving}>{isNovelSaving ? "သိမ်းနေသည်…" : editingNovelId ? "ပြင်ဆင်မှုသိမ်းရန်" : "ဝတ္ထုထည့်ရန်"}{editingNovelId ? <Check size={17} /> : <Plus size={17} />}</button>
                  {editingNovelId ? <button type="button" className="button button-quiet full-button" onClick={resetNovelEditor} disabled={isNovelSaving}>ပြင်ဆင်မှုကို ပယ်ဖျက်ရန်</button> : null}
                </form>
              </section>

              <section className="admin-panel publish-panel">
                <div className="panel-heading"><span className="panel-step">02</span><div><span className="eyebrow">Chapters</span><h2>အခန်းတင်ရန်</h2></div></div>
                {!library.data?.length ? <div className="empty-chapter-editor"><BookOpen size={22} /><p>အခန်းတင်ရန် ဝတ္ထုတစ်ခု အရင်ထည့်ပါ။</p></div> : (
                  <form className="admin-form" onSubmit={onPublish}>
                    <label className="field-label" htmlFor="chapter-novel">ဝတ္ထု</label>
                    <select id="chapter-novel" className="form-input" value={selectedNovelId} onChange={event => setSelectedNovelId(event.target.value)} required>
                      <option value="">ဝတ္ထုရွေးပါ…</option>
                      {library.data.map(novel => <option key={novel.id} value={novel.id}>{novel.title}</option>)}
                    </select>
                    <div className="form-row chapter-meta-fields">
                      <div><label className="field-label" htmlFor="chapter-number">အခန်းနံပါတ်</label><input id="chapter-number" className="form-input" type="number" min="1" max="100000" value={chapterNumber} onChange={event => setChapterNumber(event.target.value)} required /></div>
                      <div><label className="field-label" htmlFor="chapter-title">အခန်းခေါင်းစဉ်</label><input id="chapter-title" className="form-input" value={chapterTitle} onChange={event => setChapterTitle(event.target.value)} placeholder="Chapter title" maxLength={200} required /></div>
                    </div>
                    <label className="field-label" htmlFor="chapter-content">အခန်းစာသား</label>
                    <textarea id="chapter-content" className="form-input form-textarea chapter-editor" value={chapterContent} onChange={event => setChapterContent(event.target.value)} placeholder="အခန်းစာသားကို ရေးပါ…" maxLength={200000} required />
                    <div className="editor-footer"><span>စာပိုဒ်အသစ်အတွက် စာကြောင်းလွတ်ထားပါ</span><span>{chapterContent.length.toLocaleString()} / 200,000</span></div>
                    <label className="paid-toggle-row"><input type="checkbox" checked={isPaid} onChange={event => setIsPaid(event.target.checked)} /><span><strong>Paid chapter</strong><small>ဖတ်ရန် 15 Coin ကောက်ခံမည်။</small></span></label>
                    {publishChapter.error ? <p className="form-error" role="alert">{publishChapter.error.message}</p> : null}
                    <button className="button button-primary full-button" type="submit" disabled={publishChapter.isPending || !selectedNovelId}>{publishChapter.isPending ? "ထုတ်ဝေနေသည်…" : "အခန်းထုတ်ဝေရန်"}<Send size={15} /></button>
                  </form>
                )}
              </section>
            </div>

            {selectedNovelId ? <section className="admin-panel admin-pricing-panel">
              <div className="panel-heading"><span className="panel-step">03</span><div><span className="eyebrow">Free / Paid</span><h2>အခန်းတစ်ခုချင်း၏ သတ်မှတ်ချက်</h2></div></div>
              {managedChapters.isPending ? <div className="library-state"><span className="loading-mark" />အခန်းများကို ဖတ်နေသည်…</div> : managedChapters.data?.length ? <div className="managed-chapter-list">
                {managedChapters.data.map(chapter => <div className="managed-chapter-row" key={chapter.id}><span className="chapter-number">{String(chapter.chapterNumber).padStart(2, "0")}</span><span className="chapter-row-title">{chapter.title}</span><span className={chapter.isPaid ? "paid-status" : "free-status"}>{chapter.isPaid ? "Paid · 15 coins" : "Free"}</span><button type="button" className="button button-quiet pricing-toggle" onClick={() => setPaid.mutate({ chapterId: chapter.id, isPaid: !chapter.isPaid })} disabled={setPaid.isPending}>{chapter.isPaid ? "Free ပြောင်းရန်" : "Paid ပြောင်းရန်"}</button></div>)}
              </div> : <p className="admin-empty-line">ဤဝတ္ထုတွင် အခန်းမရှိသေးပါ။</p>}
              {setPaid.error ? <p className="form-error" role="alert">{setPaid.error.message}</p> : null}
            </section> : null}

            <section className="admin-panel account-management-panel">
              <div className="panel-heading"><span className="panel-step">04</span><div><span className="eyebrow">Reader access & coins</span><h2>Reader account စီမံရန်</h2></div></div>
              <form className="admin-form account-create-form" onSubmit={onCreateAccount}>
                <label className="field-label" htmlFor="new-reader-email">Account အသစ် — Email</label>
                <div className="form-row">
                  <div><input id="new-reader-email" className="form-input" type="email" autoComplete="off" value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="reader@example.com" maxLength={320} required /></div>
                  <div><input className="form-input" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Password (အနည်းဆုံး ၈ လုံး)" minLength={8} maxLength={128} required /></div>
                </div>
                {createAccount.error ? <p className="form-error" role="alert">{createAccount.error.message}</p> : null}
                <button className="button button-primary" type="submit" disabled={createAccount.isPending}><UserPlus size={15} />{createAccount.isPending ? "ဖန်တီးနေသည်…" : "Admin အနေဖြင့် account ဖန်တီးရန်"}</button>
              </form>
              <div className="account-list-heading"><span>Reader accounts</span><span>{accounts.data?.length ?? 0} accounts</span></div>
              {accounts.error ? <p className="form-error" role="alert">{accounts.error.message}</p> : null}
              {accounts.data?.length ? <div className="reader-account-list">
                {accounts.data.map(reader => <form className="reader-account-row" key={reader.id} onSubmit={event => onTopUp(event, reader.id)}>
                  <span className="account-avatar"><BookOpen size={15} /></span>
                  <span className="reader-account-email"><strong>{reader.email}</strong><small>Account #{reader.id}</small></span>
                  <span className="reader-account-balance"><Coins size={15} />{reader.coins}</span>
                  <label className="sr-only" htmlFor={`topup-${reader.id}`}>Add coins to {reader.email}</label>
                  <input id={`topup-${reader.id}`} className="form-input coin-topup-input" type="number" min="1" max="1000000" value={topUpAmounts[reader.id] ?? ""} onChange={event => setTopUpAmounts(current => ({ ...current, [reader.id]: event.target.value }))} placeholder="Amount" required />
                  <button className="button button-quiet topup-button" type="submit" disabled={topUp.isPending}><Coins size={14} />ဖြည့်ရန်</button>
                </form>)}
              </div> : <p className="admin-empty-line">Reader account မရှိသေးပါ။ Account များကို Admin ကသာ ဖန်တီးနိုင်သည်။</p>}
              {topUp.error ? <p className="form-error" role="alert">{topUp.error.message}</p> : null}
            </section>

            {library.data?.length ? <section className="admin-library-list"><div className="admin-library-heading"><div><span className="eyebrow">Library</span><h2>ထည့်ထားသော ဝတ္ထုများ</h2></div><span className="shelf-count">{library.data.length} novels</span></div><div className="admin-book-list">{library.data.map(novel => <div className="admin-book-row" key={novel.id}><span className="admin-book-mark"><BookOpen size={16} /></span><button type="button" className="admin-book-select" onClick={() => setSelectedNovelId(String(novel.id))}><strong>{novel.title}</strong><small>{novel.author} · {novel.genre}</small></button><div className="admin-book-actions"><span className="admin-chapter-count">{novel.latestChapter ? `Chapter ${novel.latestChapter.chapterNumber} အထိ` : "အခန်းမရှိသေးပါ"}</span><button type="button" className="button button-quiet admin-book-edit" onClick={() => beginEditingNovel(novel)}><Pencil size={13} /> ပြင်ရန်</button></div></div>)}</div></section> : null}
          </>
        ) : null}
        <footer className="site-footer"><span>Sʀꜱɪɴ ᴡᴇʙ</span><span>Stories, at your pace.</span><Link href="/">စာဖတ်ရန် ပြန်သွားပါ <ArrowRight size={14} /></Link></footer>
      </main>
    </div>
  );
}
