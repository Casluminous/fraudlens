import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { compactVND, formatPercent } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { CaseStats, Transaction } from "@/lib/types";
import { Modal } from "./Modal";
import { ScoreRing } from "./ScoreRing";

interface SimulateResult {
  created: number;
  flagged: number;
  items: Transaction[];
}

export function SimulateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [count, setCount] = useState(6);
  const [bias, setBias] = useState(35);
  const [result, setResult] = useState<SimulateResult | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      api<SimulateResult>("/transactions/simulate", {
        method: "POST",
        body: JSON.stringify({ count, fraud_bias: bias / 100 }),
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.push(
        `Đã sinh ${data.created} giao dịch, ${data.flagged} giao dịch bị gắn cờ và đưa vào hàng chờ.`,
        data.flagged > 0 ? "success" : "info",
        "Mô phỏng hoàn tất",
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["case-stats"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (error) => toast.push(error.message, "error", "Không mô phỏng được"),
  });

  const stats = useQuery({
    queryKey: ["case-stats"],
    queryFn: () => api<CaseStats>("/cases/stats"),
    enabled: open,
  });

  const close = () => {
    onClose();
    window.setTimeout(() => {
      setResult(null);
      mutation.reset();
    }, 200);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={result ? "Kết quả mô phỏng" : "Mô phỏng dòng giao dịch"}
      description={
        result
          ? "Các giao dịch đã được chấm điểm và đẩy vào hàng chờ nếu vượt ngưỡng cảnh báo."
          : "Sinh giao dịch mới cho khách hàng hiện có, chấm điểm ngay bằng model + rule engine để trình diễn luồng điều tra."
      }
      footer={
        result ? (
          <>
            <button className="btn-ghost" onClick={close}>
              Đóng
            </button>
            <Link className="btn-primary" to="/queue" onClick={close}>
              Mở hàng chờ <ArrowRight size={14} />
            </Link>
          </>
        ) : (
          <>
            <button className="btn-ghost" onClick={close}>
              Huỷ
            </button>
            <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              <Sparkles size={14} />
              {mutation.isPending ? "Đang chấm điểm…" : `Sinh ${count} giao dịch`}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="panel-flat p-4">
              <p className="eyebrow">Giao dịch mới</p>
              <p className="mt-2 font-mono text-2xl text-white">{result.created}</p>
            </div>
            <div className="panel-flat border-coral-400/20 bg-coral-500/[0.05] p-4">
              <p className="eyebrow text-coral-400/70">Bị gắn cờ</p>
              <p className="mt-2 font-mono text-2xl text-coral-400">{result.flagged}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {result.items.slice(0, 5).map((txn) => (
              <div key={txn.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <ScoreRing score={txn.risk_score} size={38} stroke={3} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-slate-200">{txn.merchant_name}</p>
                  <p className="truncate text-[10.5px] text-slate-500">
                    {txn.customer_name} · {compactVND(txn.amount)} · {txn.risk_band}
                  </p>
                </div>
                {txn.case ? (
                  <Link
                    to={`/cases/${txn.case.id}`}
                    onClick={close}
                    className="shrink-0 text-[11px] font-medium text-mint-300 hover:text-mint-200"
                  >
                    {txn.case.code}
                  </Link>
                ) : (
                  <span className="text-[10.5px] text-slate-600">Không gắn cờ</span>
                )}
              </div>
            ))}
          </div>
          {stats.data && (
            <p className="text-[11px] text-slate-500">
              Hàng chờ hiện có {stats.data.by_status.open ?? 0} case mới · {stats.data.unassigned} chưa phân công ·{" "}
              {stats.data.overdue} quá hạn SLA.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="label">Số giao dịch cần sinh</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={25}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-700 accent-mint-400"
              />
              <span className="w-12 rounded-lg border border-white/10 bg-ink-950/60 py-1 text-center font-mono text-[12px] text-white">
                {count}
              </span>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label mb-0">Tỷ lệ giao dịch đáng ngờ</label>
              <span className="font-mono text-[11px] text-amber-400">{formatPercent(bias, 0)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={bias}
              onChange={(event) => setBias(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-700 accent-amber-400"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Các mẫu đáng ngờ mô phỏng tấn công chiếm đoạt tài khoản, lệch địa lý, thử thẻ và bùng nổ tần suất — dùng để
              thử luồng cảnh báo.
            </p>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.06] px-3.5 py-3 text-[11px] leading-relaxed text-amber-200/80">
            Giao dịch mô phỏng được đánh dấu riêng và không ảnh hưởng dữ liệu huấn luyện model.
          </div>
        </div>
      )}
    </Modal>
  );
}
