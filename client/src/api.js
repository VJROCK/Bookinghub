/* API client with token handling */
let token = sessionStorage.getItem('bh_token') || null;
let currentUser = JSON.parse(sessionStorage.getItem('bh_user') || 'null');

export function setSession(t, u) {
  token = t; currentUser = u;
  if (t) { sessionStorage.setItem('bh_token', t); sessionStorage.setItem('bh_user', JSON.stringify(u)); }
  else { sessionStorage.removeItem('bh_token'); sessionStorage.removeItem('bh_user'); }
}
export function getUser() { return currentUser; }
export function isLoggedIn() { return !!token; }

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !url.includes('/auth/')) { setSession(null, null); window.location.href = '/'; throw new Error('Session expired'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (url) => req('GET', url),
  post: (url, body) => req('POST', url, body),
  put: (url, body) => req('PUT', url, body),
  patch: (url, body) => req('PATCH', url, body),
  del: (url) => req('DELETE', url),
};

/* cached master option lists for dropdowns */
const optionCache = new Map();
export async function options(ref, force = false) {
  if (!force && optionCache.has(ref)) return optionCache.get(ref);
  const rows = await api.get(`/api/masters/${ref}/options`);
  optionCache.set(ref, rows);
  return rows;
}
export function clearOptions(ref) { if (ref) optionCache.delete(ref); else optionCache.clear(); }

export function fmt(n) {
  if (n == null || n === '' || isNaN(Number(n))) return n ?? '';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
export function today(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function downloadCSV(rows, filename) {
  if (!rows || !rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename || 'report.csv';
  a.click();
}
