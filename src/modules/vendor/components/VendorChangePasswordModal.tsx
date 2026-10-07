import React, { useState } from 'react';
import { X, KeyRound, MailCheck, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { requestPasswordResetLink } from '../../../core/api/session';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountName: string;
}

/** Ganti password = kirim tautan ke email, lalu form password baru + konfirmasi. */
export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  accountName,
}) => {
  const [errorMsg, setErrorMsg] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const challenge = await requestPasswordResetLink();
      setSentTo(challenge.email);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setErrorMsg('');
    setSentTo('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ganti Password</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]">{accountName}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {sentTo ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="space-y-1">
                <p className="font-semibold">Link sudah dikirim ke {sentTo}</p>
                <p className="leading-relaxed">
                  Buka email Anda, klik <strong>Atur Password Baru</strong>, lalu tetapkan password baru Anda.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-[#1B3F9B]/20 bg-[#1B3F9B]/5 p-3.5 text-xs text-slate-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-slate-200">
              <MailCheck className="h-5 w-5 shrink-0 text-[#1B3F9B] dark:text-blue-300" />
              <p className="leading-relaxed">
                Kami akan mengirim tautan ke email akun Anda. Buka tautan tersebut untuk menetapkan password baru.
              </p>
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSend()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1B3F9B] hover:bg-[#153482] py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Mengirim…' : 'Kirim Link ke Email'}</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Batal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/** @deprecated use ChangePasswordModal */
export const VendorChangePasswordModal = ChangePasswordModal;
