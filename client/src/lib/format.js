export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export function fmtHours(hours) {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export const ROLE_LABELS = { technician: 'Technician', inspector: 'Inspector', admin: 'Administrator' };

/** "3 h", "2 days" — coarse age of a timestamp for queues and lists. */
export function timeAgo(iso, suffix = '') {
  if (!iso) return '—';
  const mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${Math.round(mins)} min${suffix}`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h${suffix}`;
  return `${Math.round(mins / 1440)} days${suffix}`;
}
