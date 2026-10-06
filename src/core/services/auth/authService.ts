import { registerVendor, signInStaff, signInVendor } from '../../api/session';
import { useSessionStore } from '../../session/store';
import { AdminUser, VendorProfile } from '../../types';

export class AuthService {
  async adminLogin(identifier: string, passwordAttempt: string): Promise<AdminUser> {
    const admin = await signInStaff(identifier, passwordAttempt);
    useSessionStore.getState().setStaff(admin);
    return admin;
  }

  adminLogout(): void {
    useSessionStore.getState().clearStaff();
  }

  getCurrentAdmin(): AdminUser | null {
    return useSessionStore.getState().staff;
  }

  isAdminAuthenticated(): boolean {
    return Boolean(this.getCurrentAdmin());
  }

  async vendorLogin(identifier: string, passwordAttempt: string): Promise<VendorProfile> {
    // The landing page sets the session vendor once onboarding (business scope) is done.
    return signInVendor(identifier, passwordAttempt);
  }

  async registerVendor(form: {
    companyName: string;
    email: string;
    phone: string;
    authorizedPerson?: string;
    npwp?: string;
    password: string;
  }): Promise<VendorProfile> {
    return registerVendor(form);
  }

  vendorLogout(): void {
    useSessionStore.getState().clearVendor();
  }

  getCurrentVendorId(): string | null {
    return useSessionStore.getState().vendor?.id ?? null;
  }

  async vendorCreatePassword(_vendorId: string, _newPassword: string): Promise<VendorProfile> {
    throw new Error('Pengaturan ulang password menyusul. OTP belum dibuka.');
  }
}

export const authService = new AuthService();
