/**
 * KupataLove API Client
 * Fetch wrapper with auth headers, token refresh, and error handling
 */

const API_BASE = '/api';

let _accessToken = localStorage.getItem('kl_access_token');
let _refreshToken = localStorage.getItem('kl_refresh_token');

const setTokens = (access, refresh) => {
  _accessToken = access;
  _refreshToken = refresh;
  localStorage.setItem('kl_access_token', access);
  if (refresh) localStorage.setItem('kl_refresh_token', refresh);
};

const clearTokens = () => {
  _accessToken = null;
  _refreshToken = null;
  localStorage.removeItem('kl_access_token');
  localStorage.removeItem('kl_refresh_token');
  localStorage.removeItem('kl_user');
};

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('kl_user')); } catch { return null; }
};
const setUser = (user) => localStorage.setItem('kl_user', JSON.stringify(user));

let _isRefreshing = false;
let _refreshQueue = [];

const refreshTokens = async () => {
  if (_isRefreshing) {
    return new Promise(resolve => _refreshQueue.push(resolve));
  }
  _isRefreshing = true;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: _refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    _refreshQueue.forEach(fn => fn(data.accessToken));
    _refreshQueue = [];
    return data.accessToken;
  } catch {
    clearTokens();
    window.location.href = '/auth.html';
    return null;
  } finally {
    _isRefreshing = false;
  }
};

const request = async (endpoint, options = {}, retry = true) => {
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      body: options.body instanceof FormData
        ? options.body
        : (options.body ? JSON.stringify(options.body) : undefined),
    });

    // Token expired → refresh and retry once
    if (res.status === 401 && retry) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'TOKEN_EXPIRED' && _refreshToken) {
        const newToken = await refreshTokens();
        if (newToken) return request(endpoint, options, false);
      }
      clearTokens();
      window.location.href = '/auth.html';
      return null;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
      const err = new Error(errData.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = errData;
      throw err;
    }

    // Handle empty responses
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (!err.status) console.error('Network error:', err);
    throw err;
  }
};

const api = {
  get:    (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post:   (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put:    (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
  upload: (endpoint, formData) => request(endpoint, { method: 'POST', body: formData }),
};

window.KL_API = { api, setTokens, clearTokens, getUser, setUser, getAccessToken: () => _accessToken };
