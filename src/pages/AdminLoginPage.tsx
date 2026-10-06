import React, { useState } from 'react';
import { SiloamLogo } from '../core/ui/SiloamLogo';
import { AdminUser } from '../core/types';
import { OtpChallenge, startSignIn } from '../core/api/session';
import { OtpCodeForm } from '../core/ui/OtpCodeForm';
import { ForgotPasswordForm } from '../core/ui/ForgotPasswordForm';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Sun,
  Moon,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';

interface AdminLoginPageProps {
  onLoginSuccess: (admin: AdminUser) => void;
  onNavigateVendor: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onNavigateVendor,
  isDark,
  onToggleTheme,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [otp, setOtp] = useState<OtpChallenge | null>(null);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetNotice, setResetNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId) {
      setErrorMsg('Masukkan username atau email staf Siloam.');
      return;
    }
    if (cleanId.includes('@') ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanId) : /\s/.test(cleanId)) {
      setErrorMsg('Format username atau email staf belum benar.');
      return;
    }
    if (!password) {
      setErrorMsg('Masukkan password akun staf.');
      return;
    }

    setIsLoading(true);

    try {
      setOtp(await startSignIn('staff', cleanId, password));
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Gagal login. Periksa username dan password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#07132B] text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-[#1B3F9B] selection:text-white transition-colors duration-200">
      
      {/* Top Bar */}
      <header className="w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-8 py-3 dark:border-slate-800 dark:bg-[#091838]/90">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SiloamLogo size="sm" variant="full" />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1B3F9B]/10 text-[#1B3F9B] dark:bg-blue-900/40 dark:text-blue-300 border border-[#1B3F9B]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E5A823]" />
              Internal ERP & Procurement Governance
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onNavigateVendor}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B2361] dark:text-blue-300 hover:underline px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Portal Rekanan Vendor</span>
            </button>

            <button
              onClick={onToggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-[#1B3F9B] transition-colors shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="h-4 w-4 text-[#E5A823]" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-md space-y-5">
          
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-6">
            
            {/* Header */}
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#1B3F9B] to-[#2A5CD6] text-white shadow-lg shadow-[#1B3F9B]/30">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h1 className="text-xl sm:text-2xl font-siloam font-bold text-[#0B2361] dark:text-white">
                Login Staf Internal Siloam
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Akses terbatas untuk Evaluator Tender, Procurement Officer & Manajemen RS Siloam
              </p>
            </div>

            {otp ? (
              <OtpCodeForm
                challenge={otp}
                onVerified={(account) => account.kind === 'staff' && onLoginSuccess(account.staff)}
                onResend={() => startSignIn('staff', identifier.trim().toLowerCase(), password)}
                onCancel={() => {
                  setOtp(null);
                  setPassword('');
                }}
              />
            ) : forgotPassword ? (
              <ForgotPasswordForm
                realm="staff"
                initialIdentifier={identifier}
                onCancel={() => setForgotPassword(false)}
                onDone={() => {
                  setForgotPassword(false);
                  setPassword('');
                  setResetNotice('Password baru sudah disimpan. Masuk dengan password itu.');
                }}
              />
            ) : (
            <>
            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            {resetNotice && !errorMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                {resetNotice}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email / Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email Korporat / Username
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={120}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="nama@siloamhospitals.com atau username"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-2 focus:ring-[#1B3F9B]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password Akun Staf
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="current-password"
                    autoComplete="current-password"
                    maxLength={128}
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-2 focus:ring-[#1B3F9B]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute inset-y-0 right-0 my-auto mr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {capsLockOn && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Caps Lock aktif.</p>}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1B3F9B] to-[#2552C7] py-2.5 px-4 text-xs font-siloam font-bold text-white shadow-lg shadow-[#1B3F9B]/25 hover:from-[#153482] hover:to-[#1B3F9B] focus:outline-none focus:ring-2 focus:ring-[#1B3F9B]/40 disabled:opacity-60 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <span>Memverifikasi Staf...</span>
                ) : (
                  <>
                    <span>Masuk ke Panel ERP Siloam</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotPassword(true);
                  setErrorMsg('');
                  setResetNotice('');
                }}
                className="w-full text-center text-[11px] font-semibold text-[#1B3F9B] hover:underline dark:text-blue-400 cursor-pointer"
              >
                Lupa password?
              </button>
            </form>
            </>
            )}

          </div>

          {/* Footer note */}
          <div className="text-center text-[11px] text-slate-500 dark:text-slate-400">
            Sistem Sourcing & Manajemen Pengadaan Medis Siloam Hospitals Group © 2026
          </div>
        </div>
      </main>

      {/* Corporate footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white/80 py-3 px-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-[#091838]/80 dark:text-slate-400">
        PT Siloam International Hospitals Tbk · Layanan Pengadaan Medis Terpusat
      </footer>
    </div>
  );
};
