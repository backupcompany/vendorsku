import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, MailCheck, RotateCw } from 'lucide-react';
import { OtpChallenge, VerifiedAccount, verifySignInCode } from '../api/session';

interface OtpCodeFormProps {
  challenge: OtpChallenge;
  onVerified: (account: VerifiedAccount) => void;
  /** Repeats the password step; the server replaces the old code with a fresh one. */
  onResend: () => Promise<OtpChallenge>;
  onCancel: () => void;
  cancelLabel?: string;
}

const secondsLeft = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const OtpCodeForm: React.FC<OtpCodeFormProps> = ({
  challenge: initial,
  onVerified,
  onResend,
  onCancel,
  cancelLabel = 'Ganti akun',
}) => {
  const [challenge, setChallenge] = useState(initial);
  const [issuedAt, setIssuedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const expiresIn = secondsLeft(issuedAt + challenge.expiresIn * 1000, now);
  const resendIn = secondsLeft(issuedAt + challenge.resendIn * 1000, now);

  const verify = async (value: string) => {
    if (busy) return;
    if (!/^\d{6}$/.test(value)) {
      setError('Masukkan 6 digit kode dari email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      onVerified(await verifySignInCode(challenge.challenge, value));
    } catch (err: any) {
      setError(err.message || 'Kode verifikasi tidak valid.');
      setCode('');
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    try {
      const next = await onResend();
      setChallenge(next);
      setIssuedAt(Date.now());
      setNow(Date.now());
      setCode('');
      inputRef.current?.focus();
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim ulang kode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void verify(code);
      }}
      className="space-y-4"
    >
      <div className="flex items-start gap-3 rounded-xl border border-[#1B3F9B]/20 bg-[#1B3F9B]/5 p-3.5 text-xs text-slate-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-slate-200">
        <MailCheck className="h-5 w-5 shrink-0 text-[#1B3F9B] dark:text-blue-300" />
        <p>
          Kode verifikasi 6 digit sudah dikirim ke <strong className="font-semibold">{challenge.email}</strong>. Kode
          hanya berlaku sekali dan diganti setiap kali Anda meminta kode baru.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="otp-code" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Kode Verifikasi
        </label>
        <input
          id="otp-code"
          ref={inputRef}
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          disabled={busy || expiresIn === 0}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            if (digits.length === 6) void verify(digits);
          }}
          placeholder="••••••"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-slate-900 focus:border-[#1B3F9B] focus:outline-none focus:ring-2 focus:ring-[#1B3F9B]/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {expiresIn > 0 ? `Kode kedaluwarsa dalam ${clock(expiresIn)}.` : 'Kode sudah kedaluwarsa. Minta kode baru.'}
        </p>
      </div>

      <button
        type="submit"
        disabled={busy || code.length !== 6 || expiresIn === 0}
        className="w-full rounded-xl bg-[#1B3F9B] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#15327D] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {busy ? 'Memproses…' : 'Verifikasi & Masuk'}
      </button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-[#1B3F9B] dark:text-slate-300 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={busy || resendIn > 0}
          className="inline-flex items-center gap-1.5 font-semibold text-[#1B3F9B] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-blue-300 cursor-pointer"
        >
          <RotateCw className="h-3.5 w-3.5" />
          {resendIn > 0 ? `Kirim ulang (${resendIn}s)` : 'Kirim kode baru'}
        </button>
      </div>
    </form>
  );
};
