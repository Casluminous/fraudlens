# Đối chiếu đề bài → triển khai

Đề tài 10: **Hệ thống chấm điểm rủi ro giao dịch có AI giải thích cảnh báo** — Data + AI / Fraud Analytics.

| Yêu cầu trong đề | Đã triển khai | Minh chứng |
|---|---|---|
| Ingest giao dịch | API `POST /api/transactions`, modal “Nhập giao dịch”, simulator | `app/routers/transactions.py`, `frontend/src/pages/Transactions.tsx` |
| Tính feature hành vi | Velocity 1h/24h, tỷ lệ chi tiêu 30 ngày, thiết bị mới, lệch quốc gia, giờ đêm, số merchant/24h | `app/features.py`, `app/scoring.py` |
| Áp rule engine | 8 rule seed + UI condition builder, bật/tắt, weight, severity, hit count | `app/rules.py`, `app/routers/rules.py`, `frontend/src/pages/Rules.tsx` |
| Mô hình phát hiện bất thường | HistGradientBoosting 13 feature, artifact + model card, huấn luyện tái lập | `app/ml/train.py`, `app/ml/artifacts/`, `docs/model-card.md` |
| Chấm risk score | Blend ML + rule theo trọng số cấu hình, band low/medium/high/critical | `app/scoring.py` |
| Hiển thị case đáng ngờ | Hàng chờ có filter, tìm kiếm, ưu tiên, SLA, phân công, trạng thái | `frontend/src/pages/Queue.tsx` |
| Analyst cập nhật trạng thái điều tra | PATCH case, nhận xử lý, đổi trạng thái, ghi chú, timeline | `app/routers/cases.py`, `frontend/src/pages/CaseDetail.tsx` |
| AI tóm tắt vì sao bị gắn cờ | Explanation gồm summary + why_flagged + signals | `app/explain.py` |
| So sánh với hành vi bình thường | Thống kê 30 ngày: số giao dịch, chi tiêu TB, ngành quen thuộc | `app/explain.py::_history_stats` |
| Gợi ý câu hỏi xác minh | 3–4 câu hỏi theo ngữ cảnh (đêm, thiết bị mới, lệch IP, velocity) | `app/explain.py::_offline_content` / prompt LLM |
| Tạo note xử lý | Ghi chú nháp AI + nút lưu vào case, ghi chú analyst thủ công | `POST /cases/{id}/notes` |
| Dashboard fraud | KPI, trend, phân bố điểm, ngành hàng, priority queue, rule hit, cảnh báo mới | `app/routers/dashboard.py`, `frontend/src/pages/Dashboard.tsx` |
| Queue ưu tiên | P1/P2/P3, SLA 4h/12h/48h, sắp xếp ưu tiên/SLA/score | `app/scoring.py::priority_for`, `Queue.tsx` |
| Audit trail | Log before/after, actor, IP, UA cho login, case, rule, user, settings | `app/audit.py`, `app/routers/audit.py` |
| Tránh tự động kết luận khi chưa có người xác nhận | API chặn decision thiếu `confirm`/note; case resolved phải có decision; không thể ghi đè; UI disclaimer | `app/routers/cases.py::decide_case` |
| Sản phẩm web hoàn chỉnh | React SPA: login, dashboard, queue, case, transactions, rules, users, audit, settings | `frontend/src/pages/` |
| Deployed online (URL) | Docker + Render blueprint, health check, hướng dẫn deploy | `Dockerfile`, `render.yaml`, README |
| Đăng nhập & phân quyền cơ bản | JWT + refresh cookie, RBAC admin/analyst/viewer, chặn ở API | `app/security.py`, `app/deps.py`, `frontend/src/App.tsx` |
| UI/UX hoàn chỉnh | Design system dark fintech, responsive, skeleton, empty/error state, toast, modal, chart | `frontend/src/index.css`, `components/` |
| Quản lý user | Tạo user, đổi role, bật/tắt, reset mật khẩu, thu hồi phiên | `app/routers/users.py`, `frontend/src/pages/Users.tsx` |
| Không nhận notebook/CLI/prototype localhost | SPA + API + Postgres + Docker/Render; không có notebook | Toàn bộ repo |

## Yêu cầu phi chức năng

| Yêu cầu | Cách xử lý |
|---|---|
| Bảo mật | scrypt password hash, JWT ngắn hạn, refresh token hash DB, rate-limit login, security headers, whitelist rule field |
| Khả năng giải thích | Rule hit + contribution + so sánh baseline, AI/offline explanation, model card |
| Kiểm soát con người | 3 lớp: UI banner, API confirm, audit bất biến |
| Dữ liệu nhạy cảm | Không dùng PII thật; toàn bộ dữ liệu demo tổng hợp |
| Vận hành | Health check, seed idempotent, Docker, biến môi trường |
| Kiểm thử | 10 API test + lint + build TypeScript |

## Phần có thể mở rộng thêm

- Import CSV hàng loạt và webhook streaming.
- Alembic migration + CI (GitHub Actions).
- SHAP explainer thật thay cho heuristic contribution.
- Giám sát drift & fairness dashboard.
- SSO, email/Slack alert, phân ca trực.
