import { Coins, LockKeyhole, X } from "lucide-react";

export const UNLOCK_CONFIRMATION = "Coin 15 ခု ဖြတ်တောက်မည် ဖတ်ရှုမည်လား";
export const INSUFFICIENT_COINS_ALERT = "Coin လက်ကျန် မလုံလောက်ပါ။ Coin ထပ်မံဖြည့်ရန် telegram Acc - @Sirsinwebnix သို့သွားပါ";

export function CoinUnlockDialog({
  chapterTitle,
  pending,
  onConfirm,
  onCancel,
}: {
  chapterTitle?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="coin-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
      <section className="coin-dialog" role="dialog" aria-modal="true" aria-labelledby="coin-dialog-title">
        <button type="button" className="coin-dialog-close" aria-label="ပယ်ဖျက်ရန်" onClick={onCancel} disabled={pending}><X size={18} /></button>
        <span className="coin-dialog-icon"><Coins size={22} /></span>
        <h2 id="coin-dialog-title">{UNLOCK_CONFIRMATION}</h2>
        {chapterTitle ? <p>“{chapterTitle}” ကို ဖတ်ရန် အတည်ပြုပါ။</p> : null}
        <div className="coin-dialog-actions">
          <button type="button" className="button button-quiet" onClick={onCancel} disabled={pending}>Cancel</button>
          <button type="button" className="button button-primary" onClick={onConfirm} disabled={pending}>{pending ? "လုပ်ဆောင်နေသည်…" : "Yes"}<LockKeyhole size={15} /></button>
        </div>
      </section>
    </div>
  );
}
