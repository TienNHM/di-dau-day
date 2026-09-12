# Worker nhận đóng góp

Nhận form từ website và tạo GitHub issue. Deploy **riêng biệt** với web — không nằm
trong `pnpm install` hay build của Next.js, nên CI của site không phải tải `wrangler`.

Lý do tồn tại: đường đóng góp trước đó là link tạo issue trực tiếp trên GitHub, tức là
**bắt buộc có tài khoản GitHub**. Gần như không ai biết một quán ngon lại có tài khoản
GitHub. Worker này giữ token ở server để người dùng chỉ cần điền form.

---

## Cài đặt lần đầu

### 1. Tạo GitHub token

Tạo **fine-grained personal access token**
(Settings → Developer settings → Personal access tokens → Fine-grained):

- **Repository access**: chỉ `TienNHM/di-dau-day`
- **Permissions**: `Issues` → **Read and write**. Không cấp gì thêm.
- **Expiration**: đặt hạn và ghi lịch gia hạn

> Quyền hẹp là quan trọng. Token này nằm sau một endpoint công khai; nếu lộ, thiệt hại
> tối đa chỉ là spam issue trên đúng một repo — không phải toàn bộ tài khoản.

### 2. Deploy

```bash
cd workers/contribute
npm install
npx wrangler login
npx wrangler secret put GITHUB_TOKEN      # dán token vừa tạo
npx wrangler deploy
```

Wrangler in ra URL dạng `https://didauday-contribute.<tài-khoản>.workers.dev`.

### 3. Trỏ web sang Worker

Thêm URL đó vào [`deploy.yml`](../../.github/workflows/deploy.yml):

```yaml
NEXT_PUBLIC_CONTRIBUTE_ENDPOINT: https://didauday-contribute.<tài-khoản>.workers.dev
```

Không đặt biến này thì form **tự động lùi về** link tạo issue trên GitHub, nên site
không bao giờ hỏng vì Worker chưa sẵn sàng.

---

## Chống spam

Đây là endpoint công khai ghi được vào repo, nên phần lớn code trong Worker là để **từ
chối** chứ không phải để nhận.

| Lớp | Trạng thái |
|---|---|
| Honeypot (trường ẩn) | ✅ sẵn có |
| Giới hạn độ dài body và từng field | ✅ sẵn có |
| Chỉ nhận từ origin đã khai báo | ✅ sẵn có |
| Bắt buộc có địa chỉ hoặc mô tả | ✅ sẵn có |
| Turnstile | ⚠️ tuỳ chọn — **nên bật trước khi truyền thông** |
| Rate limit theo IP | ⚠️ cấu hình trên dashboard, xem dưới |

### Bật Turnstile (khuyến nghị)

1. Cloudflare dashboard → **Turnstile** → Add site → domain `didauday.tiennhm.io.vn`
2. Lấy **site key** và **secret key**
3. `npx wrangler secret put TURNSTILE_SECRET` → dán secret key
4. Thêm site key vào [`deploy.yml`](../../.github/workflows/deploy.yml):
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY: <site key>`

Worker **tự bật kiểm tra** khi `TURNSTILE_SECRET` tồn tại, nên thứ tự làm không quan
trọng — chưa có secret thì bỏ qua, có rồi thì bắt buộc.

### Rate limit

Cấu hình bằng **WAF rate limiting rule** trên dashboard Cloudflare, không phải trong
code. Worker không có trạng thái, nên đếm request trong code sẽ cần KV — mà free tier
của KV chỉ cho **1.000 lượt ghi mỗi ngày**, ít hơn cả lượng traffic mà một bộ rate
limit sinh ra để chịu đựng.

Gợi ý: 5 request / 10 phút / IP trên route của Worker.

---

## Chạy thử tại máy

```bash
cp .dev.vars.example .dev.vars   # rồi điền token
npx wrangler dev
```

```bash
curl -X POST http://localhost:8787 \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://didauday.tiennhm.io.vn' \
  -d '{"kind":"them-moi","placeName":"Quán thử","address":"1 Nguyễn Huệ, Quận 1","note":"Chỗ này ngồi vỉa hè, chiều có gió."}'
```

---

## Duyệt đóng góp

Issue vào repo với nhãn `đóng góp`. Nội dung do người lạ nhập, nên:

- **Đọc trước khi chép vào `data/`.** Đừng dán thẳng.
- Kiểm tra toạ độ bằng `pnpm data:verify` sau khi thêm.
- Không nhận mô tả hay ảnh chép từ Google Maps / Foody — chỉ nhận nội dung người gửi
  tự viết hoặc có quyền chia sẻ.
