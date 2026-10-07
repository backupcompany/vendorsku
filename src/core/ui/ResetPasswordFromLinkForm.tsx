import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { completePasswordReset } from '../api/session';
import { passwordProblem, passwordRules } from '../auth/signInRules';
import { PasswordChecklist } from './PasswordChecklist';
import { navigate } from '../router/useAppRouter';

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
      const path = window.location.pathname.startsWith('/admin') ? '/admin' : '/';
      navigate(path, { replace: true });
      onDone();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan password baru.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        Tautan email sudah diverifikasi. Isi password baru dan konfirmasinya — tidak perlu password lama.
      </p>
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
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
