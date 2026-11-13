import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { auth } from './firebase';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';
const client = axios.create({ baseURL, withCredentials: true });

let csrfToken: Promise<string> | null = null;

function getCsrfToken(force = false) {
  if (!csrfToken || force) {
    csrfToken = client.get<{ token: string }>('/api/security/csrf-token').then((response) => response.data.token);
    csrfToken.catch(() => { csrfToken = null; });
  }
  return csrfToken;
}

async function buildHeaders(includeCsrf: boolean, forceCsrf = false) {
  const headers: Record<string, string> = {};
  const token = await auth.currentUser?.getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeCsrf) headers['x-csrf-token'] = await getCsrfToken(forceCsrf);
  return headers;
}

async function send<T>(method: 'get' | 'post' | 'delete', url: string, body: unknown, config: AxiosRequestConfig, retry = true): Promise<{ data: T }> {
  const mutating = method !== 'get';
  const headers = { ...(await buildHeaders(mutating, !retry)), ...(config.headers || {}) };
  try {
    return await client.request<T>({ ...config, method, url, data: body, headers });
  } catch (error) {
    // The CSRF cookie expires after two hours; fetch a fresh pair once and retry.
    const status = (error as AxiosError).response?.status;
    const message = (error as AxiosError<{ error?: string }>).response?.data?.error || '';
    if (retry && mutating && status === 403 && message.includes('security check')) {
      return send<T>(method, url, body, config, false);
    }
    throw error;
  }
}

export const apiGet = <T = any>(url: string, config: AxiosRequestConfig = {}) => send<T>('get', url, undefined, config);
export const apiPost = <T = any>(url: string, body?: unknown, config: AxiosRequestConfig = {}) => send<T>('post', url, body ?? {}, config);
export const apiDelete = <T = any>(url: string, body?: unknown, config: AxiosRequestConfig = {}) => send<T>('delete', url, body, config);

/** Human-readable message from any API or network error. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const axiosError = error as AxiosError<{ error?: string; details?: Array<{ path?: string[]; message?: string }> }>;
  const data = axiosError?.response?.data;
  if (data?.error === 'Invalid request body' && Array.isArray(data.details) && data.details[0]) {
    const issue = data.details[0];
    return `Please check “${issue.path?.join(' ') || 'your details'}” and try again.`;
  }
  if (data?.error) return data.error;
  if (axiosError?.code === 'ERR_NETWORK') return 'We can’t connect right now. Please check your internet and try again.';
  return error instanceof Error && error.message ? error.message : fallback;
}
