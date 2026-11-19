import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { LogoMark } from "@/components/Logo";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <LogoMark size={44} />
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.3em] text-slate-600">404</p>
      <h1 className="mt-2 text-[24px] font-semibold text-white">Không tìm thấy trang</h1>
      <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-slate-500">
        Đường dẫn không tồn tại hoặc bạn không có quyền truy cập.
      </p>
      <Link to="/" className="btn-primary mt-6">
        <ArrowLeft size={14} /> Về bảng điều khiển
      </Link>
    </div>
  );
}

export function ForbiddenPage() {
  return (
    <div className="panel mt-6 flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 text-amber-400">
        <Compass size={20} />
      </div>
      <h2 className="text-[16px] font-semibold text-white">Không đủ quyền truy cập</h2>
      <p className="mt-1.5 max-w-sm text-[11.5px] leading-relaxed text-slate-500">
        Khu vực này chỉ dành cho quản trị viên. Liên hệ admin nếu bạn cần quyền thao tác.
      </p>
      <Link to="/" className="btn-ghost mt-5">
        <ArrowLeft size={13} /> Về tổng quan
      </Link>
    </div>
  );
}
