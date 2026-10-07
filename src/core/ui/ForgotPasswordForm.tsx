import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, MailCheck } from 'lucide-react';
import type { SessionRealm } from '../session/store';
import { completePasswordReset, startPasswordReset, type OtpChallenge } from '../api/session';
import { passwordProblem, passwordRules } from '../auth/signInRules';
import { PasswordChecklist } from './PasswordChecklist';

const secondsLeft = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const ForgotPasswordForm: React.FC<{
  realm: SessionRealm;
  initialIdentifier?: string;
  onDone: () => void;
  onCancel: () => void;
}> = ({ realm, initialIdentifier = '', onDone, onCancel }) => {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [issuedAt, setIssuedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const expiresIn = challenge ? secondsLeft(issuedAt + challenge.expiresIn * 1000, now) : 0;
  const resendIn = challenge ? secondsLeft(issuedAt + challenge.resendIn * 1000, now) : 0;
  const placeholder = realm === 'staff' ? 'username atau email staf' : 'email PIC atau NPWP';

  const sendCode = async () => {
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
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim kode.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) {
      void sendCode();
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Masukkan 6 digit kode dari email.');
      return;
    }
    const problem = passwordProblem(newPassword);
    if (problem) {
      setError(problem);
      return;
    }
    if (newPassword !== confirm) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await completePasswordReset(challenge.challenge, code, newPassword);
      onDone();
    } catch (err: any) {
      setError(err.message || 'Gagal mengatur password baru.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Kami kirim tautan (atau kode) ke email akun. Klik tautan di email untuk isi password baru + konfirmasi saja — tanpa password lama.
      </p>
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {!challenge ? (
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Akun</label>
          <input
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={placeholder}
            autoComplete="username"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-900 focus:border-[#1B3F9B] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-[#1B3F9B]/20 bg-[#1B3F9B]/5 p-3.5 text-xs text-slate-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-slate-200">
            <MailCheck className="h-5 w-5 shrink-0 text-[#1B3F9B] dark:text-blue-300" />
            <p>
              Kode 6 digit dikirim ke <strong>{challenge.email}</strong>
              {expiresIn > 0 ? ` · kedaluwarsa ${clock(expiresIn)}` : ' · kedaluwarsa, kirim ulang'}.
            </p>
          </div>
          <input
            ref={inputRef}
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Kode 6 digit"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password baru</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
              <input
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 mr-3 text-slate-400" aria-label="Tampilkan password">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && <PasswordChecklist rules={passwordRules(newPassword)} />}
          </div>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Ulangi password baru"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#1B3F9B] py-2.5 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
      >
        {busy ? 'Memproses…' : challenge ? 'Simpan password baru' : 'Kirim link ke email'}
      </button>
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 font-semibold text-slate-600 cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali masuk
        </button>
        {challenge && (
          <button
            type="button"
            disabled={busy || resendIn > 0}
            onClick={() => void sendCode()}
            className="font-semibold text-[#1B3F9B] disabled:text-slate-400 cursor-pointer"
          >
            {resendIn > 0 ? `Kirim ulang (${resendIn}s)` : 'Kirim kode baru'}
          </button>
        )}
      </div>
    </form>
  );
};
