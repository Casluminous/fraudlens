# Model card — FraudLens risk model

## Tổng quan

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản | `gbdt-1.0.0` |
| Thuật toán | `HistGradientBoostingClassifier` (scikit-learn 1.9.1) |
| Bài toán | Binary classification: giao dịch gian lận / không gian lận |
| Số feature | 13 |
| Số mẫu | 72.768 giao dịch tổng hợp |
| Train / test | 80% / 20%, chia theo thời gian (time-based split) |
| Ngưỡng mặc định | 0.5 cho metric; hệ thống dùng risk score blend với rule |
| Artifact | `app/ml/artifacts/model.joblib`, `metadata.json` |

## Chỉ số trên tập test

| Metric | Giá trị |
|---|---|
| ROC-AUC | **0.9769** |
| Precision | 0.9169 |
| Recall | 0.7236 |
| Fraud rate trong dataset | ~7.6% |
| Average precision | ~0.95 |

> Đây là benchmark trên **dữ liệu mô phỏng**, không đại diện cho hiệu năng trên dữ liệu ngân hàng thật.

## Feature

| Feature | Mô tả |
|---|---|
| `amount_log` | log(1 + số tiền) |
| `hour_sin`, `hour_cos` | Chu kỳ giờ trong ngày (múi giờ UTC+7) |
| `is_night` | 23h–5h |
| `country_mismatch` | Quốc gia IP ≠ quốc gia thẻ |
| `new_device` | Thiết bị chưa từng xuất hiện trong lịch sử khách hàng |
| `velocity_1h`, `velocity_24h` | Số giao dịch trong 1h/24h |
| `amount_ratio_log` | log(1 + amount / trung bình 30 ngày) |
| `distinct_merchants_24d` | Số merchant khác nhau trong 24h |
| `account_age_days` | Tuổi tài khoản (tính từ giao dịch đầu tiên) |
| `category_risk` | Mức rủi ro ngành hàng (crypto/gift card/cá cược cao nhất) |
| `channel_online` | Giao dịch online |

## Feature importance (permutation, 3 vòng)

| Feature | Importance |
|---|---|
| Giờ giao dịch (sin + cos) | 39.1% |
| Kênh online | 24.3% |
| Rủi ro ngành hàng | 12.6% |
| Tần suất 1 giờ | 8.5% |
| Giá trị giao dịch | 8.2% |
| So với chi tiêu thường ngày | 4.1% |
| Lệch quốc gia IP/thẻ | 1.7% |
| Tần suất 24 giờ | 1.0% |

## Dữ liệu huấn luyện

- Sinh tổng hợp bằng `app/ml/synthetic.py`, seed cố định để tái lập.
- Hành vi hợp lệ: chi tiêu theo ngành, giờ sinh hoạt, thiết bị quen, du lịch nước ngoài, mua sắm lớn.
- Gian lận mô phỏng 5 pattern: thử thẻ, chiếm đoạt tài khoản, lệch địa lý, bùng nổ velocity, ngành hàng rủi ro.
- 35–60% fraud event là “soft fraud” với tín hiệu yếu, cố tình chồng lấn với hành vi hợp lệ để tránh model học ranh giới quá dễ.
- Nhiễu hợp lệ: khách đi du lịch, đổi thiết bị, mua hàng giá trị lớn ban đêm.

## Cách sử dụng

- Model chỉ tạo **tín hiệu rủi ro**, không tự động block/kết luận.
- Kết hợp với rule engine theo trọng số cấu hình (mặc định 55/45).
- Analyst xem rule hit + contribution + so sánh hành vi trước khi quyết định.

## Hạn chế & rủi ro

1. **Dữ liệu tổng hợp**: phân phối không phản ánh đầy đủ hành vi thật, đặc biệt các dạng fraud chưa biết.
2. **Recall 72%**: một phần gian lận vẫn có thể lọt; rule engine và kiểm soát thủ công là lớp bổ sung.
3. **Mất cân bằng**: dataset mô phỏng có fraud rate cao hơn thực tế; precision trên production có thể giảm.
4. **Thiên lệch tiềm ẩn**: feature ngành hàng, quốc gia có thể ảnh hưởng không đồng đều giữa nhóm khách hàng; cần kiểm định fairness trước khi triển khai.
5. **Không dùng cho quyết định tự động** hoặc chấm điểm tín dụng.
6. **Drift**: chưa có giám sát phân phối feature theo thời gian; nên bổ sung monitoring khi vận hành thật.

## Tái lập

```powershell
.\.venv\Scripts\python -m app.ml.train --days 60 --customers 900
```

Metadata sau huấn luyện được ghi tại `app/ml/artifacts/metadata.json` và hiển thị trong trang **Cài đặt → Model card**.
