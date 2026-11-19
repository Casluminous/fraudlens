import type { Role } from "./types";

export const CATEGORY_LABELS: Record<string, string> = {
  crypto: "Tiền mã hóa",
  gift_card: "Thẻ quà tặng",
  gambling: "Cá cược",
  cash_advance: "Ứng tiền mặt",
  jewelry: "Trang sức",
  electronics: "Điện tử",
  travel: "Du lịch",
  ecommerce: "TMĐT",
  fashion: "Thời trang",
  other: "Khác",
  entertainment: "Giải trí",
  transport: "Vận tải",
  subscription: "Đăng ký",
  grocery: "Tạp hóa",
  food: "Ẩm thực",
  healthcare: "Y tế",
  education: "Giáo dục",
  utilities: "Tiện ích",
};

export const CHANNEL_LABELS: Record<string, string> = {
  online: "Online",
  pos: "POS",
  atm: "ATM",
  transfer: "Chuyển khoản",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Quản trị",
  analyst: "Chuyên viên",
  viewer: "Chỉ xem",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Mới",
  in_review: "Đang xử lý",
  awaiting_info: "Chờ thông tin",
  resolved: "Đã đóng",
};

export const DECISION_LABELS: Record<string, string> = {
  confirmed_fraud: "Xác nhận gian lận",
  false_positive: "Cảnh báo sai",
  escalated: "Chuyển cấp",
};

export const RISK_BANDS: Record<
  string,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  critical: {
    label: "Rất cao",
    text: "text-coral-400",
    bg: "bg-coral-500/10",
    border: "border-coral-400/30",
    dot: "bg-coral-400",
  },
  high: {
    label: "Cao",
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-400/30",
    dot: "bg-amber-400",
  },
  medium: {
    label: "Trung bình",
    text: "text-azure-400",
    bg: "bg-azure-500/10",
    border: "border-azure-400/30",
    dot: "bg-azure-400",
  },
  low: {
    label: "Thấp",
    text: "text-mint-300",
    bg: "bg-mint-500/10",
    border: "border-mint-400/25",
    dot: "bg-mint-400",
  },
};

export const PRIORITY_STYLES: Record<string, string> = {
  P1: "border-coral-400/30 bg-coral-500/10 text-coral-400",
  P2: "border-amber-400/30 bg-amber-500/10 text-amber-400",
  P3: "border-white/10 bg-white/[0.04] text-slate-300",
};

export const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatVND(value: number): string {
  return vnd.format(value);
}

export function compactVND(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} tỷ ₫`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} tr ₫`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} ng ₫`;
  return formatVND(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${datePart} · ${timePart}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return "—";
  const seconds = Math.round((Date.now() - date) / 1000);
  if (seconds < 60) return "vừa xong";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatDate(value);
}

export function slaState(due: string | null, status: string): { label: string; tone: "ok" | "warn" | "bad" | "done" } {
  if (status === "resolved") return { label: "Đã xử lý", tone: "done" };
  if (!due) return { label: "Không SLA", tone: "ok" };
  const diff = new Date(due).getTime() - Date.now();
  const hours = diff / 3_600_000;
  if (hours < 0) {
    const over = Math.abs(hours);
    return { label: over < 24 ? `Quá hạn ${Math.round(over)}h` : `Quá hạn ${Math.round(over / 24)} ngày`, tone: "bad" };
  }
  if (hours < 4) return { label: `Còn ${Math.round(hours * 60)} phút`, tone: "warn" };
  if (hours < 48) return { label: `Còn ${Math.round(hours)} giờ`, tone: "ok" };
  return { label: `Còn ${Math.round(hours / 24)} ngày`, tone: "ok" };
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? value;
}

export function channelLabel(value: string): string {
  return CHANNEL_LABELS[value] ?? value;
}

export function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? value;
}

export function decisionLabel(value: string | null): string {
  return value ? DECISION_LABELS[value] ?? value : "Chưa kết luận";
}

export function roleLabel(value: Role): string {
  return ROLE_LABELS[value] ?? value;
}

export function slugDate(date: string): string {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(date));
}

export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Đăng nhập",
  "auth.login_failed": "Đăng nhập thất bại",
  "case.update": "Cập nhật case",
  "case.decision": "Kết luận case",
  "case.note": "Thêm ghi chú",
  "case.explain": "Tạo giải thích AI",
  "transaction.ingest": "Nhập giao dịch",
  "transaction.simulate": "Mô phỏng giao dịch",
  "rule.create": "Tạo rule",
  "rule.update": "Sửa rule",
  "rule.delete": "Xoá rule",
  "user.create": "Tạo người dùng",
  "user.update": "Cập nhật người dùng",
  "user.reset_password": "Đặt lại mật khẩu",
  "settings.update": "Cập nhật cấu hình",
  "demo.seed": "Khởi tạo dữ liệu demo",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
