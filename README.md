# Đi Đâu Đây?

> Không biết đi đâu? Để tụi mình chọn cho.

Decision engine cho trải nghiệm địa phương ở Việt Nam, bắt đầu từ **TP.HCM**.
Người dùng không biết hôm nay ăn gì / đi đâu / chơi gì → trả lời vài câu hỏi →
nhận một gợi ý cụ thể trong khoảng 15 giây → xem đường đi và share được.

**Live:** https://didauday.tiennhm.io.vn

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, RSC) — `output: 'export'` |
| Ngôn ngữ | TypeScript strict |
| Styling | Tailwind CSS 4 |
| Dữ liệu | Static JSON trong [`data/`](data/), validate bằng Zod |
| Test | Vitest (tập trung vào recommendation engine) |
| Hosting | GitHub Pages + custom domain (DNS qua Cloudflare) |

Không có database, không API, không authentication — xem [`docs/PLAN.md`](docs/PLAN.md)
để biết lý do và lộ trình mở rộng.

## Bắt đầu

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Scripts

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Static export ra `out/` |
| `pnpm preview` | Serve thư mục `out/` để kiểm tra bản build |
| `pnpm test` | Unit test |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm check` | typecheck + lint + test |

## Cấu trúc

```
data/            seed data (JSON) — nguồn dữ liệu địa điểm
docs/PLAN.md     architecture + tiến độ MVP (single source of truth)
src/app/         routes (App Router)
src/components/  UI components
src/lib/         domain logic: places, recommend, intents, geo, time, analytics
```

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://didauday.tiennhm.io.vn` | Absolute URL cho canonical + Open Graph |
| `NEXT_PUBLIC_BASE_PATH` | *(rỗng)* | Chỉ cần khi deploy dưới `github.io/<repo>` |

## Deploy

Push lên `main` → GitHub Actions build static export → publish lên GitHub Pages.
Chi tiết và lưu ý DNS ở [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Đóng góp dữ liệu

Chất lượng seed data quan trọng hơn thuật toán. Một địa điểm tốt cần địa chỉ đúng,
toạ độ đúng, khoảng giá thực tế, và một câu mô tả có cá tính.
Xem [`data/README.md`](data/README.md).
