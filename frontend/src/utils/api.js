import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
});

// Attach access token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401, log errors cleanly
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config;

    // Log non-401 API errors to console (no intrusive alerts)
    if (err.response && err.response.status !== 401) {
      console.error(
        `[API Error] ${err.response.status} ${orig?.url}:`,
        err.response.data
      );
    }

    // Auto-refresh on 401
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      try {
        const refresh = localStorage.getItem('refreshToken');
        const { data } = await axios.post(
          `${BASE_URL}/api/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refresh}` } }
        );
        localStorage.setItem('accessToken', data.accessToken);
        orig.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(orig);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
