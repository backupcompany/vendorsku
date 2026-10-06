import { useCallback, useState } from 'react';
import { AdminUser } from '../../types';
import { useSessionStore } from '../../session/store';
import { authService } from './authService';

export function useAdminAuth() {
  const adminUser = useSessionStore((state) => state.staff);
  const setStaff = useSessionStore((state) => state.setStaff);
  const clearStaff = useSessionStore((state) => state.clearStaff);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const login = useCallback(async (identifier: string, passwordAttempt: string): Promise<AdminUser> => {
    setIsLoading(true);
    setAuthError('');
    try {
      return await authService.adminLogin(identifier, passwordAttempt);
    } catch (err: any) {
      const msg = err.message || 'Gagal login sebagai staf Siloam.';
      setAuthError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearStaff();
    setAuthError('');
  }, [clearStaff]);

  return {
    adminUser,
    isAuthenticated: Boolean(adminUser),
    setAdminUser: setStaff,
    login,
    logout,
    isLoading,
    authError,
    setAuthError,
  };
}
