import type { GrantStatus } from './types';
const styles: Record<GrantStatus, string> = {
  APPLIED: 'bg-emerald-400/[.07] text-emerald-300 ring-emerald-400/15',
  PENDING: 'bg-amber-400/[.07] text-amber-300 ring-amber-400/15',
  FAILED: 'bg-red-400/[.07] text-red-300 ring-red-400/15',
  UNKNOWN_PRODUCT: 'bg-slate-400/[.07] text-slate-300 ring-slate-400/15',
};
const labels: Record<GrantStatus, string> = { APPLIED: 'Applied', PENDING: 'Pending', FAILED: 'Failed', UNKNOWN_PRODUCT: 'Unknown product' };
export function StatusBadge({ status }: { status: GrantStatus }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${styles[status]}`}><span className="size-1.5 rounded-full bg-current" />{labels[status]}</span>;
}
