# Deploy — GitHub Pages + Cloudflare DNS

Domain: **https://didauday.tiennhm.io.vn**

Site là static export (`output: 'export'`), publish bằng GitHub Actions.
Mỗi push lên `main` sẽ chạy `pnpm check` → `pnpm build` → upload thư mục `out/` → deploy.

---

## 1. Bật GitHub Pages

Repo → **Settings → Pages** → **Source: GitHub Actions**.

Đừng chọn "Deploy from a branch" — workflow [`deploy.yml`](../.github/workflows/deploy.yml)
dùng `actions/deploy-pages`, cần source là GitHub Actions.

## 2. DNS trên Cloudflare

Thêm record cho zone `tiennhm.io.vn`:

| Type | Name | Content | Proxy |
|---|---|---|---|
| `CNAME` | `didauday` | `<github-username>.github.io` | **DNS only** (mây xám) |

> **Quan trọng:** để **DNS only** cho tới khi GitHub cấp xong chứng chỉ HTTPS.
> Bật proxy (mây cam) quá sớm sẽ khiến GitHub không xác thực được domain và
> "Enforce HTTPS" sẽ kẹt ở trạng thái không chọn được.

## 3. Gắn custom domain

File [`public/CNAME`](../public/CNAME) đã chứa `didauday.tiennhm.io.vn` và được copy
vào `out/` mỗi lần build, nên GitHub Pages tự nhận custom domain sau deploy đầu tiên.

Sau khi deploy xong: **Settings → Pages** sẽ hiện domain kèm trạng thái chứng chỉ.
Chờ tới khi tick được **Enforce HTTPS** (thường vài phút, có thể tới ~1 giờ).

## 4. (Tuỳ chọn) Bật Cloudflare proxy

Sau khi đã có HTTPS, nếu muốn bật proxy để có cache/analytics của Cloudflare:

1. Đổi record sang **Proxied** (mây cam).
2. **SSL/TLS → Overview → Full (strict)**.

Đặt **Flexible** sẽ gây redirect loop vì GitHub Pages luôn redirect HTTP sang HTTPS.

---

## Vì sao build có `trailingSlash`

GitHub Pages phục vụ file tĩnh: `/dia-diem/binh-quoi/` map tới
`/dia-diem/binh-quoi/index.html`. Không có `trailingSlash: true`, Next xuất ra
`binh-quoi.html` và Pages sẽ trả 404 cho URL không có đuôi `.html`.

## Vì sao có `public/.nojekyll`

GitHub Pages chạy Jekyll theo mặc định, mà Jekyll bỏ qua mọi thư mục bắt đầu bằng
dấu gạch dưới — tức là toàn bộ `_next/`, nơi chứa JS và CSS. File `.nojekyll` rỗng
tắt hành vi đó.

## Chạy thử bản build ở local

```bash
pnpm build
pnpm preview     # serve out/ ở http://localhost:3000
```

Đây là cách duy nhất phát hiện sớm lỗi chỉ xuất hiện ở static export
(ví dụ route thiếu `generateStaticParams`), vì `pnpm dev` khoan dung hơn nhiều.
