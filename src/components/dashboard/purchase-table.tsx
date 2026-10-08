import { Icon } from './icons';
import { StatusBadge } from './status-badge';
import { number, shortDate, shortTime } from './format';
import type { ListData, Purchase } from './types';

export function PurchaseTable({ data, loading, error, onRetry, onSelect, page, onPage }: {
  data: ListData | null; loading: boolean; error: string; onRetry: () => void;
  onSelect: (p: Purchase) => void; page: number; onPage: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 15));
  return <div aria-busy={loading}>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[830px] text-left">
        <caption className="sr-only">Riwayat pembelian Robux terverifikasi</caption>
        <thead className="border-b border-white/[.06] bg-[#111419]/50 text-[10px] font-medium uppercase tracking-[.07em] text-[#808b99]"><tr><th scope="col" className="px-5 py-3 font-medium">Pemain</th><th scope="col" className="px-4 py-3 font-medium">Item & kategori</th><th scope="col" className="px-4 py-3 text-right font-medium">Robux</th><th scope="col" className="px-5 py-3 font-medium">Grant status</th><th scope="col" className="px-4 py-3 font-medium">Waktu receipt</th><th scope="col" className="pr-5"><span className="sr-only">Detail</span></th></tr></thead>
        <tbody className="divide-y divide-white/[.05]">
          {loading ? Array.from({ length: 6 }, (_, i) => <tr key={i} aria-hidden="true">{Array.from({ length: 6 }, (_, j) => <td key={j} className="px-5 py-5"><div className={`h-3 rounded bg-white/[.05] ${j === 5 ? 'w-3' : 'w-3/4'}`} /></td>)}</tr>) : data?.items.map(item => <tr key={item.purchaseId} className="transition-colors hover:bg-white/[.025]">
            <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[.06] bg-[#242a33] text-[10px] font-semibold text-[#bdc6d3]">{(item.displayName || item.username).slice(0, 2).toUpperCase()}</span><div className="min-w-0"><p className="max-w-[170px] truncate text-[12px] font-medium text-[#dce1e8]" title={item.displayName}>{item.displayName || item.username}</p><p className="mt-1 text-[10px] text-[#858f9e]">@{item.username}</p></div></div></td>
            <td className="px-4 py-4"><p className="max-w-[230px] truncate text-[12px] font-medium text-[#cdd4de]" title={item.itemName}>{item.itemName}</p><p className="mt-1 text-[10px] text-[#7d8999]">{item.category}</p></td>
            <td className="px-4 py-4 text-right text-[12px] font-medium tabular-nums text-[#dce1e8]">{number.format(item.robux)}<span className="ml-1.5 text-[10px] text-[#697586]">R$</span></td>
            <td className="px-5 py-4"><StatusBadge status={item.grantStatus} /></td>
            <td className="whitespace-nowrap px-4 py-4"><p className="text-[11px] text-[#b5becb]">{shortDate(item.receiptCreatedAt)}</p><p className="mt-1 text-[10px] text-[#788697]">{shortTime(item.receiptCreatedAt)}</p></td>
            <td className="pr-5 text-right"><button onClick={() => onSelect(item)} aria-label={`Detail pembelian ${item.itemName} oleh ${item.username}`} className="rounded-md p-2 text-[#8793a3] hover:bg-white/[.06] hover:text-white"><Icon name="chevron" width={15} height={15} /></button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {!loading && error && <div role="alert" className="flex flex-col items-center gap-3 px-5 py-12"><Icon name="alert" className="text-red-300" width={25} height={25} /><p className="text-center text-xs text-red-200">{error}</p><button onClick={onRetry} className="button">Coba lagi</button></div>}
    {!loading && !error && !data?.items.length && <div className="grid place-items-center px-5 py-14 text-center"><div className="grid size-11 place-items-center rounded-xl border border-white/[.06] bg-white/[.025] text-[#778292]"><Icon name="receipt" width={22} height={22} /></div><p className="mt-4 text-sm font-medium text-[#c2cad5]">Belum ada transaksi</p><p className="mt-2 max-w-xs text-xs leading-5 text-[#7e8a9a]">Tidak ada receipt sesuai filter ini. Coba periode lain atau hapus filter pencarian.</p></div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] px-5 py-3.5"><p className="text-[11px] text-[#7e8a9b]">{data?.total ? `${(page - 1) * 15 + 1}–${Math.min(page * 15, data.total)} dari ${number.format(data.total)}` : '0 transaksi'}<span className="ml-2 hidden text-[#505b6b] sm:inline">· 15 per halaman</span></p><div className="flex items-center gap-1"><button disabled={loading || page <= 1} onClick={() => onPage(page - 1)} className="button size-7 px-0" aria-label="Halaman sebelumnya"><Icon name="chevron" className="rotate-180" width={12} height={12} /></button><span className="px-2 text-[11px] tabular-nums text-[#9ba6b5]">{page} / {pages}</span><button disabled={loading || page >= pages} onClick={() => onPage(page + 1)} className="button size-7 px-0" aria-label="Halaman berikutnya"><Icon name="chevron" width={12} height={12} /></button></div></div>
  </div>;
}
