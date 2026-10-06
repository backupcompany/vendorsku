import { useCallback } from 'react';
import { VendorProfile, BusinessScope } from '../types';
import { patchVendor } from '../../../core/api/session';
import { useSessionStore } from '../../../core/session/store';

export function useVendorProfile() {
  const sessionVendor = useSessionStore((state) => state.vendor);

  const updateVendorProfile = useCallback(
    async (vendorId: string, updates: Partial<VendorProfile>): Promise<VendorProfile> => {
      const saved = await patchVendor(vendorId, updates);
      if (useSessionStore.getState().vendor?.id === vendorId) {
        useSessionStore.getState().setVendor(saved);
      }
      return saved;
    },
    []
  );

  const updateBusinessScope = useCallback(
    async (vendorId: string, scope: BusinessScope) => {
      await updateVendorProfile(vendorId, { businessScope: scope });
    },
    [updateVendorProfile]
  );

  const resetVendorSession = useCallback(() => {
    useSessionStore.getState().clearVendor();
  }, []);

  return {
    // The vendor portal only renders after sign-in, so the session vendor is set there.
    currentVendor: sessionVendor as VendorProfile,
    isIdentified: Boolean(sessionVendor),
    updateBusinessScope,
    updateVendorProfile,
    resetVendorSession,
    logoutVendor: resetVendorSession,
  };
}
