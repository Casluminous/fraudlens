import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3.5 sm:flex-row">
      <p className="text-[10.5px] text-slate-500">
        Hiển thị <span className="font-mono text-slate-300">{from}–{to}</span> trong{" "}
        <span className="font-mono text-slate-300">{total}</span> kết quả
      </p>
      <div className="flex items-center gap-1.5">
        <button className="btn-ghost btn-sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={13} /> Trước
        </button>
        <span className="px-2 font-mono text-[10.5px] text-slate-500">
          {page} / {pages}
        </span>
        <button className="btn-ghost btn-sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
          Sau <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
