import { useSessionStore } from '../../session/store';
import { AdminUser, VendorProfile } from '../../types';

export class AuthService {
  adminLogout(): void {
    useSessionStore.getState().clearStaff();
  }

  getCurrentAdmin(): AdminUser | null {
    return useSessionStore.getState().staff;
  }

  isAdminAuthenticated(): boolean {
    return Boolean(this.getCurrentAdmin());
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
