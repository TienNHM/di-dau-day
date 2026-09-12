# Seed data

Đây là nguồn dữ liệu duy nhất của sản phẩm ở giai đoạn MVP. **Chất lượng dữ liệu
quan trọng hơn thuật toán** — một gợi ý hay đến từ mô tả đúng và có cá tính,
không đến từ công thức tính điểm phức tạp.

> [!WARNING]
> **Seed data hiện tại chưa được kiểm chứng thực địa.** Các địa điểm đều là chỗ có thật
> và tồn tại lâu năm, nhưng **toạ độ, địa chỉ chi tiết, giá và giờ mở cửa là ước lượng**
> và cần được đối chiếu trước khi chạy marketing. Sai một toạ độ nghĩa là người dùng bấm
> "Xem đường đi" rồi chạy tới nhầm chỗ — đó là cách nhanh nhất để mất niềm tin.
>
> Cách kiểm chứng: mở Google Maps, tìm địa điểm, chuột phải vào đúng vị trí → copy toạ độ,
> rồi đối chiếu địa chỉ và giờ mở cửa hiển thị trên đó.

```
cities/ho-chi-minh.json    thành phố + danh sách quận (dùng cho khoảng cách & trang SEO)
places/food.json           quán ăn
places/cafe.json           cafe
places/entertainment.json  giải trí trong nhà (bowling, rạp, board game…)
places/outdoor.json        ngoài trời, công viên, ven sông
places/dating.json         hợp hẹn hò
places/family.json         hợp gia đình, trẻ em
places/activity.json       workshop, lớp học, trải nghiệm
```

Mọi file được validate bằng Zod lúc build ([`src/lib/places/schema.ts`](../src/lib/places/schema.ts)).
Sai định dạng thì **build fail** kèm đường dẫn tới field lỗi — cố ý như vậy, để một
record hỏng không lọt ra production rồi âm thầm không bao giờ match filter nào.

Kiểm tra tại chỗ:

```bash
pnpm test        # validate toàn bộ seed data
```

---

## Thêm một địa điểm

```jsonc
{
  "id": "binh-quoi-1",              // ổn định, không bao giờ dùng lại cho chỗ khác
  "slug": "khu-du-lich-binh-quoi-1", // định danh trên URL, không đổi sau khi đã share
  "name": "Khu du lịch Bình Quới 1",
  "shortName": "Bình Quới 1",        // dùng cho result card & OG image
  "category": "outdoor",
  "tags": ["ven-song", "cay-xanh", "ngoai-troi"],
  "goodFor": ["ban-be", "gia-dinh"],
  "priceRange": "100-300k",
  "avgPrice": 150000,
  "durationMinutes": [120, 240],
  "location": {
    "districtId": "binh-thanh",
    "address": "1147 Bình Quới, P.28, Bình Thạnh",
    "lat": 10.8265,
    "lng": 106.7305
  },
  "openingHours": { "default": [["07:00", "22:00"]] },
  "rating": 4.2,
  "ratingSource": "tổng hợp thủ công",
  "images": [],
  "popularity": 72,
  "editorialNote": "Ngồi ngoài bờ sông, chiều muộn có gió, hợp đi nhóm đông.",
  "status": "active",
  "updatedAt": "2026-09-12"
}
```

### Quy ước từng field

| Field | Ghi chú |
|---|---|
| `id`, `slug` | Chữ thường, số, gạch ngang. **Không đổi `slug`** sau khi đã public — đó là URL được share. |
| `tags` | Chỉ dùng tag có trong [`TAGS`](../src/lib/places/types.ts). Danh sách đóng là cố ý: tag tự do sẽ sinh ra biến thể gần giống nhau rồi âm thầm ngừng match. |
| `goodFor` | Bắt buộc, ít nhất một giá trị. Đây là tín hiệu mạnh thứ hai sau category. |
| `priceRange` | Theo **một người**. `avgPrice` chỉ để hiển thị "~150K"; việc chấm điểm dùng bracket. |
| `durationMinutes` | `[min, max]`. Thiếu field này thì result card mất dòng "⏱ ~3 giờ". |
| `lat`, `lng` | Lấy từ Google Maps (chuột phải → toạ độ). Schema chặn lat/lng bị đảo. |
| `openingHours` | `default` áp cho mọi ngày; key theo thứ (`mon`…`sun`) ghi đè. Mảng rỗng = đóng cửa. Bỏ trống = không rõ, và sẽ được chấm điểm trung tính chứ không bị phạt. |
| `popularity` | 0–100, do người biên tập cho. Thay cho dữ liệu sử dụng thật mà ta chưa có. |
| `editorialNote` | 10–200 ký tự. **Đây là thứ tạo khác biệt** — lý do người ta chụp màn hình kết quả. Viết một câu cụ thể, tránh câu quảng cáo chung chung. |
| `status` | `active` vào gợi ý; `hidden` tạm ẩn; `closed` đã đóng cửa nhưng **giữ lại** để URL đã share không trả 404. |

### Giờ mở cửa qua nửa đêm

Giờ đóng nhỏ hơn giờ mở nghĩa là qua ngày hôm sau:

```jsonc
"openingHours": { "default": [["18:00", "02:00"]] }   // 6h tối → 2h sáng
```

### Nghỉ trưa

```jsonc
"openingHours": { "default": [["07:00", "11:00"], ["16:00", "21:00"]] }
```

---

## Về danh sách quận

`cities/ho-chi-minh.json` dùng tên quận **theo cách người Sài Gòn vẫn gọi**
(Quận 1, Bình Thạnh, Thủ Đức…), không phải đơn vị hành chính mới nhất sau các đợt
sáp nhập. Sản phẩm này phục vụ việc định vị "chỗ đó nằm khu nào", nên bám theo cách
gọi quen thuộc hữu ích hơn là bám theo tên hành chính chính xác.

Toạ độ quận là điểm trung tâm xấp xỉ, chỉ dùng để chấm điểm khoảng cách ở mức thô.

---

## Nguồn dữ liệu

**Không scrape Google Maps hay Foody** — vi phạm điều khoản sử dụng của họ.
Dữ liệu nên đến từ:

- Hiểu biết cá nhân và đi thực tế
- OpenStreetMap (ODbL, cần ghi nguồn)
- Website/fanpage chính thức của địa điểm
- Đóng góp của cộng đồng

Ảnh chỉ thêm khi có quyền sử dụng rõ ràng. MVP cố tình không dùng ảnh: result card
dựng bằng gradient và typography lớn, vừa sạch về pháp lý vừa nổi bật hơn ảnh stock
khi xuất hiện trên feed mạng xã hội.
