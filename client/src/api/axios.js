import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

// The access token is intentionally kept in memory only. Persisting it in
// localStorage would let any XSS payload read a live credential; the httpOnly
// refresh cookie restores the session after a reload instead.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise = null;

// Single-flight refresh shared by session restore and 401 retries so concurrent
// requests never rotate the refresh cookie more than once.
export function refreshSession() {
  refreshPromise ||= api
    .post('/auth/refresh')
    .then(({ data }) => {
      setAccessToken(data.accessToken);
      return data;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthRoute = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !original?._retried && !isAuthRoute) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new Event('hr:logout'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
