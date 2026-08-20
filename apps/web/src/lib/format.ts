export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(parseDate(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parseDate(value));
}

export function relativeTime(value?: string) {
  if (!value) return '';
  const elapsed = Math.max(0, Date.now() - parseDate(value).getTime());
  if (elapsed < 60_000) return 'now';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1_440)}d`;
}

export function relativeTimeAgo(value?: string) {
  const relative = relativeTime(value);
  if (!relative) return '';
  return relative === 'now' ? 'just now' : `${relative} ago`;
}

function parseDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  return new Date(normalized);
}
