/** Fired when the server ends our session (expiry, sign-out elsewhere), so the auth context can react. */
export const UNAUTHORIZED_EVENT = 'nawi:unauthorized';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Auth calls that legitimately answer 401 without meaning "your session ended". */
const QUIET_401 = new Set(['/auth/login', '/auth/me', '/auth/setup', '/auth/logout']);
const quiet401 = (path) => QUIET_401.has(path) || path.startsWith('/auth/links/');

/**
 * The session lives in an httpOnly cookie the browser sends automatically; the
 * custom header is required by the server on state-changing requests (CSRF defence).
 */
async function send(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'nawi', ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !quiet401(path)) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return res;
}

async function request(method, path, body) {
  const res = await send(method, path, body);
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText, data?.details);
  return data;
}

/** Downloads an authenticated file (report PDF/DOCX) via a temporary object URL. */
export async function downloadFile(path, fallbackName) {
  const res = await send('GET', path);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error ?? res.statusText);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false)).toString();
  return s ? `?${s}` : '';
};

export const api = {
  auth: {
    status: () => request('GET', '/auth/status'),
    setup: (fields) => request('POST', '/auth/setup', fields),
    login: (username, password) => request('POST', '/auth/login', { username, password }),
    logout: () => request('POST', '/auth/logout'),
    me: () => request('GET', '/auth/me'),
    linkInfo: (token) => request('GET', `/auth/links/${encodeURIComponent(token)}`),
    redeemLink: (token, password) => request('POST', `/auth/links/${encodeURIComponent(token)}`, { password }),
    sessions: () => request('GET', '/auth/me/sessions'),
    revokeSession: (handle) => request('DELETE', `/auth/me/sessions/${handle}`),
    revokeOtherSessions: () => request('POST', '/auth/me/sessions/revoke-others'),
    changePassword: (currentPassword, newPassword) => request('PUT', '/auth/me/password', { currentPassword, newPassword }),
    getSignature: () => request('GET', '/auth/me/signature'),
    setSignature: (dataUrl) => request('PUT', '/auth/me/signature', { dataUrl }),
  },
  users: {
    list: () => request('GET', '/users'),
    create: (u) => request('POST', '/users', u),
    update: (id, patch) => request('PUT', `/users/${id}`, patch),
    issueLink: (id) => request('POST', `/users/${id}/link`),
    unlock: (id) => request('POST', `/users/${id}/unlock`),
    securityLog: () => request('GET', '/users/security-log'),
  },
  weights: {
    list: () => request('GET', '/weights'),
    create: (w) => request('POST', '/weights', w),
    update: (id, w) => request('PUT', `/weights/${id}`, w),
  },
  records: {
    list: (params) => request('GET', `/records${qs(params)}`),
    stats: () => request('GET', '/records/stats'),
    exportCsv: (params) => downloadFile(`/records/export.csv${qs(params)}`, 'nawi-records.csv'),
    manufacturers: () => request('GET', '/records/manufacturers'),
    get: (id) => request('GET', `/records/${id}`),
    create: (data) => request('POST', '/records', data),
    update: (id, data) => request('PUT', `/records/${id}`, data),
    saveTest: (id, type, observations) => request('PUT', `/records/${id}/tests/${type}`, { observations }),
    transition: (id, action, comment) => request('POST', `/records/${id}/${action}`, { comment }),
    revise: (id, reason) => request('POST', `/records/${id}/revise`, { reason }),
    audit: (id) => request('GET', `/records/${id}/audit`),
    attachments: (id) => request('GET', `/records/${id}/attachments`),
    addAttachment: (id, a) => request('POST', `/records/${id}/attachments`, a),
    deleteAttachment: (id, attachmentId) => request('DELETE', `/records/${id}/attachments/${attachmentId}`),
    downloadReport: (record, format) =>
      downloadFile(`/records/${record.id}/report.${format}`, `${record.referenceNo.replace(/[^A-Za-z0-9-]+/g, '_')}.${format}`),
  },
  samples: {
    status: () => request('GET', '/samples'),
    loadWeights: () => request('POST', '/samples/weights'),
    loadRecords: () => request('POST', '/samples/records'),
    remove: () => request('DELETE', '/samples'),
  },
  public: {
    verify: (id) => request('GET', `/public/verify/${id}`),
  },
};
