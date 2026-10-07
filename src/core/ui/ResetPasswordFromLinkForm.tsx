import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { completePasswordReset } from '../api/session';
import { passwordProblem, passwordRules } from '../auth/signInRules';
import { PasswordChecklist } from './PasswordChecklist';
import { navigate } from '../router/useAppRouter';

const SUCCESS_MS = 1600;

/** Opened from email link ?reset=1&c=<challenge>&k=<code> — new password + confirm only. */
export const ResetPasswordFromLinkForm: React.FC<{
  challenge: string;
  code: string;
  onDone: () => void;
}> = ({ challenge, code, onDone }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await completePasswordReset(challenge, code, newPassword);
      setDone(true);
      const path = window.location.pathname.startsWith('/admin') ? '/admin' : '/';
      navigate(path, { replace: true });
      timer.current = setTimeout(() => onDone(), SUCCESS_MS);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan password baru.');
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center animate-in fade-in duration-300" role="status">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100 dark:bg-emerald-950/50 dark:ring-emerald-900/40 animate-in zoom-in-50 duration-500">
          <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-base font-semibold text-[#0B2361] dark:text-white">Password berhasil diubah</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Silakan masuk dengan password baru Anda…</p>
        </div>
        <div className="mt-1 h-1 w-36 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full rounded-full bg-emerald-600" style={{ animation: `pw-ok-bar ${SUCCESS_MS}ms linear forwards` }} />
        </div>
        <style>{`@keyframes pw-ok-bar { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        Silakan tetapkan password baru untuk akun Portal Rekanan Anda.
      </p>
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password baru</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 mr-3 text-slate-400 cursor-pointer" aria-label="Tampilkan password">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {newPassword && <PasswordChecklist rules={passwordRules(newPassword)} />}
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Konfirmasi password baru</label>
        <input
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Ulangi password baru"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>
      <button
        type="submit"
        disabled={busy || Boolean(passwordProblem(newPassword)) || newPassword !== confirm}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1B3F9B] py-2.5 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>{busy ? 'Menyimpan…' : 'Simpan Password Baru'}</span>
      </button>
    </form>
  );
};

export function readResetLinkParams(search: string): { challenge: string; code: string } | null {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (p.get('reset') !== '1') return null;
  const challenge = p.get('c')?.trim() || '';
  const code = p.get('k')?.trim() || '';
  if (!challenge || !/^\d{6}$/.test(code)) return null;
  return { challenge, code };
}
