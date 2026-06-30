import axios from 'axios';
import toast from 'react-hot-toast';
import type { Document, Version, Collaborator, Comment } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// ── Token storage (in memory, not localStorage) ───────────────────────────────
let accessToken: string | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken() { return accessToken; }

// ── Request interceptor: attach Bearer token ──────────────────────────────────
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const isAuthRoute = original.url?.includes('/auth/login') || original.url?.includes('/auth/register') || original.url?.includes('/auth/refresh');

    // Show generic error for network errors or 500+ status codes
    if (!error.response || error.response.status >= 500) {
      toast.error('Unable to connect to the server. Please check your network or try again later.', { id: 'network-err' });
    }

    if (error.response?.status !== 401 || original._retried || isAuthRoute) {
      return Promise.reject(error);
    }
    original._retried = true;

    try {
      if (!refreshing) {
        refreshing = api.post<{ accessToken: string }>('/auth/refresh')
          .then((r) => { accessToken = r.data.accessToken; return accessToken!; })
          .finally(() => { refreshing = null; });
      }
      await refreshing;
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch {
      accessToken = null;
      window.location.href = '/login';
      return Promise.reject(error);
    }
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  register: (data: { email: string; name: string; password: string }) =>
    api.post<{ accessToken: string; user: { id: string; email: string; name: string } }>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ accessToken: string; user: { id: string; email: string; name: string } }>('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  refresh: () => api.post<{ accessToken: string; user: { id: string; email: string; name: string } }>('/auth/refresh'),

  me: () => api.get<{ id: string; email: string; name: string }>('/auth/me'),
};

// ── Documents ─────────────────────────────────────────────────────────────────
export const docs = {
  list: (params?: { search?: string; limit?: number; offset?: number }) =>
    api.get<{ documents: Document[]; total: number }>('/docs', { params }),

  get: (id: string) => api.get<Document & { role: string }>(`/docs/${id}`),

  create: (title?: string) => api.post<{ id: string; title: string }>('/docs', { title }),

  update: (id: string, data: { title?: string; is_public?: boolean }) =>
    api.patch(`/docs/${id}`, data),

  delete: (id: string) => api.delete(`/docs/${id}`),

  share: (id: string, data: { email: string; role: 'viewer' | 'commenter' | 'editor' }) =>
    api.post(`/docs/${id}/share`, data),

  unshare: (id: string, userId: string) =>
    api.delete(`/docs/${id}/share/${userId}`),

  collaborators: (id: string) =>
    api.get<Collaborator[]>(`/docs/${id}/collaborators`),

  versions: (id: string) =>
    api.get<Version[]>(`/docs/${id}/versions`),

  getVersion: (id: string, versionId: string) =>
    api.get<Version>(`/docs/${id}/versions/${versionId}`),

  saveVersion: (id: string, label?: string) =>
    api.post<{ id: string }>(`/docs/${id}/versions`, { label }),

  restoreVersion: (id: string, versionId: string) =>
    api.post(`/docs/${id}/versions/${versionId}/restore`),
};

// ── Comments ──────────────────────────────────────────────────────────────────
export const comments = {
  list: (docId: string) =>
    api.get<Comment[]>(`/docs/${docId}/comments`),

  create: (docId: string, data: { content: string; range_json?: { from: number; to: number; text?: string }; parent_id?: string }) =>
    api.post<{ id: string }>(`/docs/${docId}/comments`, data),

  update: (docId: string, commentId: string, data: { content?: string; resolved?: boolean }) =>
    api.patch(`/docs/${docId}/comments/${commentId}`, data),

  delete: (docId: string, commentId: string) =>
    api.delete(`/docs/${docId}/comments/${commentId}`),
};

export default api;
