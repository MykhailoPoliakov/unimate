import Constants from 'expo-constants';
import { Platform } from 'react-native';

function defaultBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return `http://${host}:8000`;
  return 'http://127.0.0.1:8000';
}

export const API_BASE_URL = defaultBaseUrl();

export class ApiError extends Error {
  constructor(status, detail, retryAfter = null) {
    const message =
      typeof detail === 'string'
        ? detail
        : detail?.code === 'cooldown'
          ? `cooldown:${detail.retry_after}`
          : Array.isArray(detail)
            ? JSON.stringify(detail)
            : `Request failed (${status})`;
    super(message);
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter ?? (typeof detail?.retry_after === 'number' ? detail.retry_after : null);
  }
}

export function cooldownMessage(error, t, fallback) {
  const seconds = error?.retryAfter;
  if (error?.status !== 429 || !Number.isFinite(seconds)) return fallback;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return t('postCooldown', { n: minutes });
}

async function request(path, { method = 'GET', body, userId } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (userId) headers['X-User-Id'] = String(userId);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const detail = data?.detail ?? data;
    throw new ApiError(response.status, detail);
  }
  return data;
}

export const api = {
  get: (path, userId) => request(path, { userId }),
  post: (path, body, userId) => request(path, { method: 'POST', body, userId }),
  put: (path, body, userId) => request(path, { method: 'PUT', body, userId }),
  patch: (path, body, userId) => request(path, { method: 'PATCH', body, userId }),
  delete: (path, userId) => request(path, { method: 'DELETE', userId }),
};

export function listInstitutions() {
  return api.get('/institutions');
}

export function listPrograms(slug) {
  return api.get(`/institutions/${slug}/programs`);
}

export function createUser(payload) {
  return api.post('/users', payload);
}

export function readUser(userId) {
  return api.get(`/users/${userId}`);
}

export function updateUser(userId, payload) {
  return api.patch(`/users/${userId}`, payload);
}

export function updateUserRole(adminId, userId, role) {
  return api.patch(`/users/${encodeURIComponent(userId)}/role`, { role }, adminId);
}

export function updatePushDevice(userId, token, enabled) {
  return api.put('/notifications/device', { token, enabled }, userId);
}

export function listButtons(userId) {
  return api.get('/buttons', userId);
}

export function listNews(userId) {
  return api.get('/news', userId);
}

export function createNews(userId, payload) {
  return api.post('/news', payload, userId);
}

export function updateNews(userId, newsId, payload) {
  return api.patch(`/news/${newsId}`, payload, userId);
}

export function deleteNews(userId, newsId) {
  return api.delete(`/news/${newsId}`, userId);
}

export function listManagedNews(userId) {
  return api.get('/news/manage', userId);
}

export function getNewsPoll(userId, newsId) {
  return api.get(`/news/${newsId}/poll`, userId);
}

export function voteNewsPoll(userId, newsId, optionIndex) {
  return api.post(`/news/${newsId}/poll`, { option_index: optionIndex }, userId);
}

export function retractNewsPoll(userId, newsId) {
  return api.delete(`/news/${newsId}/poll`, userId);
}

export function listSocials(userId) {
  return api.get('/socials', userId);
}

export function listManageSocials(userId) {
  return api.get('/socials/manage', userId);
}

export function createSocial(userId, payload) {
  return api.post('/socials', payload, userId);
}

export function updateSocial(userId, socialId, payload) {
  return api.patch(`/socials/${socialId}`, payload, userId);
}

export function deleteSocial(userId, socialId) {
  return api.delete(`/socials/${socialId}`, userId);
}
