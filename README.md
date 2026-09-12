# Đi Đâu Đây?

> Không biết đi đâu? Để tụi mình chọn cho.

Decision engine cho trải nghiệm địa phương ở Việt Nam. Không biết hôm nay ăn gì / đi đâu /
chơi gì → trả lời vài câu hỏi → nhận **một** gợi ý cụ thể trong khoảng 15 giây → xem đường
đi và chia sẻ được.

Trả về một chỗ chứ không phải một danh sách là quyết định cốt lõi: danh sách chính là vấn
đề người dùng đang muốn thoát khỏi.

**Live:** https://didauday.tiennhm.io.vn

| | |
|---|---|
| Địa điểm | **4.189** trên **9 thành phố** |
| Trang tĩnh sinh ra mỗi lần build | ~4.290 |
| Backend | không có |

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, RSC) — `output: 'export'`, tĩnh hoàn toàn |
| Ngôn ngữ | TypeScript strict (`noUncheckedIndexedAccess`) |
| UI | React 19, Tailwind CSS 4 |
| Validate dữ liệu | Zod 4 — chạy lúc build, data hỏng thì build fail |
| Test | Vitest — tập trung vào recommendation engine |
| Nguồn dữ liệu | [Overture Maps](https://overturemaps.org) (CDLA-Permissive), truy vấn Parquet trên S3 bằng **DuckDB** |
| Ảnh share | `next/og` + satori → JPEG bằng `sharp`, sinh lúc build |
| Ảnh story | Canvas 2D 1080×1920, vẽ trong trình duyệt + Web Share API |
| Cache phía client | IndexedDB, shard theo thành phố, invalidate bằng content hash |
| Form đóng góp | Cloudflare Worker + Turnstile → GitHub issue |
| Analytics | Umami (không cookie, không định danh) |
| Hosting | GitHub Pages + custom domain qua Cloudflare DNS |

Không database, không API, không authentication. Mọi trạng thái của người dùng nằm trong
trình duyệt của họ. Lý do và lộ trình ở [`docs/PLAN.md`](docs/PLAN.md) — đó là single source
of truth của dự án, không phải file này.

## Kiến trúc đáng chú ý

**Chấm điểm chuẩn hoá.** Tiêu chí không được hỏi bị **loại khỏi mẫu số** thay vì được cho
điểm tối đa. Cách làm ngây thơ khiến mọi địa điểm đều điểm cao như nhau và ngưỡng lọc
tương đối không loại được gì — lỗi này do chính unit test bắt được.

**Shard theo thành phố + IndexedDB.** Wizard tải đúng dữ liệu thành phố của người dùng
(~60 KB gz cho TP.HCM), cache lại, và lần sau **không có request nào**. Hạn sử dụng là
content hash trong manifest được commit, không phải TTL: cache được dùng khi hash còn khớp
và bị bỏ ngay khi deploy đổi dữ liệu.

**Dữ liệu thiếu thì để trống.** `goodFor` và `priceRange` là optional vì không tập dữ liệu
mở nào có chúng. Điền đại vào là bịa, không phải dữ liệu.

## Bắt đầu

```bash
pnpm install
pnpm data:shard   # sinh public/data/ từ data/
pnpm dev          # http://localhost:3000
```

## Scripts

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Static export ra `out/` (tự chạy `prebuild`) |
| `pnpm preview` | Serve `out/` để kiểm tra bản build |
| `pnpm check` | `data:shard:check` + typecheck + lint + test — cổng CI |
| `pnpm test` / `lint` / `typecheck` | Chạy riêng từng thứ |
| `pnpm data:shard` | Sinh shard theo thành phố + manifest |
| `pnpm generate:og` | Sinh 4.189 ảnh Open Graph |
| `pnpm data:fetch` | Tải snapshot Overture về `.cache/` |
| `pnpm data:verify` | Đối chiếu toạ độ seed data với Overture |
| `pnpm data:apply` | Áp bản sửa toạ độ đủ tin cậy |
| `pnpm data:cities` | Sinh danh sách quận / huyện |
| `pnpm data:import` | Import địa điểm mới từ Overture |

## Cấu trúc

```
data/              seed data (JSON) — nguồn sự thật về địa điểm
  places/          curated (viết tay) + imported/ (từ Overture)
  cities/          thành phố và quận
docs/PLAN.md       architecture + tiến độ (single source of truth)
docs/DEPLOY.md     GitHub Pages + DNS
scripts/           sinh OG, shard dữ liệu, pipeline Overture
src/app/           routes (App Router)
src/components/    UI
src/lib/           domain: places, recommend, intents, geo, time, share, storage
workers/contribute/  Cloudflare Worker nhận form, deploy tách biệt
public/data/       shard sinh ra lúc build (gitignored)
```

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://didauday.tiennhm.io.vn` | Absolute URL cho canonical + Open Graph |
| `NEXT_PUBLIC_BASE_PATH` | *(rỗng)* | Chỉ cần khi deploy dưới `github.io/<repo>` |
| `NEXT_PUBLIC_UMAMI_SRC` | *(không có)* | URL script Umami. Không đặt thì **không nạp analytics nào** — dev và preview không gửi dữ liệu đi đâu. |
| `NEXT_PUBLIC_UMAMI_ID` | *(không có)* | Website ID của Umami |
| `NEXT_PUBLIC_CONTRIBUTE_ENDPOINT` | *(không có)* | URL Worker nhận form. Trống thì form lùi về GitHub issue. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | *(không có)* | Site key Turnstile |

Giá trị production nằm trong [`deploy.yml`](.github/workflows/deploy.yml) chứ không phải
secret: website id của Umami hiển thị công khai trong mã nguồn trang, nên giấu nó không đem
lại gì. Secret thật (`GITHUB_TOKEN`, `TURNSTILE_SECRET`) nằm ở Cloudflare, đặt bằng
`wrangler secret put`, và không bao giờ tới trình duyệt.

## Deploy

Push lên `main` → GitHub Actions build static export → publish lên GitHub Pages.
Worker deploy riêng, chỉ khi `workers/contribute/**` đổi.
Chi tiết và lưu ý DNS ở [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Đóng góp

**Dữ liệu.** Chất lượng seed data quan trọng hơn thuật toán. Một địa điểm tốt cần địa chỉ
đúng, toạ độ đúng, khoảng giá thực tế, và một câu mô tả có cá tính — phần cuối là thứ không
tập dữ liệu nào cung cấp được. Xem [`data/README.md`](data/README.md).

**Hai đường gửi.** Form trên [trang đóng góp](https://didauday.tiennhm.io.vn/dong-gop/) cho
tất cả mọi người; issue hoặc pull request vào `data/places` cho ai quen GitHub. Cả hai vào
chung một chỗ.

> Không chép mô tả hay ảnh từ Google Maps, Foody hay nguồn khác — vi phạm điều khoản của họ
> và làm hỏng giấy phép của dữ liệu ở đây.

Gửi đóng góp là bạn cấp cho dự án quyền dùng và đăng nội dung đó, **không độc quyền** — bạn
vẫn giữ bản quyền và vẫn dùng lại được ở bất cứ đâu. Toàn văn ở [`LICENSE`](LICENSE) §4.

## Giấy phép

**Công khai để đọc, không phải open source.** Mã nguồn thuộc bản quyền của tác giả, bảo lưu
mọi quyền — xem [`LICENSE`](LICENSE). Bạn được đọc, fork, chạy thử tại máy và gửi đóng góp;
không được chạy như một dịch vụ công khai hay dùng trong sản phẩm khác nếu chưa xin phép.

Đây là lựa chọn có chủ ý và **chỉ đi được một chiều**: phát hành dưới giấy phép mở hơn thì
lúc nào cũng làm được, thu lại thì không. Nên nó bắt đầu ở trạng thái chặt. Muốn dùng ngoài
phạm vi đó thì cứ hỏi.

**Dữ liệu import từ Overture Maps** (các bản ghi có `"source": "overture"`) theo giấy phép
của Overture — CDLA-Permissive-2.0 / Apache-2.0 / CC0 tuỳ nguồn thành phần, **không có điều
khoản share-alike**. Đó chính là lý do chọn Overture thay vì OpenStreetMap: ODbL của OSM sẽ
lây share-alike sang toàn bộ cơ sở dữ liệu khi công bố.
Chi tiết ở [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md).

**Nội dung biên tập và đóng góp** — mô tả, đánh giá, phân loại — không thuộc giấy phép của
Overture mà thuộc điều khoản ở trên.
