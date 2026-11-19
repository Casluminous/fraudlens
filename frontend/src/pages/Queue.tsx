import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Filter,
  Inbox,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { categoryLabel, compactVND, slaState, timeAgo } from "@/lib/format";
import type { CaseDetail, CaseItem, CaseStats, Page, User } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { PriorityBadge, RiskBadge, StatusBadge } from "@/components/Badges";
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from "@/components/Ui";
import { Pagination } from "@/components/Pagination";
import { ScoreRing } from "@/components/ScoreRing";
import { SimulateDialog } from "@/components/SimulateDialog";
import { useToast } from "@/lib/toast";

const STATUS_TABS = [
  { value: "active", label: "Đang mở" },
  { value: "open", label: "Mới" },
  { value: "in_review", label: "Đang xử lý" },
  { value: "awaiting_info", label: "Chờ thông tin" },
  { value: "resolved", label: "Đã đóng" },
  { value: "all", label: "Tất cả" },
];

export function QueuePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, canEdit } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "active");
  const [priority, setPriority] = useState(params.get("priority") ?? "all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(1);
  const [simulateOpen, setSimulateOpen] = useState(false);

  const statusParam = status === "active" ? "open,in_review,awaiting_info" : status;
  const query = new URLSearchParams({
    status: statusParam,
    priority,
    assignee,
    page: String(page),
    page_size: "15",
    sort,
  });
  if (q) query.set("q", q);
  if (assignee === "me" && user) query.set("assignee", user.id);

  const cases = useQuery({
    queryKey: ["cases", statusParam, priority, assignee, q, sort, page],
    queryFn: () => api<Page<CaseItem>>(`/cases?${query.toString()}`),
    placeholderData: (previous) => previous,
  });
  const stats = useQuery({ queryKey: ["case-stats"], queryFn: () => api<CaseStats>("/cases/stats") });
  const analysts = useQuery({
    queryKey: ["analysts"],
    queryFn: () => api<User[]>("/users/analysts"),
  });

  const assign = useMutation({
    mutationFn: (caseId: string) =>
      api<CaseDetail>(`/cases/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_to: user?.id }),
      }),
    onSuccess: (_, caseId) => {
      toast.push("Case đã được giao cho bạn và ghi vào audit trail.", "success", "Đã nhận xử lý");
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["case-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void caseId;
    },
    onError: (error) => toast.push(error.message, "error", "Không thể nhận case"),
  });

  const activeTab = stats.data;
  const openCount =
    (activeTab?.by_status.open ?? 0) +
    (activeTab?.by_status.in_review ?? 0) +
    (activeTab?.by_status.awaiting_info ?? 0);

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQ(search.trim());
    setPage(1);
  };

  const changeFilter = (action: () => void) => {
    action();
    setPage(1);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Vận hành"
        title="Hàng chờ điều tra"
        subtitle="Sắp xếp theo ưu tiên và SLA. Analyst xác minh từng cảnh báo trước khi ghi nhận kết luận."
        actions={
          canEdit && (
            <button className="btn-primary btn-sm" onClick={() => setSimulateOpen(true)}>
              <Sparkles size={13} /> Mô phỏng giao dịch
            </button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Đang mở", value: openCount, icon: Inbox, tone: "text-white" },
          { label: "Ưu tiên P1", value: stats.data?.open_by_priority.P1 ?? 0, icon: ShieldAlert, tone: "text-coral-400" },
          { label: "Chưa phân công", value: stats.data?.unassigned ?? 0, icon: UserPlus, tone: "text-amber-400" },
          { label: "Quá hạn SLA", value: stats.data?.overdue ?? 0, icon: Filter, tone: "text-coral-400" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="panel flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-slate-500">
                <Icon size={14} />
              </span>
              <div>
                <p className="text-[10px] text-slate-500">{item.label}</p>
                <p className={clsx("font-mono text-[17px]", item.tone)}>{item.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 pt-4 sm:px-5">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => changeFilter(() => setStatus(tab.value))}
                className={clsx(
                  "relative rounded-t-lg px-3 pb-3 pt-1 text-[11.5px] font-medium transition",
                  status === tab.value ? "text-white" : "text-slate-500 hover:text-slate-300",
                )}
              >
                {tab.label}
                {status === tab.value && (
                  <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-mint-400 shadow-[0_0_10px_rgba(75,227,166,0.7)]" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <form onSubmit={applySearch} className="relative w-full sm:max-w-[280px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Mã case, khách hàng, merchant…"
              className="field py-2 pl-9 text-[11.5px]"
            />
          </form>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <select value={priority} onChange={(event) => changeFilter(() => setPriority(event.target.value))} className="field w-auto py-2 text-[11px]">
              <option value="all">Mọi ưu tiên</option>
              <option value="P1">P1 — Khẩn cấp</option>
              <option value="P2">P2 — Cao</option>
              <option value="P3">P3 — Thường</option>
            </select>
            <select value={assignee} onChange={(event) => changeFilter(() => setAssignee(event.target.value))} className="field w-auto py-2 text-[11px]">
              <option value="all">Mọi phụ trách</option>
              <option value="me">Của tôi</option>
              <option value="unassigned">Chưa phân công</option>
              {(analysts.data ?? []).map((analyst) => (
                <option key={analyst.id} value={analyst.id}>
                  {analyst.full_name}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(event) => changeFilter(() => setSort(event.target.value))} className="field w-auto py-2 text-[11px]">
              <option value="priority">Ưu tiên trước</option>
              <option value="sla">SLA gần nhất</option>
              <option value="score">Điểm rủi ro</option>
              <option value="recent">Mới nhất</option>
            </select>
          </div>
        </div>

        {cases.isError ? (
          <ErrorState message={cases.error.message} onRetry={() => cases.refetch()} />
        ) : cases.isLoading ? (
          <SkeletonRows rows={7} />
        ) : !cases.data?.items.length ? (
          <EmptyState
            icon={Inbox}
            title="Không có case phù hợp"
            description="Thử đổi bộ lọc hoặc trạng thái. Case mới sẽ xuất hiện ngay khi giao dịch vượt ngưỡng cảnh báo."
            action={
              canEdit ? (
                <button className="btn-ghost btn-sm" onClick={() => setSimulateOpen(true)}>
                  <Sparkles size={13} /> Sinh giao dịch mẫu
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <tr className="bg-white/[0.012]">
                  <th className="th">Case</th>
                  <th className="th">Khách hàng</th>
                  <th className="th">Merchant</th>
                  <th className="th">Giá trị</th>
                  <th className="th">Điểm rủi ro</th>
                  <th className="th">Ưu tiên</th>
                  <th className="th">Trạng thái</th>
                  <th className="th">SLA</th>
                  <th className="th">Phụ trách</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {cases.data.items.map((item) => {
                  const sla = slaState(item.sla_due_at, item.status);
                  const canAssign = canEdit && !item.assignee && item.status !== "resolved";
                  return (
                    <tr
                      key={item.id}
                      className="table-row group cursor-pointer"
                      onClick={() => navigate(`/cases/${item.id}`)}
                    >
                      <td className="td">
                        <p className="font-mono text-[11px] text-mint-300">{item.code}</p>
                        <p className="mt-0.5 text-[9.5px] text-slate-600">{timeAgo(item.created_at)}</p>
                      </td>
                      <td className="td">
                        <p className="text-[12px] font-medium text-slate-200">{item.transaction.customer_name}</p>
                        <p className="mt-0.5 font-mono text-[9.5px] text-slate-600">{item.transaction.customer_id}</p>
                      </td>
                      <td className="td">
                        <p className="max-w-[170px] truncate text-[11.5px] text-slate-300">{item.transaction.merchant_name}</p>
                        <p className="mt-0.5 text-[9.5px] text-slate-600">
                          {categoryLabel(item.transaction.merchant_category)} · {item.transaction.channel}
                        </p>
                      </td>
                      <td className="td font-mono text-[12px] text-slate-100">{compactVND(item.transaction.amount)}</td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <ScoreRing score={item.risk_score} size={32} stroke={3} />
                          <RiskBadge band={item.transaction.risk_band} />
                        </div>
                      </td>
                      <td className="td"><PriorityBadge priority={item.priority} /></td>
                      <td className="td"><StatusBadge status={item.status} /></td>
                      <td className="td">
                        <span
                          className={clsx(
                            "whitespace-nowrap text-[10.5px]",
                            sla.tone === "bad" ? "text-coral-400" : sla.tone === "warn" ? "text-amber-400" : "text-slate-500",
                          )}
                        >
                          {sla.label}
                        </span>
                      </td>
                      <td className="td">
                        {item.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={item.assignee.full_name} size="xs" />
                            <span className="max-w-[96px] truncate text-[10.5px] text-slate-400">{item.assignee.full_name}</span>
                          </div>
                        ) : canAssign ? (
                          <button
                            className="btn-ghost btn-sm whitespace-nowrap px-2 py-1 text-[10px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              assign.mutate(item.id);
                            }}
                            disabled={assign.isPending}
                          >
                            {assign.isPending && assign.variables === item.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Users size={11} />
                            )}
                            Nhận
                          </button>
                        ) : (
                          <span className="text-[10.5px] text-slate-600">Chưa gán</span>
                        )}
                      </td>
                      <td className="td text-right">
                        <Link
                          to={`/cases/${item.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex text-slate-600 transition group-hover:text-mint-300"
                        >
                          <ArrowUpRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-white/[0.05] md:hidden">
            {cases.data.items.map((item) => {
              const sla = slaState(item.sla_due_at, item.status);
              return (
                <div
                  key={item.id}
                  data-testid="case-card"
                  className="cursor-pointer p-4 transition active:bg-white/[0.03]"
                  onClick={() => navigate(`/cases/${item.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] text-mint-300">{item.code}</p>
                      <p className="mt-1 text-[13px] font-medium text-slate-100">{item.transaction.customer_name}</p>
                      <p className="mt-0.5 text-[10.5px] text-slate-500">
                        {item.transaction.merchant_name} · {categoryLabel(item.transaction.merchant_category)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <ScoreRing score={item.risk_score} size={42} stroke={3} />
                      <PriorityBadge priority={item.priority} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-mono text-[14px] text-white">{compactVND(item.transaction.amount)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={item.status} />
                        <RiskBadge band={item.transaction.risk_band} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={clsx(
                          "text-[10px]",
                          sla.tone === "bad" ? "text-coral-400" : sla.tone === "warn" ? "text-amber-400" : "text-slate-500",
                        )}
                      >
                        {sla.label}
                      </p>
                      <div className="mt-1.5 flex justify-end">
                        {item.assignee ? (
                          <span className="flex items-center gap-1.5">
                            <Avatar name={item.assignee.full_name} size="xs" />
                            <span className="max-w-[90px] truncate text-[10px] text-slate-400">{item.assignee.full_name}</span>
                          </span>
                        ) : canEdit && item.status !== "resolved" ? (
                          <button
                            className="btn-ghost btn-sm px-2 py-1 text-[10px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              assign.mutate(item.id);
                            }}
                            disabled={assign.isPending}
                          >
                            <Users size={11} /> Nhận
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600">Chưa gán</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}

        {cases.data && (
          <Pagination
            page={cases.data.page}
            pages={cases.data.pages}
            total={cases.data.total}
            pageSize={cases.data.page_size}
            onPage={setPage}
          />
        )}
      </div>

      <SimulateDialog open={simulateOpen} onClose={() => setSimulateOpen(false)} />
    </div>
  );
}
