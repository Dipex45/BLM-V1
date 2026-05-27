import axios, { AxiosRequestConfig } from 'axios';
import { auth } from './firebase';

let csrfToken: string | null = null;

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const { data } = await axios.get('/api/security/csrf-token', { withCredentials: true });
  csrfToken = data.token;
  return csrfToken;
}

export async function getAuthHeaders(includeCsrf = false) {
  const headers: Record<string, string> = {};
  const token = await auth.currentUser?.getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeCsrf) headers['x-csrf-token'] = await getCsrfToken();
  return headers;
}

export async function apiGet<T = any>(url: string, config: AxiosRequestConfig = {}) {
  const headers = await getAuthHeaders(false);
  return axios.get<T>(url, {
    ...config,
    withCredentials: true,
    headers: { ...headers, ...(config.headers || {}) },
  });
}

export async function apiPost<T = any>(url: string, body?: unknown, config: AxiosRequestConfig = {}) {
  const headers = await getAuthHeaders(true);
  return axios.post<T>(url, body, {
    ...config,
    withCredentials: true,
    headers: { ...headers, ...(config.headers || {}) },
  });
}

export async function apiDelete<T = any>(url: string, config: AxiosRequestConfig = {}) {
  const headers = await getAuthHeaders(true);
  return axios.delete<T>(url, {
    ...config,
    withCredentials: true,
    headers: { ...headers, ...(config.headers || {}) },
  });
}

export async function secureFetch(url: string, init: RequestInit = {}) {
  const method = (init.method || 'GET').toUpperCase();
  const includeCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const headers = await getAuthHeaders(includeCsrf);
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
}
