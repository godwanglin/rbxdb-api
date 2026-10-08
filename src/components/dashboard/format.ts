export const number = new Intl.NumberFormat('id-ID');
const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });
const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export function formatDate(value?: string | null) {
  return value ? `${date.format(new Date(value))}, ${time.format(new Date(value))}` : '—';
}
export function shortDate(value: string) { return date.format(new Date(value)); }
export function shortTime(value: string) { return time.format(new Date(value)); }
