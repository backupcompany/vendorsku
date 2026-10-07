import { useCallback, useMemo, useSyncExternalStore } from 'react';

export type AdminSubRoute = 'tender' | 'erp' | 'vendors' | 'hospitals' | 'ai_logs' | 'discovery';

export interface AppRoute {
  pathname: string;
  isAdmin: boolean;
  adminSubRoute: AdminSubRoute;
}

const ADMIN_ROUTES: [prefix: string, route: AdminSubRoute][] = [
  ['/admin/erp', 'erp'],
  ['/admin/vendors', 'vendors'],
  ['/admin/hospitals', 'hospitals'],
  ['/admin/ai-logs', 'ai_logs'],
  ['/admin/discovery', 'discovery'],
  ['/admin/tender', 'tender'],
];

function parseLocation(pathname: string): AppRoute {
  const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const isAdmin = cleanPath === '/admin' || cleanPath.startsWith('/admin/');
  const match = ADMIN_ROUTES.find(([prefix]) => cleanPath === prefix || cleanPath.startsWith(prefix + '/'));
  return { pathname: cleanPath || '/', isAdmin, adminSubRoute: match ? match[1] : 'tender' };
}

// One history listener for the whole app; every hook reads the same location snapshot.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
window.addEventListener('popstate', notify);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const currentHref = () => window.location.pathname + window.location.search;

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (currentHref() === to) return;
  window.history[options.replace ? 'replaceState' : 'pushState']({}, '', to);
  notify();
}

export function useAppRouter() {
  const href = useSyncExternalStore(subscribe, currentHref);
  const route = useMemo(() => parseLocation(href.split('?')[0]), [href]);
  return { ...route, navigate };
}

/** A tab kept in ?key=, so reloading or sharing the URL reopens it; unknown values fall back to the first tab. */
export function useUrlTab<T extends string>(key: string, tabs: readonly T[]): [T, (tab: T) => void] {
  const href = useSyncExternalStore(subscribe, currentHref);
  const raw = new URLSearchParams(href.split('?')[1] ?? '').get(key);
  const tab = tabs.includes(raw as T) ? (raw as T) : tabs[0];
  const setTab = useCallback(
    (next: T) => {
      const params = new URLSearchParams(window.location.search);
      if (next === tabs[0]) params.delete(key);
      else params.set(key, next);
      const query = params.toString();
      navigate(window.location.pathname + (query ? `?${query}` : ''));
    },
    [key, tabs],
  );
  return [tab, setTab];
}
