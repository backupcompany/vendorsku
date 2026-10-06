import { create } from 'zustand';
import { AdminUser, VendorProfile } from '../types';

// Wipe what older builds left in the browser; nothing is read back.
for (const key of ['siloam_active_vendor_id', 'siloam_active_admin_session', 'siloam_vendor_onboarded', 'siloam_theme']) {
  localStorage.removeItem(key);
}
indexedDB.deleteDatabase('siloam_sku_portal_db');

export type SessionRealm = 'staff' | 'vendor';

// The staff panel lives under /admin; everything else is the vendor portal.
export const currentRealm = (): SessionRealm => (window.location.pathname.startsWith('/admin') ? 'staff' : 'vendor');

// Tokens live in HttpOnly cookies set by the API; this store only holds who is signed in.
type SessionState = {
  vendor: VendorProfile | null;
  staff: AdminUser | null;
  setVendor: (vendor: VendorProfile | null) => void;
  setStaff: (staff: AdminUser | null) => void;
  clearVendor: () => void;
  clearStaff: () => void;
};

function signOut(realm: SessionRealm) {
  fetch('/api/sign-out', { method: 'POST', headers: { 'X-Session-Realm': realm } }).catch(() => {});
}

export const useSessionStore = create<SessionState>((set) => ({
  vendor: null,
  staff: null,
  setVendor: (vendor) => set({ vendor }),
  setStaff: (staff) => set({ staff }),
  clearVendor: () => {
    signOut('vendor');
    set({ vendor: null });
  },
  clearStaff: () => {
    signOut('staff');
    set({ staff: null });
  },
}));
