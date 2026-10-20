import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const CREATE_USER_TIMEOUT_MS = 15_000;

function isTunnelHost(host) {
  return /exp\.direct|exp\.host|ngrok|expo\.dev/i.test(host ?? '');
}

function defaultBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web' && !isTunnelHost(host)) return `http://${host}:8001`;
  return 'http://127.0.0.1:8001';
}

export const API_BASE_URL = defaultBaseUrl();

export class ApiError extends Error {
  constructor(status, detail, retryAfter = null) {
    let message = `Request failed (${status})`;
    if (typeof detail === 'string') {
      message = detail;
    } else if (detail?.code === 'cooldown') {
      message = `cooldown:${detail.retry_after}`;
    } else if (detail?.code === 'request_timeout') {
      message = 'Request timed out';
    } else if (Array.isArray(detail)) {
      message = JSON.stringify(detail);
    }
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

async function request(
  path,
  { method = 'GET', body, userId, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS } = {}
) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (userId) headers['X-User-Id'] = String(userId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
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
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(408, { code: 'request_timeout' });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

export function createInstitution(adminId, payload) {
  return api.post('/institutions', payload, adminId);
}

export function updateInstitution(adminId, slug, name) {
  return api.patch(`/institutions/${encodeURIComponent(slug)}`, { name }, adminId);
}

export function deleteInstitution(adminId, slug) {
  return api.delete(`/institutions/${encodeURIComponent(slug)}`, adminId);
}

export function createProgram(adminId, institutionSlug, payload) {
  return api.post(
    `/institutions/${encodeURIComponent(institutionSlug)}/programs`,
    payload,
    adminId
  );
}

export function updateProgram(adminId, institutionSlug, programSlug, name) {
  return api.patch(
    `/institutions/${encodeURIComponent(institutionSlug)}/programs/${encodeURIComponent(programSlug)}`,
    { name },
    adminId
  );
}

export function deleteProgram(adminId, institutionSlug, programSlug) {
  return api.delete(
    `/institutions/${encodeURIComponent(institutionSlug)}/programs/${encodeURIComponent(programSlug)}`,
    adminId
  );
}

export function listHomeButtons(userId) {
  return api.get('/home-buttons', userId);
}

export function saveHomeButtons(adminId, buttons) {
  return api.put('/home-buttons', { buttons }, adminId);
}

export function createUser(payload) {
  return request('/users', {
    method: 'POST',
    body: payload,
    timeoutMs: CREATE_USER_TIMEOUT_MS,
  });
}

export function readUser(userId) {
  return api.get(`/users/${userId}`);
}

export function deleteUser(userId) {
  return api.delete(`/users/${encodeURIComponent(userId)}`, userId);
}

export function updateUser(userId, payload) {
  return api.patch(`/users/${userId}`, payload);
}

export function updateUserRole(adminId, userId, payload) {
  const body = typeof payload === 'string' ? { role: payload } : payload;
  return api.patch(`/users/${encodeURIComponent(userId)}/role`, body, adminId);
}

export function updatePushDevice(userId, token, enabled) {
  return api.put('/notifications/device', { token, enabled }, userId);
}

export function listButtons(userId) {
  return api.get('/buttons', userId);
}

export function listManageButtons(userId) {
  return api.get('/buttons/manage', userId);
}

export function previewButton(userId, url) {
  return api.post('/buttons/preview', { url }, userId);
}

export function createButton(userId, payload) {
  return api.post('/buttons', payload, userId);
}

export function updateButton(userId, buttonId, payload) {
  return api.patch(`/buttons/${buttonId}`, payload, userId);
}

export function deleteButton(userId, buttonId) {
  return api.delete(`/buttons/${buttonId}`, userId);
}

export function reorderButtons(userId, serviceIds, extraIds) {
  return api.put('/buttons/reorder', { service_ids: serviceIds, extra_ids: extraIds }, userId);
}

export function listNews(userId) {
  return api.get('/news', userId);
}

export function recordNewsView(userId, newsId) {
  return api.post(`/news/${newsId}/view`, undefined, userId);
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
