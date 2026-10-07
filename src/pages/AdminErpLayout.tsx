import React, { useState } from 'react';
import { useActiveHospitalCount } from '../core/api/options';
import { AdminSubRoute } from '../core/router/useAppRouter';
import { AdminUser } from '../core/types';
import { TenderEvaluationPage } from './TenderEvaluationPage';
import { AdminErpPage } from './AdminErpPage';
import { HospitalMasterManager } from '../modules/admin/components/HospitalMasterManager';
import { VendorMasterManager } from '../modules/admin/components/VendorMasterManager';
import { AiTokenLogViewer } from '../modules/admin/components/AiTokenLogViewer';
import { ProcurementDiscoveryPanel } from '../modules/admin/components/ProcurementDiscoveryPanel';
import {
  Layers,
  Database,
  ShieldCheck,
  ExternalLink,
  Sun,
  Moon,
  Menu,
  X,
  Building2,
  Users,
  ChevronRight,
  Sparkles,
  Server,
  Activity,
  CheckCircle2,
  LogOut,
  UserCheck,
  KeyRound,
  Search,
} from 'lucide-react';
import { ChangePasswordModal } from '../modules/vendor/components/VendorChangePasswordModal';

interface AdminErpLayoutProps {
  currentSubRoute: AdminSubRoute;
  onNavigate: (path: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  adminUser?: AdminUser | null;
  onLogout?: () => void;
}

export const AdminErpLayout: React.FC<AdminErpLayoutProps> = ({
  currentSubRoute,
  onNavigate,
  isDark,
  onToggleTheme,
  adminUser,
  onLogout,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const hospitalCount = useActiveHospitalCount();

  const navItems = [
    {
      id: 'tender' as AdminSubRoute,
      path: '/admin/tender',
      label: 'Review Tender',
      sublabel: 'Evaluasi & HPS Siloam',
      icon: Layers,
      badge: 'Penawaran',
    },
    {
      id: 'erp' as AdminSubRoute,
      path: '/admin/erp',
      label: 'Admin ERP',
      sublabel: 'Master SKU & Hak Akses',
      icon: Database,
      badge: 'Katalog RS',
    },
    {
      id: 'discovery' as AdminSubRoute,
      path: '/admin/discovery',
      label: 'Cari Produk & Vendor',
      sublabel: 'Discovery Procurement',
      icon: Search,
      badge: 'Follow-up',
    },
    {
      id: 'vendors' as AdminSubRoute,
      path: '/admin/vendors',
      label: 'Master Data Vendor',
      sublabel: 'Rekanan ERP & Vendor Baru',
      icon: Users,
      badge: 'Rekanan RS',
    },
    {
      id: 'hospitals' as AdminSubRoute,
      path: '/admin/hospitals',
      label: 'Master Rumah Sakit',
      sublabel: 'Unit RS, Kota & Wilayah',
      icon: Building2,
      badge: 'Nasional',
    },
    {
      id: 'ai_logs' as AdminSubRoute,
      path: '/admin/ai-logs',
      label: 'AI Token Log',
      sublabel: 'Audit Trail & Telemetri',
      icon: ShieldCheck,
      badge: 'Gemini AI',
    },
  ];

  const getBreadcrumbTitle = () => {
    switch (currentSubRoute) {
      case 'erp':
        return 'Admin ERP — Kontrol Master SKU & Hak Akses';
      case 'discovery':
        return 'Procurement Discovery — Cari Produk & Vendor Follow-up';
      case 'vendors':
        return 'Admin ERP — Master Data Vendor Rekanan Siloam';
      case 'hospitals':
        return 'Admin ERP — Master Data Rumah Sakit Siloam';
      case 'ai_logs':
        return 'Audit Trail AI & Manajemen Token Gemini';
      case 'tender':
      default:
        return 'Review & Evaluasi Tender Pengadaan RS';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* LEFT NAVIGATION PANE (ALA ENTERPRISE ERP) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 text-slate-200 shadow-2xl transition-transform duration-200 ease-in-out md:static md:translate-x-0 dark:border-r dark:border-slate-800 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header of Left Pane: Corporate Siloam ERP Wordmark */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-base shadow-sm ring-2 ring-blue-400/30">
              S
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>Siloam ERP</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-500/30">
                  Internal
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate">
                Procurement & Supply Chain
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-md"
            aria-label="Tutup Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* System & Hospital Context Tag */}
        <div className="border-b border-slate-800/80 px-4 py-2.5 bg-slate-950/40">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <Server className="h-3 w-3 text-emerald-400" /> SIM-RS / ERP v4.2
            </span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
        </div>

        {/* Navigation Pane Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Modul Internal Siloam
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSubRoute === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.path);
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full group flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-900/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0 ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'bg-slate-800 text-slate-400 group-hover:text-blue-400 group-hover:bg-slate-750'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs truncate">{item.label}</div>
                    <div
                      className={`text-[10px] truncate ${
                        isActive ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                <ChevronRight
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                    isActive ? 'text-white translate-x-0.5' : 'text-slate-500 opacity-60'
                  }`}
                />
              </button>
            );
          })}

          {/* SCM Information card in Left Pane */}
          <div className="pt-6 px-1">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Building2 className="h-3.5 w-3.5 text-blue-400" />
                <span>Coverage Nasional</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Terhubung dengan {hospitalCount ?? '…'} Rumah Sakit Siloam di seluruh Indonesia dengan standardisasi penamaan SKU 4 bagian.
              </p>
              <div className="flex items-center gap-1.5 pt-1 text-[10px] text-emerald-400 font-semibold border-t border-slate-800">
                <CheckCircle2 className="h-3 w-3" />
                <span>Database PostgreSQL Siloam</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: External Navigation back to Vendor Portal */}
        <div className="border-t border-slate-800 p-3 bg-slate-950/70 space-y-2">
          {/* Quick link back to Vendor Portal */}
          <button
            type="button"
            onClick={() => {
              onNavigate('/');
              setIsMobileSidebarOpen(false);
            }}
            className="w-full flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              <span>Buka Portal Vendor</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-300" />
          </button>

          {/* User Persona & Logout */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-2 truncate">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-2xs">
                  {adminUser?.name ? adminUser.name.charAt(0) : 'A'}
                </div>
                <div className="truncate">
                  <div className="font-semibold text-slate-100 truncate text-xs">
                    {adminUser?.name || 'dr. Hendra Parningotan'}
                  </div>
                  <div className="text-[10px] text-blue-300 truncate">
                    {adminUser?.roleTitle || 'Head of Procurement'}
                  </div>
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-rose-800/80 bg-rose-950/40 hover:bg-rose-900/60 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors cursor-pointer"
                title="Keluar dari sesi Admin Siloam"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-400" />
                <span>Logout Staf</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE (ERP CONTENT AREA) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top ERP Action & Breadcrumbs Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-3 sm:px-6 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-900/95">
          {/* Left: Mobile Toggle & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Buka Menu ERP"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span>Siloam ERP Internal</span>
                <span>/</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
                  {getBreadcrumbTitle()}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {currentSubRoute === 'tender' && 'Review & Evaluasi Penawaran Tender'}
                {currentSubRoute === 'erp' && 'Admin Master SKU ERP & Hak Akses'}
                {currentSubRoute === 'vendors' && 'Master Data Rekanan (ERP & Vendor Baru)'}
                {currentSubRoute === 'hospitals' && 'Master Data Unit Rumah Sakit Siloam'}
                {currentSubRoute === 'ai_logs' && 'Audit Trail AI Gemini & Telemetri'}
              </h2>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Switch to Vendor Portal */}
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
              title="Lihat halaman dari sudut pandang Vendor"
            >
              <ExternalLink className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Portal Vendor</span>
            </button>

            {/* Dark/Light mode switch */}
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
              title="Ganti password akun staf"
            >
              <KeyRound className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Ganti Password</span>
            </button>

            <button
              onClick={onToggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
              aria-label="Ganti mode tampilan"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Logout Staf top bar */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-colors shadow-2xs cursor-pointer"
                title="Keluar dari sesi Admin Siloam"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic ERP Sub-page Workspace */}
        <main className="flex-1 w-full p-3 sm:p-5 lg:p-6 overflow-y-auto">
          {currentSubRoute === 'tender' && <TenderEvaluationPage />}
          {currentSubRoute === 'erp' && <AdminErpPage />}
          {currentSubRoute === 'discovery' && <ProcurementDiscoveryPanel />}
          {currentSubRoute === 'vendors' && <VendorMasterManager />}
          {currentSubRoute === 'hospitals' && <HospitalMasterManager />}
          {currentSubRoute === 'ai_logs' && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Audit Trail AI & Manajemen Token
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pemantauan penggunaan token model Gemini, efisiensi prompt, dan riwayat panggilan AI
                </p>
              </div>
              <AiTokenLogViewer />
            </div>
          )}
        </main>

        {/* ERP Footer */}
        <footer className="border-t border-slate-200 bg-white py-3.5 transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Siloam Hospitals Group ERP
              </span>
              <span>·</span>
              <span>Procurement Division (Internal Only)</span>
            </div>
            <div className="text-[11px] text-slate-400">
              SIM-RS Data Integration · Multi-Hospital Master Data Standard
            </div>
          </div>
        </footer>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        accountName={adminUser?.name || adminUser?.email || 'Staf Siloam'}
      />
    </div>
  );
};
