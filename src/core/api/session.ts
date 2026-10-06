import { z } from 'zod';
import { AdminUser, VendorProfile } from '../types';
import { apiError, http } from './http';
import type { SessionRealm } from '../session/store';

const signInKeySchema = z.object({
  kind: z.string(),
  value: z.string(),
});

const vendorDocSchema = z.object({
  id: z.string(),
  erpVendorCode: z.string().nullish(),
  companyName: z.string(),
  npwp: z.string().nullish(),
  address: z.string().nullish(),
  verified: z.boolean(),
  status: z.enum(['prospect', 'identified', 'verified']),
  isExistingSupplier: z.boolean().optional(),
  source: z.enum(['erp_upload', 'self_registered', 'manual_admin']).optional(),
  registrationDate: z.string().nullish(),
  category: z.string().nullish(),
  notes: z.string().nullish(),
  pic: z.object({
    name: z.string().nullish(),
    email: z.string(),
    phone: z.string(),
  }),
  signIn: z.array(signInKeySchema).default([]),
  businessScope: z.object({
    level1: z.string(),
    level2List: z.array(z.string()),
  }).nullish(),
  commercialTerms: z.unknown().nullish(),
});

const staffDocSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['super_admin', 'procurement_officer', 'evaluator', 'auditor']),
  roleTitle: z.string(),
  department: z.string(),
  hospitalUnit: z.string().nullish(),
  signIn: z.array(signInKeySchema),
});

const otpChallengeSchema = z.object({
  otpRequired: z.literal(true),
  challenge: z.string().min(1),
  email: z.string(),
  expiresIn: z.number(),
  resendIn: z.number(),
});
export type OtpChallenge = z.infer<typeof otpChallengeSchema>;

export type VendorDoc = z.infer<typeof vendorDocSchema>;

export function vendorFromDoc(doc: VendorDoc): VendorProfile {
  return {
    id: doc.id,
    erpVendorCode: doc.erpVendorCode || undefined,
    companyName: doc.companyName,
    email: doc.pic.email,
    phone: doc.pic.phone,
    npwp: doc.npwp || '',
    address: doc.address || undefined,
    authorizedPerson: doc.pic.name || '',
    verified: doc.verified,
    status: doc.status,
    isExistingSupplier: doc.isExistingSupplier,
    source: doc.source,
    registrationDate: doc.registrationDate || undefined,
    businessScope: doc.businessScope || undefined,
    commercialTerms: doc.commercialTerms as VendorProfile['commercialTerms'],
    category: doc.category || undefined,
    notes: doc.notes || undefined,
  };
}

function staffFromDoc(doc: z.infer<typeof staffDocSchema>): AdminUser {
  return {
    id: doc.id,
    username: doc.signIn.find((key) => key.kind === 'username')?.value || '',
    email: doc.signIn.find((key) => key.kind === 'email')?.value || '',
    name: doc.name,
    role: doc.role,
    roleTitle: doc.roleTitle,
    department: doc.department,
    hospitalUnit: doc.hospitalUnit || undefined,
  };
}

async function post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  try {
    const res = await http.post(path, body);
    return schema.parse(res.data);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data server tidak sesuai.');
    throw apiError(err, 'Gagal menghubungi server.');
  }
}

/** A correct password only starts sign-in; the session exists after verifySignInCode. */
export function startSignIn(realm: SessionRealm, identifier: string, password: string): Promise<OtpChallenge> {
  return post(realm === 'staff' ? '/api/staff/sign-in' : '/api/sign-in', { identifier, password }, otpChallengeSchema);
}

export type VerifiedAccount = { kind: 'vendor'; vendor: VendorProfile } | { kind: 'staff'; staff: AdminUser };

export async function verifySignInCode(challenge: string, code: string): Promise<VerifiedAccount> {
  const data = await post(
    '/api/sign-in/verify',
    { challenge, code },
    z.object({ kind: z.enum(['vendor', 'staff']), vendor: vendorDocSchema.optional(), staff: staffDocSchema.optional() })
  );
  if (data.kind === 'vendor' && data.vendor) return { kind: 'vendor', vendor: vendorFromDoc(data.vendor) };
  if (data.kind === 'staff' && data.staff) return { kind: 'staff', staff: staffFromDoc(data.staff) };
  throw new Error('Akun tidak dikembalikan server.');
}

/** Self-registration: the account is created, then the PIC email must confirm a code before any session. */
export async function signUpVendor(form: {
  companyName: string;
  email: string;
  phone: string;
  authorizedPerson?: string;
  npwp?: string;
  password: string;
}): Promise<OtpChallenge> {
  return post('/api/vendors', form, otpChallengeSchema);
}

/** Reads the cookie session after a reload; null when the realm is signed out. */
export async function restoreSession(realm: SessionRealm): Promise<VendorProfile | AdminUser | null> {
  try {
    const { data } = await http.get('/api/session');
    const parsed = z.object({ vendor: vendorDocSchema.optional(), staff: staffDocSchema.optional() }).parse(data);
    if (realm === 'vendor') return parsed.vendor ? vendorFromDoc(parsed.vendor) : null;
    return parsed.staff ? staffFromDoc(parsed.staff) : null;
  } catch {
    return null;
  }
}

export async function deleteVendorDoc(id: string): Promise<void> {
  try {
    await http.delete(`/api/vendors/${encodeURIComponent(id)}`);
  } catch (err) {
    throw apiError(err, 'Rekanan gagal dihapus.');
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await http.post('/api/password', { currentPassword, newPassword });
  } catch (err) {
    throw apiError(err, 'Gagal mengubah password.');
  }
}

export async function patchVendor(id: string, updates: Partial<VendorProfile>): Promise<VendorProfile> {
  try {
    const res = await http.patch(`/api/vendors/${encodeURIComponent(id)}`, updates);
    return vendorFromDoc(vendorDocSchema.parse(res.data));
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data server tidak sesuai.');
    throw apiError(err, 'Profil gagal disimpan.');
  }
}

export async function fetchStaffVendors(): Promise<{
  vendors: VendorProfile[];
  offerCounts: Record<string, number>;
}> {
  try {
    const { data } = await http.get('/api/staff/vendors');
    const rows = z.array(vendorDocSchema.extend({ offerCount: z.number() })).parse(data);
    return {
      vendors: rows.map(vendorFromDoc),
      offerCounts: Object.fromEntries(rows.map((row) => [row.id, row.offerCount])),
    };
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data rekanan tidak sesuai.');
    throw apiError(err, 'Daftar rekanan gagal dimuat.');
  }
}

export async function registerVendor(form: {
  companyName: string;
  email: string;
  phone: string;
  authorizedPerson?: string;
  npwp?: string;
  password?: string;
}): Promise<VendorProfile> {
  try {
    const res = await http.post('/api/vendors', form);
    return vendorFromDoc(z.object({ vendor: vendorDocSchema }).parse(res.data).vendor);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data server tidak sesuai.');
    throw apiError(err, 'Gagal menyimpan data rekanan.');
  }
}
