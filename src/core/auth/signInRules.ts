// Mirrors passwordProblem in backend/signin.go; the server stays the authority.
const COMMON = new Set([
  'password1', 'password123', 'passw0rd', 'p@ssw0rd', '12345678a', 'a12345678', 'abc12345', 'abcd1234',
  'qwerty123', 'qwerty12', '1qaz2wsx', 'admin123', 'admin1234', 'siloam123', 'siloam2026', 'vendor123',
  'rahasia123', 'bismillah1', 'welcome1', 'iloveyou1',
]);

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72;

export type PasswordRule = { label: string; ok: boolean };

export function passwordRules(password: string, email = ''): PasswordRule[] {
  const lower = password.toLowerCase();
  const local = email.trim().toLowerCase().split('@')[0];
  return [
    { label: `Minimal ${PASSWORD_MIN} karakter`, ok: [...password].length >= PASSWORD_MIN },
    { label: 'Berisi huruf dan angka', ok: /\p{L}/u.test(password) && /\p{N}/u.test(password) },
    { label: 'Tanpa spasi di awal/akhir', ok: password.length > 0 && password.trim() === password },
    { label: 'Bukan password umum, tidak memuat nama email', ok: password.length > 0 && !COMMON.has(lower) && !(local.length >= 4 && lower.includes(local)) },
    { label: `Maksimal ${PASSWORD_MAX_BYTES} karakter`, ok: new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES },
  ];
}

export function passwordProblem(password: string, email = ''): string {
  const failed = passwordRules(password, email).find((rule) => !rule.ok);
  return failed ? `Password belum memenuhi: ${failed.label.toLowerCase()}.` : '';
}

/** Vendor sign-in key: PIC email, or NPWP of 15/16 digits (dots and dashes allowed). */
export function vendorIdentifierProblem(raw: string): string {
  const value = raw.trim();
  if (!value) return 'Masukkan email PIC atau NPWP perusahaan.';
  if (value.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Format email belum benar.';
  const digits = value.replace(/\D/g, '');
  if (/[^\d.\-\s]/.test(value) || (digits.length !== 15 && digits.length !== 16) || /^0+$/.test(digits)) {
    return 'Masuk memakai email PIC atau NPWP 15/16 digit.';
  }
  return '';
}

/** WhatsApp PIC: Indonesian mobile number, written 08…, 628… or +628…. */
export function phoneProblem(raw: string): string {
  const compact = raw.replace(/[\s\-().]/g, '');
  return /^(\+?62|0)8\d{7,12}$/.test(compact) ? '' : 'Nomor WhatsApp harus nomor seluler Indonesia, contoh 0812-3456-7890.';
}
