import axios from 'axios';
import { currentRealm, useSessionStore } from '../session/store';

export const http = axios.create();

// The API reads the session cookie only when this header names its realm (CSRF guard).
http.interceptors.request.use((config) => {
  config.headers['X-Session-Realm'] = currentRealm();
  return config;
});

http.interceptors.response.use(undefined, (err) => {
  if (axios.isAxiosError(err) && err.response?.status === 401) {
    const store = useSessionStore.getState();
    if (currentRealm() === 'staff' && store.staff) store.setStaff(null);
    if (currentRealm() === 'vendor' && store.vendor) store.setVendor(null);
  }
  return Promise.reject(err);
});

export function apiError(err: unknown, fallback: string): Error {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.error;
    if (typeof message === 'string' && message) return new Error(message);
  }
  if (err instanceof Error) return err;
  return new Error(fallback);
}
