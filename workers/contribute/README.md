# Worker nhận đóng góp

Nhận form từ website và tạo GitHub issue. Deploy **riêng biệt** với web — không nằm
trong `pnpm install` hay build của Next.js, nên CI của site không phải tải `wrangler`.

Lý do tồn tại: đường đóng góp trước đó là link tạo issue trực tiếp trên GitHub, tức là
**bắt buộc có tài khoản GitHub**. Gần như không ai biết một quán ngon lại có tài khoản
GitHub. Worker này giữ token ở server để người dùng chỉ cần điền form.

---

## Worker chạy ở đâu?

**Trên Cloudflare, không phải trên GitHub hay VPS của bạn.**

| | Ở đâu |
|---|---|
| Code | Trong repo này, `workers/contribute/` |
| Lúc chạy | Edge network của Cloudflare (~300 điểm) |
| Lệnh `wrangler deploy` | Từ máy bạn *hoặc* GitHub Actions — chỉ để **đẩy code lên** |

Bạn không nuôi server nào. Free tier 100.000 request/ngày — form đóng góp không bao giờ
chạm tới con số đó.

Vì sao không phải VPS: phải tự lo TLS, uptime, process manager, tường lửa và trả tiền
hàng tháng cho một endpoint nhận vài request mỗi ngày. Vì sao không phải GitHub: Actions
không nhận request từ bên ngoài, còn Pages chỉ serve file tĩnh — form cần **một chỗ chạy
code khi có request**.

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

Có hai cách. **Lần đầu phải làm cách A**, vì secret `GITHUB_TOKEN` chỉ đặt được từ máy
đã đăng nhập Cloudflare.

#### Cách A — từ máy bạn

```bash
cd workers/contribute
npm install
npx wrangler login                        # mở trình duyệt, đăng nhập Cloudflare
npx wrangler secret put GITHUB_TOKEN      # dán token vừa tạo
npx wrangler deploy
```

Wrangler in ra URL dạng `https://didauday-contribute.<tài-khoản>.workers.dev`.

#### Cách B — tự động qua GitHub Actions

[`deploy-worker.yml`](../../.github/workflows/deploy-worker.yml) deploy lại mỗi khi
`workers/contribute/**` thay đổi. Cần thêm hai secret trong repo
(Settings → Secrets and variables → Actions):

| Secret | Lấy ở đâu |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → template **Edit Cloudflare Workers** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages, cột bên phải |

Secret đặt bằng `wrangler secret put` nằm ở Cloudflare và **không bị deploy ghi đè**,
nên `GITHUB_TOKEN` chỉ cần đặt một lần bằng cách A rồi thôi.

Chưa có secret thì workflow **vẫn xanh** và chỉ bỏ qua bước deploy kèm một dòng ghi chú
— không có badge đỏ giả để rồi ai cũng quen bỏ qua.

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
