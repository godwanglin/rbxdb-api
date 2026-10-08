'use client';
import { useEffect, useRef, useState } from 'react';
import { webRequest, WebApiError } from './api';
import { Icon } from './icons';
import { number, formatDate } from './format';
import { StatusBadge } from './status-badge';
import type { Purchase } from './types';

export function PurchaseDetail({ purchase, onClose, onExpired }: { purchase: Purchase; onClose: () => void; onExpired: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<Purchase>(purchase);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const node = dialog.current; const previous = document.body.style.overflow;
    node?.showModal(); document.body.style.overflow = 'hidden';
    return () => { node?.close(); document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    webRequest<Purchase>(`/api/admin/purchases/${encodeURIComponent(purchase.purchaseId)}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch(err => { if (controller.signal.aborted) return; if (err instanceof WebApiError && err.status === 401) { onExpired(); return; } setError(err instanceof Error ? err.message : 'Detail gagal dimuat.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [purchase.purchaseId, retry, onExpired]);
  const rows: [string, string | number | null | undefined][] = [
    ['Purchase ID', detail.purchaseId], ['Product ID', detail.productId],
    ['User ID', detail.userId], ['Beneficiary ID', detail.beneficiaryUserId],
    ['Item ID', detail.itemId], ['Kategori', detail.category],
    ['Toko', detail.storeName], ['Store ID', detail.storeId],
    ['Owner ID', detail.ownerUserId], ['Grant attempts', detail.grantAttempts],
    ['Receipt dibuat', formatDate(detail.receiptCreatedAt)], ['Diproses', formatDate(detail.processedAt)],
    ['Grant selesai', formatDate(detail.completedAt)], ['Sinkron terakhir', formatDate(detail.lastSyncedAt)],
    ['Universe ID', detail.universeId], ['Place ID', detail.placeId], ['Job ID', detail.jobId],
  ];
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-labelledby="purchase-detail-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-32px)] max-w-[560px] overflow-auto rounded-xl border border-white/10 bg-[#171b21] p-0 text-[#e8ebf0] shadow-2xl">
    <div className="flex items-start justify-between gap-3 border-b border-white/[.08] px-6 py-5"><div><p className="text-[10px] font-medium uppercase tracking-[.14em] text-[#8e9bac]">Receipt detail</p><h2 id="purchase-detail-title" className="mt-2 text-xl font-semibold">{detail.itemName}</h2><p className="mt-1.5 text-xs text-[#8e9bac]">{detail.displayName} · @{detail.username}</p></div><button autoFocus onClick={onClose} aria-label="Tutup detail transaksi" className="rounded-lg p-2 text-[#8593a4] hover:bg-white/[.05] hover:text-white"><Icon name="close" /></button></div>
    <div className="px-6 py-5"><div className="flex items-center justify-between rounded-lg border border-white/[.07] bg-[#11151b] px-4 py-3"><div className="space-y-2"><StatusBadge status={detail.grantStatus} /><p className="flex items-center gap-1.5 text-[10px] text-[#8598ad]"><Icon name="check" width={12} height={12} />Payment verified</p></div><p className="text-2xl font-semibold tabular-nums">{number.format(detail.robux)}<span className="ml-2 text-xs font-normal text-[#8598ad]">R$</span></p></div>
      {loading && <p role="status" className="mt-4 text-xs text-[#8b9aae]">Memuat detail lengkap…</p>}
      {error && <div role="alert" className="mt-4 text-xs text-red-300">{error}<button onClick={() => setRetry(v => v + 1)} className="ml-2 underline">Coba lagi</button></div>}
      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label}><dt className="text-[10px] text-[#8191a6]">{label}</dt><dd className="mt-1.5 break-all text-xs leading-5 text-[#c7d1dd]">{value ?? '—'}</dd></div>)}</dl>
      {detail.failureCode && <div className="mt-5 rounded-lg border border-red-400/15 bg-red-400/[.04] p-3"><p className="text-xs font-medium text-red-200">{detail.failureCode}</p><p className="mt-2 break-words text-xs leading-5 text-red-200/70">{detail.failureMessage || 'Tidak ada pesan kegagalan.'}</p></div>}
    </div><div className="border-t border-white/[.08] px-6 py-4 text-[10px] leading-5 text-[#77879c]">Dashboard hanya untuk audit. Gift & Resync tersedia di Roblox Admin Panel.</div>
  </dialog>;
}
