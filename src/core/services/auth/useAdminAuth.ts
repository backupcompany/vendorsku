import { useCallback } from 'react';
import { useSessionStore } from '../../session/store';

export function useAdminAuth() {
  const adminUser = useSessionStore((state) => state.staff);
  const setStaff = useSessionStore((state) => state.setStaff);
  const clearStaff = useSessionStore((state) => state.clearStaff);

  const logout = useCallback(() => clearStaff(), [clearStaff]);

  return {
    adminUser,
    isAuthenticated: Boolean(adminUser),
    setAdminUser: setStaff,
    logout,
  };
}
