import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAppRouter } from './core/router/useAppRouter';
import { Header } from './core/ui/Header';
import { VendorLandingPage } from './pages/VendorLandingPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { useAdminAuth } from './core/services/auth/useAdminAuth';
import { SessionRealm, useSessionStore } from './core/session/store';
import { useActiveHospitalCount } from './core/api/options';
import { restoreSession } from './core/api/session';
import { readResetLinkParams, ResetPasswordFromLinkForm } from './core/ui/ResetPasswordFromLinkForm';
import { AdminUser, VendorProfile, BusinessScope } from './core/types';

const VendorPortalPage = lazy(() => import('./pages/VendorPortalPage').then((m) => ({ default: m.VendorPortalPage })));
const AdminErpLayout = lazy(() => import('./pages/AdminErpLayout').then((m) => ({ default: m.AdminErpLayout })));

const PageLoader: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400" role="status">
    {label}
  </div>
);

export default function App() {
  const { isAdmin, adminSubRoute, navigate } = useAppRouter();
  const adminAuth = useAdminAuth();
  const [isDark, setIsDark] = useState(false);

  const sessionVendor = useSessionStore((state) => state.vendor);
  const setSessionVendor = useSessionStore((state) => state.setVendor);
  const clearVendorSession = useSessionStore((state) => state.clearVendor);
  const resetVendorSession = () => {
    clearVendorSession();
    navigate('/', { replace: true });
  };

  // A reload keeps the HttpOnly session cookie; ask the API who is signed in before rendering any page.
  const realm: SessionRealm = isAdmin ? 'staff' : 'vendor';
  const [checkedRealms, setCheckedRealms] = useState<SessionRealm[]>([]);
  useEffect(() => {
    if (checkedRealms.includes(realm)) return;
    let live = true;
    restoreSession(realm)
      .then((who) => {
        if (!live || !who) return;
        if (realm === 'staff') adminAuth.setAdminUser(who as AdminUser);
        else setSessionVendor(who as VendorProfile);
      })
      .finally(() => live && setCheckedRealms((done) => [...done, realm]));
    return () => {
      live = false;
    };
  }, [realm]);

  const hospitalCount = useActiveHospitalCount();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleLandingLoginSuccess = (
    vendorData: VendorProfile,
    _isNewSupplier: boolean,
    scope?: BusinessScope
  ) => {
    setSessionVendor({
      ...vendorData,
      businessScope: scope ?? vendorData.businessScope,
    });
  };

  if (!checkedRealms.includes(realm)) {
    return <PageLoader label="Memeriksa sesi…" />;
  }

  // Email "Atur Password Baru" link works even if user still has an open session.
  const resetLink = readResetLinkParams(typeof window !== 'undefined' ? window.location.search : '');
  if (resetLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Atur Password Baru</h1>
          <ResetPasswordFromLinkForm
            challenge={resetLink.challenge}
            code={resetLink.code}
            onDone={() => {
              clearVendorSession();
              adminAuth.logout();
              window.location.assign(isAdmin ? '/admin' : '/');
            }}
          />
        </div>
      </div>
    );
  }

  // 1. If path is /admin (or /admin/tender, /admin/erp, /admin/ai-logs) -> Internal ERP
  if (isAdmin) {
    if (!adminAuth.isAuthenticated) {
      return (
        <AdminLoginPage
          onLoginSuccess={(admin) => {
            adminAuth.setAdminUser(admin);
          }}
          onNavigateVendor={() => navigate('/')}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
      );
    }

    return (
      <div className="animate-in fade-in duration-500">
      <Suspense fallback={<PageLoader label="Memuat panel staf…" />}>
      <AdminErpLayout
        currentSubRoute={adminSubRoute}
        onNavigate={navigate}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        adminUser={adminAuth.adminUser}
        onLogout={adminAuth.logout}
      />
      </Suspense>
      </div>
    );
  }

  // 2. Initial Vendor Landing Page (Dedicated Full Screen Login / Registration Page)
  // Shown when vendor is not yet identified/logged in
  if (!sessionVendor) {
    return (
      <VendorLandingPage
        onLoginSuccess={handleLandingLoginSuccess}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
    );
  }

  // 3. Authenticated Vendor Portal at '/' (Halaman Utama Rekanan)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100 flex flex-col animate-in fade-in duration-500">
      {/* Main Vendor Content with Integrated Excel Ribbon Header */}
      <main className="flex-1 w-full">
        <Suspense fallback={<PageLoader label="Memuat portal rekanan…" />}>
          <VendorPortalPage
            onLogoutOrChangeCompany={resetVendorSession}
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        </Suspense>
      </main>

      {/* Quiet Corporate Footer for Vendor */}
      <footer className="border-t border-slate-200 bg-white py-4 transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-5 lg:px-6 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Portal Pengadaan Vendor
            </span>
            <span>·</span>
            <span>Procurement & Supply Chain Division</span>
          </div>

          <div className="flex items-center gap-4">
            <span>Standar Penamaan SKU 4 Bagian</span>
            <span>·</span>
            <span>Coverage Rumah Sakit Terstandarisasi</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
