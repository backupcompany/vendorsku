import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import type { SessionRealm } from '../session/store';
import { startPasswordReset, type OtpChallenge } from '../api/session';

const secondsLeft = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000));

/** Lupa password = kirim tautan email saja. Ganti password lewat link (bukan form kode di sini). */
export const ForgotPasswordForm: React.FC<{
  realm: SessionRealm;
  initialIdentifier?: string;
  onCancel: () => void;
  /** Called after the reset link email is sent (not after password change). */
  onLinkSent?: (email: string) => void;
}> = ({ realm, initialIdentifier = '', onCancel, onLinkSent }) => {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [issuedAt, setIssuedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const resendIn = challenge ? secondsLeft(issuedAt + challenge.resendIn * 1000, now) : 0;
  const placeholder = realm === 'staff' ? 'username atau email staf' : 'email PIC atau NPWP';

  const sendLink = async () => {
    const id = identifier.trim();
    if (!id) {
      setError(`Masukkan ${placeholder}.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const next = await startPasswordReset(realm, id);
      setChallenge(next);
      setIssuedAt(Date.now());
      setNow(Date.now());
      onLinkSent?.(next.email);
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim tautan reset.');
    } finally {
      setBusy(false);
    }
  };

  if (challenge) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/40 animate-in zoom-in-50 duration-400">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#0B2361] dark:text-white">Tautan sudah dikirim</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
              Buka email <strong>{challenge.email}</strong>, lalu klik <strong>Atur Password Baru</strong> untuk menetapkan password baru.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-[#1B3F9B] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali masuk
          </button>
          <button
            type="button"
            disabled={busy || resendIn > 0}
            onClick={() => void sendLink()}
            className="font-semibold text-[#1B3F9B] disabled:text-slate-400 cursor-pointer"
          >
            {resendIn > 0 ? `Kirim ulang (${resendIn}s)` : 'Kirim ulang tautan'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void sendLink();
      }}
      className="space-y-4"
    >
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        Kami akan mengirim tautan ke email akun Anda. Buka tautan tersebut untuk menetapkan password baru.
      </p>
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {realm === 'staff' ? 'Username / Email staf' : 'Email PIC / NPWP'}
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={placeholder}
            autoComplete="username"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 focus:border-[#1B3F9B] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#1B3F9B] py-2.5 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
      >
        {busy ? 'Mengirim…' : 'Kirim tautan ke email'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#1B3F9B] cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Kembali masuk
      </button>
    </form>
  );
};
