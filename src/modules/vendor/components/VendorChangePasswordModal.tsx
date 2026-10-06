import React, { useState } from 'react';
import { X, Lock, KeyRound, ShieldCheck, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { authService } from '../../../core/services/auth/authService';
import { passwordProblem } from '../../../core/auth/signInRules';

interface VendorChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  vendorName: string;
  onPasswordChanged?: () => void;
}

export const VendorChangePasswordModal: React.FC<VendorChangePasswordModalProps> = ({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  onPasswordChanged,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Strength computation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: '', color: 'bg-slate-200' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 1, text: 'Lemah', color: 'bg-rose-500' };
    if (score === 2 || score === 3) return { score: 2, text: 'Sedang', color: 'bg-amber-500' };
    if (score === 4) return { score: 3, text: 'Kuat', color: 'bg-blue-600' };
    return { score: 4, text: 'Sangat Kuat', color: 'bg-emerald-600' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const problem = passwordProblem(newPassword);
    if (problem) {
      setErrorMsg(problem);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok dengan password baru.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.vendorCreatePassword(vendorId, newPassword);
      setSuccessMsg('Password akun rekanan berhasil diperbarui!');
      onPasswordChanged?.();
      setTimeout(() => {
        onClose();
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMsg('');
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah password rekanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Buat / Ubah Password Rekanan
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                {vendorName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Password Baru <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 karakter, huruf + angka"
                required
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute inset-y-0 right-0 my-auto mr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Strength indicator */}
            {newPassword.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Kekuatan password:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{strength.text}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${(strength.score / 4) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Konfirmasi Password Baru <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                required
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            {confirmPassword.length > 0 && (
              <div className="text-[10px] pt-0.5">
                {newPassword === confirmPassword ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Password cocok
                  </span>
                ) : (
                  <span className="text-rose-500 font-semibold">Password belum cocok</span>
                )}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Boolean(passwordProblem(newPassword)) || newPassword !== confirmPassword}
              className="flex items-center gap-1.5 rounded-xl bg-[#1B3F9B] hover:bg-[#153482] px-4 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
