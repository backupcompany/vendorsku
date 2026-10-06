import { useSessionStore } from '../../session/store';
import { changePassword } from '../../api/session';
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

  /** Persist a new password hash for the signed-in vendor or staff account. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await changePassword(currentPassword, newPassword);
  }
}

export const authService = new AuthService();
