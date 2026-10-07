import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, MailCheck, RotateCw } from 'lucide-react';
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
const ENTER_MS = 1400;
const DIGITS = 6;

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
  const [digits, setDigits] = useState<string[]>(() => Array(DIGITS).fill(''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [entering, setEntering] = useState<VerifiedAccount | null>(null);
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const enterTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const verifying = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => clearTimeout(enterTimer.current), []);

  const code = digits.join('');
  const expiresIn = secondsLeft(issuedAt + challenge.expiresIn * 1000, now);
  const resendIn = secondsLeft(issuedAt + challenge.resendIn * 1000, now);
  const locked = busy || expiresIn === 0 || Boolean(entering);

  const focusBox = (i: number) => {
    const el = boxRefs.current[Math.max(0, Math.min(DIGITS - 1, i))];
    el?.focus();
    el?.select();
  };

  const clearDigits = () => {
    setDigits(Array(DIGITS).fill(''));
    focusBox(0);
  };

  const verify = async (value: string) => {
    if (verifying.current || busy || entering) return;
    if (!/^\d{6}$/.test(value)) {
      setError('Masukkan 6 digit kode dari email.');
      return;
    }
    verifying.current = true;
    setBusy(true);
    setError('');
    try {
      const account = await verifySignInCode(challenge.challenge, value);
      setEntering(account);
      enterTimer.current = setTimeout(() => onVerified(account), ENTER_MS);
    } catch (err: any) {
      setError(err.message || 'Kode verifikasi tidak valid.');
      clearDigits();
      setBusy(false);
      verifying.current = false;
    }
  };

  const applyDigits = (next: string[]) => {
    setDigits(next);
    const joined = next.join('');
    if (joined.length === DIGITS && next.every((d) => d !== '')) {
      void verify(joined);
    }
  };

  const onBoxChange = (index: number, raw: string) => {
    if (locked) return;
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.length === 0) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    // Paste or autofill of several digits into one box
    if (cleaned.length > 1) {
      const next = Array(DIGITS).fill('');
      cleaned.slice(0, DIGITS).split('').forEach((ch, i) => {
        next[i] = ch;
      });
      applyDigits(next);
      focusBox(Math.min(cleaned.length, DIGITS) - 1);
      return;
    }
    const next = [...digits];
    next[index] = cleaned;
    applyDigits(next);
    if (index < DIGITS - 1) focusBox(index + 1);
  };

  const onBoxKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        focusBox(index - 1);
      }
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusBox(index - 1);
    }
    if (e.key === 'ArrowRight' && index < DIGITS - 1) {
      e.preventDefault();
      focusBox(index + 1);
    }
  };

  const onBoxPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (locked) return;
    const cleaned = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGITS);
    if (!cleaned) return;
    const next = Array(DIGITS).fill('');
    cleaned.split('').forEach((ch, i) => {
      next[i] = ch;
    });
    applyDigits(next);
    focusBox(Math.min(cleaned.length, DIGITS) - 1);
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    verifying.current = false;
    try {
      const next = await onResend();
      setChallenge(next);
      setIssuedAt(Date.now());
      setNow(Date.now());
      clearDigits();
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim ulang kode.');
    } finally {
      setBusy(false);
    }
  };

  if (entering) {
    const label =
      entering.kind === 'staff' ? 'Membuka panel staf…' : 'Membuka portal rekanan…';
    return (
      <div
        className="relative flex flex-col items-center justify-center gap-4 py-10 text-center animate-in fade-in duration-300"
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-[#1B3F9B]/8 to-transparent" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#1B3F9B]/10 ring-4 ring-[#1B3F9B]/15 animate-in zoom-in-50 duration-500">
          <CheckCircle2 className="h-9 w-9 text-[#1B3F9B] animate-in fade-in zoom-in duration-700" />
        </div>
        <div className="relative space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
          <p className="text-base font-semibold text-[#0B2361] dark:text-white">Verifikasi berhasil</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        </div>
        <div className="relative mt-2 h-1 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-[#1B3F9B]"
            style={{ animation: `otp-enter-bar ${ENTER_MS}ms linear forwards` }}
          />
        </div>
        <style>{`@keyframes otp-enter-bar { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    );
  }

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
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Kode Verifikasi
        </label>
        <div className="flex items-center justify-between gap-1.5 sm:gap-2" role="group" aria-label="Kode verifikasi 6 digit">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                boxRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              autoFocus={i === 0}
              maxLength={i === 0 ? DIGITS : 1}
              value={digit}
              disabled={locked}
              aria-label={`Digit ${i + 1} dari ${DIGITS}`}
              onChange={(e) => onBoxChange(i, e.target.value)}
              onKeyDown={(e) => onBoxKeyDown(i, e)}
              onPaste={onBoxPaste}
              onFocus={(e) => e.target.select()}
              className={`h-12 w-10 sm:h-14 sm:w-12 rounded-lg border-2 bg-white text-center font-mono text-xl sm:text-2xl font-semibold text-[#0B2361] outline-none transition
                focus:border-[#1B3F9B] focus:ring-2 focus:ring-[#1B3F9B]/25
                disabled:opacity-50 dark:bg-slate-950 dark:text-white
                ${digit ? 'border-[#1B3F9B] dark:border-blue-500' : 'border-slate-300 dark:border-slate-600'}
                ${error ? 'border-rose-400 dark:border-rose-500' : ''}`}
            />
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {expiresIn > 0 ? `Kode kedaluwarsa dalam ${clock(expiresIn)}.` : 'Kode sudah kedaluwarsa. Minta kode baru.'}
        </p>
      </div>

      <button
        type="submit"
        disabled={locked || code.length !== DIGITS}
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
