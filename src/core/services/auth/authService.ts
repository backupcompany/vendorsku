import { useSessionStore } from '../../session/store';
import { AdminUser } from '../../types';

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
}

export const authService = new AuthService();
