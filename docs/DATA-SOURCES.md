# Nguồn dữ liệu & giấy phép

## Overture Maps Foundation

Dữ liệu toạ độ, địa chỉ và phân loại địa điểm đối chiếu từ **Overture Maps Places**,
release `2026-08-19.0`.

> Data from Overture Maps Foundation — https://overturemaps.org
> Licensed under CDLA-Permissive-2.0, Apache-2.0 and CC0-1.0 depending on the
> contributing dataset.

Giấy phép theo từng bản ghi trong vùng TP.HCM (đã kiểm tra thực tế):

| Nguồn | Số bản ghi | Giấy phép |
|---|---|---|
| Meta | 305.917 | CDLA-Permissive-2.0 |
| Microsoft | 2.093 | CDLA-Permissive-2.0 |
| AllThePlaces | 968 | CC0-1.0 |
| Foursquare | 864 | Apache-2.0 |

**Không có bản ghi nào mang giấy phép share-alike.** Đây là lý do chọn Overture thay
vì OpenStreetMap — xem phần dưới.

## Vì sao không dùng OpenStreetMap

OSM phát hành theo **ODbL**, có điều khoản share-alike. Điều khoản này kích hoạt khi
bạn **công khai** một derivative database — mà `data/places/*.json` nằm trong repo
public, nên đúng là công khai. Trộn dữ liệu OSM vào đó sẽ buộc toàn bộ danh mục địa
điểm của dự án phải phát hành theo ODbL.

Ngoài ra, đo thực tế trên 4.000 POI ăn uống ở TP.HCM cho thấy OSM cũng mỏng hơn hẳn:

| | Overture | OSM |
|---|---|---|
| Có địa chỉ | 96% | 33% |
| Có điện thoại | 90% | 12% |
| Có tên quận sẵn | có | không |
| Giờ mở cửa | ❌ không có | 14% |

OSM chỉ hơn ở đúng một điểm: **giờ mở cửa**. Hiện tại dự án chấp nhận để trống giờ mở
cửa và nhập tay dần, vì engine đã chấm điểm `unknown` ở mức nửa điểm chứ không phạt.

## Vì sao không dùng Google Places / Foody

- **Google Places API** cấm lưu trữ dữ liệu quá 30 ngày (trừ `place_id`) và cấm xây
  database cạnh tranh. Seed file JSON tĩnh từ đó là vi phạm điều khoản.
- **Foody / ShopeeFood / TripAdvisor** không có API công khai; scrape vi phạm ToS.

Riêng `place_id` của Google được phép lưu vô thời hạn, nên field `googleMapsPlaceId`
trong schema vẫn hợp lệ — chỉ là việc lấy nó cần gọi API trả phí.

## Những gì Overture KHÔNG cung cấp

Ba field quan trọng nhất vẫn phải làm tay, và không nguồn mở nào thay thế được:

| Field | Vì sao |
|---|---|
| `openingHours` | Overture không có field này |
| `priceRange`, `avgPrice` | Không nguồn mở nào có |
| `editorialNote` | **Đây là thứ tạo khác biệt của sản phẩm** |

`operating_status` của Overture về lý thuyết cho biết quán còn mở hay đã đóng, nhưng
thực tế gần như rỗng — chỉ 13 trên 309.855 bản ghi có giá trị, nên không dùng để phát
hiện quán đã đóng cửa được.

---

## Pipeline

```bash
pnpm data:fetch                 # tải snapshot mọi thành phố về .cache/ (chậm, chạy 1 lần)
pnpm data:fetch ho-chi-minh     # chỉ một thành phố
pnpm data:verify                # đối chiếu data/places/*.json với snapshot
pnpm data:apply                 # chạy thử: in ra toạ độ sẽ sửa
pnpm data:apply --write         # ghi thật vào data/places/*.json
```

`.cache/` bị gitignore — tạo lại bằng `pnpm data:fetch` chứ không commit.

### `data:apply` chỉ sửa toạ độ

Tên, giá, tag và `editorialNote` **không bao giờ bị ghi đè**. Đó là những phán đoán mà
không dataset nào thay con người quyết được, và lặng lẽ thay bằng câu chữ của bên thứ
ba sẽ phá hỏng đúng thứ làm sản phẩm này đáng dùng.

### Ngưỡng an toàn khi tự sửa toạ độ

Càng dời xa thì càng đòi hỏi địa chỉ khớp chặt hơn:

| Khoảng lệch | Yêu cầu địa chỉ khớp |
|---|---|
| ≤ 300 m | ≥ 0,50 |
| ≤ 1.000 m | ≥ 0,75 |
| > 1.000 m | **không bao giờ tự sửa** |

Lý do: một địa điểm có địa chỉ thật sự khớp thì không nằm cách chỗ ta tưởng hai cây số.
Lần chạy thử đầu tiên đã định dời "Chi Cafe" 1,9 km và "Saigon Coffee Roastery" 2,5 km
chỉ với điểm địa chỉ 0,5 — cả hai đều là match nhầm sang quán khác trùng tên.

### Kết quả lần chạy đầu (TP.HCM, 114 địa điểm)

| | Trước | Sau |
|---|---|---|
| Lệch ≤ 200 m | 40 | **55** |
| Lệch xa hơn | 55 | 40 |

48 toạ độ đã được sửa. 40 trường hợp còn lại bị bỏ qua có chủ đích vì địa chỉ không đủ
đối chứng — **cần người kiểm tra tay**, đừng nới ngưỡng để ép con số đẹp hơn.
