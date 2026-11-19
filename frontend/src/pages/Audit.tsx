import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ScrollText, Search, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { actionLabel, formatDateTime } from "@/lib/format";
import type { AuditEntry, Page } from "@/lib/types";
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from "@/components/Ui";
import { Pagination } from "@/components/Pagination";

const ACTION_TONE: Record<string, string> = {
  "auth.login": "text-mint-300 border-mint-400/25 bg-mint-500/10",
  "auth.login_failed": "text-coral-400 border-coral-400/25 bg-coral-500/10",
  "case.decision": "text-coral-400 border-coral-400/25 bg-coral-500/10",
  "case.update": "text-azure-400 border-azure-400/25 bg-azure-500/10",
  "rule.update": "text-amber-400 border-amber-400/25 bg-amber-500/10",
  "rule.create": "text-mint-300 border-mint-400/25 bg-mint-500/10",
  "rule.delete": "text-coral-400 border-coral-400/25 bg-coral-500/10",
  "user.create": "text-mint-300 border-mint-400/25 bg-mint-500/10",
  "user.update": "text-azure-400 border-azure-400/25 bg-azure-500/10",
  "settings.update": "text-amber-400 border-amber-400/25 bg-amber-500/10",
};

function JsonBlock({ value, label }: { value: Record<string, unknown> | null; label: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <pre className="max-h-[220px] overflow-auto rounded-lg border border-white/[0.06] bg-ink-950/60 p-3 font-mono text-[10px] leading-relaxed text-slate-400">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AuditPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const meta = useQuery({
    queryKey: ["audit-actions"],
    queryFn: () => api<{ actions: string[]; entities: string[] }>("/audit/actions"),
  });

  const query = new URLSearchParams({ page: String(page), page_size: "20" });
  if (q) query.set("q", q);
  if (action !== "all") query.set("action", action);
  if (entity !== "all") query.set("entity_type", entity);

  const audit = useQuery({
    queryKey: ["audit", q, action, entity, page],
    queryFn: () => api<Page<AuditEntry>>(`/audit?${query.toString()}`),
    placeholderData: (previous) => previous,
  });

  const change = (callback: () => void) => {
    callback();
    setPage(1);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Quản trị"
        title="Audit trail"
        subtitle="Bản ghi bất biến cho đăng nhập, phân quyền, thay đổi rule, cấu hình ngưỡng và kết luận điều tra."
        actions={
          <span className="chip text-[10px]">
            <ShieldCheck size={11} className="text-mint-400" /> Chỉ admin
          </span>
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <form
            className="relative w-full sm:max-w-[280px]"
            onSubmit={(event) => {
              event.preventDefault();
              change(() => setQ(search.trim()));
            }}
          >
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Email, hành động, entity id…"
              className="field py-2 pl-9 text-[11.5px]"
            />
          </form>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <select value={action} onChange={(event) => change(() => setAction(event.target.value))} className="field w-auto py-2 text-[11px]">
              <option value="all">Mọi hành động</option>
              {(meta.data?.actions ?? []).map((item) => (
                <option key={item} value={item}>{actionLabel(item)}</option>
              ))}
            </select>
            <select value={entity} onChange={(event) => change(() => setEntity(event.target.value))} className="field w-auto py-2 text-[11px]">
              <option value="all">Mọi đối tượng</option>
              {(meta.data?.entities ?? []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        {audit.isError ? (
          <ErrorState message={audit.error.message} onRetry={() => audit.refetch()} />
        ) : audit.isLoading ? (
          <SkeletonRows rows={9} />
        ) : !audit.data?.items.length ? (
          <EmptyState icon={ScrollText} title="Chưa có bản ghi" description="Các thao tác quan trọng sẽ được ghi nhận tại đây." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="bg-white/[0.012]">
                  <th className="th w-7" />
                  <th className="th">Thời điểm</th>
                  <th className="th">Người thực hiện</th>
                  <th className="th">Hành động</th>
                  <th className="th">Đối tượng</th>
                  <th className="th">IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.items.map((entry) => {
                  const isOpen = expanded === entry.id;
                  const hasDetail = Boolean(entry.before || entry.after);
                  return (
                    <Fragment key={entry.id}>
                      <tr
                        className={clsx("table-row", hasDetail && "cursor-pointer")}
                        onClick={() => hasDetail && setExpanded(isOpen ? null : entry.id)}
                      >
                        <td className="td pr-0">
                          {hasDetail && (
                            <span className="text-slate-600">
                              {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </span>
                          )}
                        </td>
                        <td className="td whitespace-nowrap text-[10.5px] text-slate-400">{formatDateTime(entry.created_at)}</td>
                        <td className="td">
                          <span className="font-mono text-[10.5px] text-slate-300">{entry.actor_email}</span>
                        </td>
                        <td className="td">
                          <span
                            className={clsx(
                              "inline-flex rounded-md border px-2 py-0.5 text-[9.5px] font-medium",
                              ACTION_TONE[entry.action] ?? "border-white/10 bg-white/[0.04] text-slate-400",
                            )}
                          >
                            {actionLabel(entry.action)}
                          </span>
                        </td>
                        <td className="td">
                          <span className="text-[10.5px] text-slate-400">{entry.entity_type}</span>
                          <span className="ml-1.5 font-mono text-[9.5px] text-slate-600">{entry.entity_id.slice(0, 14)}</span>
                        </td>
                        <td className="td font-mono text-[10px] text-slate-600">{entry.ip || "—"}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td />
                          <td colSpan={5} className="px-4 pb-4">
                            <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5 sm:grid-cols-2">
                              <JsonBlock value={entry.before} label="Trước thay đổi" />
                              <JsonBlock value={entry.after} label="Sau thay đổi" />
                              {!entry.before && !entry.after && <p className="text-[10.5px] text-slate-500">Không có chi tiết.</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {audit.data && (
          <Pagination
            page={audit.data.page}
            pages={audit.data.pages}
            total={audit.data.total}
            pageSize={audit.data.page_size}
            onPage={setPage}
          />
        )}
      </div>
    </div>
  );
}
