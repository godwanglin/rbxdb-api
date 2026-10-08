'use client';

import { useEffect, useState } from 'react';
import { Brand } from './brand';
import { Icon } from './icons';
import { webRequest, WebApiError } from './api';
import type { Filters, ListData, Purchase } from './types';
import { number } from './format';
import { PurchaseTable } from './purchase-table';
import { PurchaseDetail } from './purchase-detail';

const initialFilters: Filters = { days: '7', search: '', category: '', grantStatus: '' };

export function Dashboard({ username, onSignedOut }: { username: string; onSignedOut: () => void }) {
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<ListData | null>(null);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<string | null>(null);
  const [health, setHealth] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    const timer = setTimeout(() => { setFilters(v => v.search === draft.trim() ? v : { ...v, search: draft.trim() }); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ days: filters.days, page: String(page), pageSize: '15' });
    if (filters.search) query.set('search', filters.search);
    if (filters.category) query.set('category', filters.category);
    if (filters.grantStatus) query.set('grantStatus', filters.grantStatus);
    setLoading(true); setError('');
    webRequest<ListData>(`/api/admin/purchases?${query}`, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        const maxPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (page > maxPage) { setPage(maxPage); return; }
        setData(result); setUpdated(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        if (err instanceof WebApiError && err.status === 401) { onSignedOut(); return; }
        setData(null); setError(err instanceof Error ? err.message : 'Gagal mengambil histori.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, page, refresh, onSignedOut]);

  useEffect(() => {
    const controller = new AbortController();
    function check() { webRequest('/api/health', { signal: controller.signal }).then(() => setHealth('ok')).catch(() => { if (!controller.signal.aborted) setHealth('down'); }); }
    check(); const timer = setInterval(check, 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);

  function filter<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters(v => ({ ...v, [key]: value })); setPage(1); }
  function reset() { setDraft(''); setFilters(initialFilters); setPage(1); }
  async function logout() {
    try { await webRequest('/api/admin/session', { method: 'DELETE' }); onSignedOut(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Logout gagal.'); }
  }
  const summary = data?.summary;
  const attention = summary ? summary.pending + summary.failed + summary.unknown : 0;
  const activeFilters = !!(filters.search || filters.category || filters.grantStatus || filters.days !== '7');

  return <div className="min-h-dvh bg-[#101216]">
    <aside className="fixed inset-y-0 left-0 hidden w-[218px] flex-col border-r border-white/[.07] bg-[#0d0f12] lg:flex">
      <div className="px-6 py-7"><Brand /></div>
      <div className="px-4 pt-7"><p className="px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#646b75]">Workspace</p><div aria-current="page" className="mt-3 flex items-center gap-3 rounded-lg border border-white/[.07] bg-[#1b1e24] px-3 py-3 text-sm font-medium text-white"><Icon name="receipt" />Purchases<span className="ml-auto size-1.5 rounded-full bg-[#bfc7d1]" /></div></div>
      <div className="mt-auto border-t border-white/[.07] p-5"><div className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 bg-[#1b1e24] text-xs font-semibold uppercase">{username.slice(0, 2)}</span><div className="min-w-0"><p className="truncate text-xs font-medium text-[#c7ccd3]">{username}</p><p className="mt-1 text-[10px] text-[#6d7580]">Administrator</p></div></div><button onClick={() => void logout()} className="mt-4 flex items-center gap-2 text-xs text-[#8f97a2] hover:text-white"><Icon name="logout" width={14} height={14} />Keluar workspace</button></div>
    </aside>
    <div className="lg:ml-[218px]">
      <header className="flex h-[70px] items-center justify-between border-b border-white/[.07] px-5 sm:px-8"><div className="lg:hidden"><Brand /></div><div className="hidden items-center gap-2 text-xs text-[#6f7782] lg:flex">Workspace<Icon name="chevron" width={12} height={12} /><span className="text-[#c3c8d0]">Purchases</span></div><div className="flex items-center gap-4"><span className="inline-flex items-center gap-2 rounded-full border border-white/[.07] bg-white/[.02] px-2.5 py-1 text-[10px] text-[#a1a8b1]"><span className={`size-1.5 rounded-full ${health === 'ok' ? 'bg-emerald-400' : health === 'down' ? 'bg-red-400' : 'bg-amber-400'}`} />{health === 'ok' ? 'Sistem online' : health === 'down' ? 'API offline' : 'Memeriksa'}</span><button onClick={() => void logout()} aria-label="Keluar workspace" className="text-[#8c949f] lg:hidden"><Icon name="logout" /></button><span className="hidden border-l border-white/10 pl-4 text-[11px] text-[#707884] lg:block">Production</span></div></header>
      <main id="main" className="mx-auto max-w-[1550px] px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.16em] text-[#8d959f]"><Icon name="receipt" width={13} height={13} />Verified receipt ledger</div><h1 className="text-[27px] font-semibold tracking-tight sm:text-[30px]">Riwayat pembelian</h1><p className="mt-2 text-[13px] leading-6 text-[#8d959f]">Pantau pembelian Robux dan pastikan setiap item sampai ke pemain.</p></div><button disabled={loading} onClick={() => setRefresh(v => v + 1)} className="button mt-1"><Icon name="refresh" width={14} height={14} />{loading ? 'Memuat…' : 'Refresh data'}</button></div>
        <section aria-label="Ringkasan sesuai filter" className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric label="Total transaksi" value={summary ? number.format(summary.total) : '—'} icon="receipt" note={`Periode ${filters.days === '1' ? '24 jam' : `${filters.days} hari`}`} />
          <Metric label="Total Robux" value={summary ? number.format(summary.robux) : '—'} icon="coin" note="Dari receipt terverifikasi" />
          <Metric label="Berhasil diterapkan" value={summary ? number.format(summary.applied) : '—'} icon="check" note="Item sudah diterima" />
          <Metric label="Perlu ditinjau" value={summary ? number.format(attention) : '—'} icon="alert" note="Pending, failed & unknown" warning={attention > 0} />
        </section>
        <section className="mt-7 overflow-hidden rounded-xl border border-white/[.08] bg-[#15181d]" aria-label="Histori transaksi">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.07] px-5 py-4"><div className="flex items-center gap-2.5"><h2 className="text-sm font-semibold">Semua transaksi</h2><span className="rounded-md border border-white/[.08] bg-white/[.03] px-1.5 py-0.5 text-[10px] text-[#9098a4]">{data ? number.format(data.total) : '—'}</span></div><span className="text-[10px] text-[#717a86]">{updated ? `Diperbarui ${updated}` : 'Menunggu data'}</span></div>
          <div className="grid gap-3 border-b border-white/[.07] p-4 sm:p-5 xl:grid-cols-[minmax(190px,1fr)_130px_160px_165px]"><div className="relative"><Icon name="search" className="pointer-events-none absolute top-3 left-3 text-[#717a86]" width={16} height={16} /><input aria-label="Cari username, DisplayName, UserId atau item" maxLength={120} value={draft} onChange={e => setDraft(e.target.value)} className="field w-full pl-9" placeholder="Cari pemain atau nama item…" /></div><select className="field w-full" aria-label="Periode histori" value={filters.days} onChange={e => filter('days', e.target.value)}><option value="1">24 jam terakhir</option><option value="7">7 hari terakhir</option><option value="14">14 hari terakhir</option><option value="30">30 hari terakhir</option></select><select className="field w-full" aria-label="Kategori item" value={filters.category} onChange={e => filter('category', e.target.value)}><option value="">Semua kategori</option>{[...new Set([...(data?.categories ?? []), ...(filters.category ? [filters.category] : [])])].map(c => <option key={c} value={c}>{c}</option>)}</select><select className="field w-full" aria-label="Status pemberian" value={filters.grantStatus} onChange={e => filter('grantStatus', e.target.value)}><option value="">Semua status</option><option value="APPLIED">Applied</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="UNKNOWN_PRODUCT">Unknown product</option></select></div>
          {activeFilters && <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-2 text-[11px] text-[#89929e]"><span>Filter aktif · Ringkasan mengikuti hasil pencarian</span><button onClick={reset} className="text-[#c9ced6] hover:text-white">Reset filter</button></div>}
          <PurchaseTable data={data} loading={loading} error={error} onRetry={() => setRefresh(v => v + 1)} onSelect={setSelected} page={page} onPage={setPage} />
        </section>
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10px] leading-5 text-[#656f7d]"><p>Hanya pembelian dengan receipt. Prompt batal tidak dicatat.</p><p>Kompensasi & resync dilakukan melalui Roblox Admin Panel.</p></footer>
      </main>
    </div>
    {selected && <PurchaseDetail purchase={selected} onClose={() => setSelected(null)} onExpired={onSignedOut} />}
  </div>;
}

function Metric({ label, value, note, icon, warning }: { label: string; value: string; note: string; icon: 'receipt' | 'coin' | 'check' | 'alert'; warning?: boolean }) {
  return <div className="rounded-xl border border-white/[.07] bg-[#171a20] p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-[11px] text-[#a0a7b2]">{label}</p><span className={warning ? 'text-amber-300/70' : 'text-[#75808d]'}><Icon name={icon} width={15} height={15} /></span></div><p className={`mt-4 text-[27px] font-semibold tracking-tight tabular-nums ${warning ? 'text-amber-200' : 'text-[#e8ebf0]'}`}>{value}</p><p className="mt-2 text-[10px] text-[#717b87]">{note}</p></div>;
}
