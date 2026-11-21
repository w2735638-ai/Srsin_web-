import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, LockKeyhole } from "lucide-react";
import { Link, useLocation } from "wouter";
import { SiteHeader } from "@/components/LibraryChrome";
import { trpc } from "@/lib/trpc";

function safeReturnPath() {
  const candidate = new URLSearchParams(window.location.search).get("next") ?? "/";
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const account = trpc.account.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const destination = useMemo(safeReturnPath, []);
  const login = trpc.account.login.useMutation({
    onSuccess: async () => {
      setPassword("");
      await Promise.all([
        utils.account.me.invalidate(),
        utils.novels.details.invalidate(),
        utils.chapters.getForReading.invalidate(),
      ]);
      navigate(destination);
    },
  });

  useEffect(() => {
    if (account.data) navigate(destination);
  }, [account.data, destination, navigate]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ email: email.trim(), password });
  };

  return (
    <div className="app-page login-page">
      <SiteHeader />
      <main className="page-shell login-shell">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> စာအုပ်စင်သို့ ပြန်သွားရန်</Link>
        <section className="login-card">
          <span className="login-icon"><BookOpen size={22} /></span>
          <div className="eyebrow"><span className="ember-dot" />Reader account</div>
          <h1>စာဖတ်ရန် ဝင်ရောက်ပါ<span>.</span></h1>
          <p className="login-description">Admin မှ ဖန်တီးပေးထားသော Email နှင့် Password ကို အသုံးပြုပါ။</p>
          <form onSubmit={onSubmit} className="login-form">
            <label className="field-label" htmlFor="reader-email">Email</label>
            <input id="reader-email" className="form-input" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} maxLength={320} required />
            <label className="field-label" htmlFor="reader-password">Password</label>
            <input id="reader-password" className="form-input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} maxLength={128} required />
            {login.error ? <p className="form-error" role="alert">{login.error.message}</p> : null}
            <button className="button button-primary full-button" type="submit" disabled={login.isPending || account.isPending}>
              {login.isPending ? "စစ်ဆေးနေသည်…" : "Log in"}<ArrowRight size={16} />
            </button>
            <p className="secure-note"><LockKeyhole size={13} />Public sign-up မရှိပါ။ Account အတွက် Admin ကို ဆက်သွယ်ပါ။</p>
          </form>
        </section>
        <footer className="site-footer"><span>Sʀꜱɪɴ ᴡᴇʙ</span><span>Stories, at your pace.</span><Link href="/admin">Admin Dashboard <ArrowRight size={14} /></Link></footer>
      </main>
    </div>
  );
}
