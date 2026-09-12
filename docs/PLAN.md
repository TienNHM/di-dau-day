# Đi Đâu Đây? — Kế hoạch MVP

> Tài liệu này là **nguồn tham chiếu duy nhất** cho architecture và tiến độ MVP.
> Cập nhật checklist ở [§7](#7-progress-tracking) mỗi khi hoàn thành một bước.

**Trạng thái:** Phase 0 và Phase 1 đã xong
**Cập nhật lần cuối:** 2026-09-12

---

## 0. Bối cảnh

- Repo khởi tạo từ trống (greenfield), không có stack có sẵn cần giữ.
- Toolchain: Node 22.22, pnpm 11.17, git 2.52, .NET 10.0.301.
- Positioning: **decision engine for local experiences**, không phải Google Maps/Foody.
- Thành phố đầu tiên: **TP.HCM**.

Nguyên tắc xuyên suốt: *Build the smallest thing that can go viral.*

---

## 1. Architecture

**Một Next.js app duy nhất, App Router, TypeScript, Tailwind, dữ liệu static JSON, **static export** deploy lên GitHub Pages. MVP không có API, không database, không auth.**

```
Browser (mobile-first)
   │
   ├─ Static HTML (prerender) ───► Next.js App Router (RSC, output: 'export')
   │                                   │
   │                                   ├─ src/lib/places/   ← PlaceRepository (interface)
   │                                   │      └─ StaticPlaceRepository (đọc /data JSON lúc build)
   │                                   └─ src/lib/recommend/ ← pure scoring + weighted random
   │
   ├─ Wizard + spin animation ────► Client Components (state machine bằng reducer)
   │
   └─ opengraph-image.tsx ───────► next/og → PNG sinh lúc build, serve tĩnh
```

Ba quy tắc giữ cho MVP rẻ mà vẫn mở rộng được:

1. **Mọi truy cập dữ liệu đi qua `PlaceRepository`.** MVP implement bằng static JSON.
   Sau này chuyển sang .NET 10 API + PostgreSQL chỉ cần viết `HttpPlaceRepository`
   và đổi một factory function — không page/component nào chạm trực tiếp vào JSON.
2. **Recommendation engine là pure function**, không I/O, không import framework:
   `(places, criteria) => { winner, candidates, reasons }`. Test được bằng Vitest,
   sau này port sang C# được nếu cần chạy server-side.
3. **Wizard là URL-driven state machine** — back button, refresh, share đều đúng,
   và mỗi bước funnel đều đo được bằng analytics.

### Ràng buộc từ GitHub Pages

GitHub Pages là static hosting thuần — không Node server, không edge runtime, không ISR.
Hệ quả với codebase:

- `next.config.ts` dùng `output: 'export'`; không có route handler (`app/api/**`),
  không `revalidate`, không middleware, không server action.
- **OG image sinh lúc build** qua `opengraph-image.tsx` + `generateStaticParams`,
  xuất ra PNG tĩnh — không phải edge function.
- **Custom domain `didauday.tiennhm.io.vn`** (GitHub Pages → DNS qua Cloudflare), nên site
  phục vụ ở root và **không cần `basePath`**. Vẫn đọc từ `NEXT_PUBLIC_BASE_PATH` (mặc định
  rỗng) để chạy được cả trên `github.io/di-dau-day` khi cần preview.
- File `public/CNAME` chứa domain — GitHub Pages đọc file này để gắn custom domain.
- `NEXT_PUBLIC_SITE_URL=https://didauday.tiennhm.io.vn` dùng cho canonical URL và
  absolute URL trong OG metadata (share preview bắt buộc phải là absolute URL).
- `trailingSlash: true` để mỗi route xuất ra `<route>/index.html` — cách GitHub Pages
  phục vụ file tĩnh.
- `images.unoptimized = true` (không có image optimizer). MVP không dùng ảnh nên không mất gì.
- File `.nojekyll` ở thư mục xuất bản, nếu không Jekyll sẽ nuốt thư mục `_next`.
- Analytics: không có Vercel Analytics. `lib/analytics/track.ts` mặc định no-op, nạp
  provider ngoài (Umami/Plausible/GA) qua biến môi trường khi cần.

Kiến trúc còn lại không đổi: wizard giữ state trong query param nên chạy hoàn toàn
client-side, và share URL = place URL vốn đã là trang tĩnh prerender.

**Lưu ý DNS:** ở Cloudflare, đặt record `didauday` là `CNAME → <user>.github.io` và để
**DNS only (không bật proxy)** cho tới khi GitHub cấp xong chứng chỉ HTTPS; bật proxy quá
sớm sẽ làm GitHub không xác thực được domain. Sau khi có cert, muốn bật proxy thì đặt
SSL/TLS mode là **Full (strict)**.

### Vì sao chưa dùng monorepo

`apps/web` + `apps/api` + `packages/shared` tốn thời gian setup mà không đem lại gì
khi mới có một app. Bắt đầu phẳng; khi có API thì nâng lên pnpm workspace bằng `git mv`.

### Vì sao chưa dùng database

100–300 places ≈ 200KB JSON. Ship dưới dạng build-time data nghĩa là: chi phí hạ tầng
bằng 0, không cold start, toàn bộ catalogue sẵn sàng cho engine mà không N+1 query,
và mọi trang địa điểm đều prerender được cho SEO.

---

## 2. Page structure

URL tiếng Việt, dễ đọc, có giá trị SEO:

| Route | Rendering | Mục đích |
|---|---|---|
| `/` | Static | Landing + chọn intent (5 nút) |
| `/an-gi` | Static | Wizard: Ăn gì |
| `/cafe` | Static | Wizard: Cafe nào |
| `/hen-ho` | Static | Wizard: Hẹn hò (có thể trả mini-itinerary) |
| `/choi-gi` | Static | Wizard: Chơi gì |
| `/di-dau` | Static | Wizard: Đi đâu |
| `/dia-diem/[slug]` | SSG | **Result page = place page.** Đích của share |
| `/dia-diem/[slug]/opengraph-image` | SSG (PNG lúc build) | OG image 1200×630 |
| `/quan/[district]` | SSG | SEO landing: "Ăn gì ở Bình Thạnh" |
| `/ve-chung-toi`, `/dong-gop` | Static | Giới thiệu + form gợi ý địa điểm (Google Form ở MVP) |

### Quyết định quan trọng: share URL = place URL

Thay vì sinh ID mờ `/result/abc123` (cần DB hoặc KV để resolve),
**result page chính là trang canonical của địa điểm đó**, context của user nằm ở query param:

```
/dia-diem/binh-quoi-resort?tu=di-dau&ai=ban-be&vi=150k
```

Được ba thứ cùng lúc:

- **Viral loop** — link share render result card đẹp kèm CTA "Thử cho tôi" dẫn về `/di-dau`.
- **SEO** — 300 trang địa điểm prerender + các trang quận. Đây là kênh traffic cộng dồn
  mà random-spin không bao giờ tự có.
- **Zero infra** — không lưu ID, không expiry, không KV.

Query param chỉ tô màu cho copy ("Hợp với: Bạn bè") và OG image; trang vẫn hợp lệ khi thiếu.

Các bước wizard cũng nằm ở query param (`/di-dau?ai=ban-be&vi=150k&step=2`) để wizard
đang dở vẫn sống sót qua refresh, và mỗi bước bắn được một funnel event.

---

## 3. Component structure

```
src/
├─ app/
│  ├─ layout.tsx                 # fonts, analytics, viewport
│  ├─ page.tsx                   # landing
│  ├─ (wizard)/
│  │  ├─ layout.tsx              # progress bar + back affordance dùng chung
│  │  ├─ an-gi/page.tsx          # mỗi trang = <IntentWizard intent="food" />
│  │  ├─ cafe/page.tsx
│  │  ├─ hen-ho/page.tsx
│  │  ├─ choi-gi/page.tsx
│  │  └─ di-dau/page.tsx
│  ├─ dia-diem/[slug]/
│  │  ├─ page.tsx                # generateStaticParams + generateMetadata
│  │  └─ opengraph-image.tsx
│  └─ quan/[district]/page.tsx
│
├─ components/
│  ├─ ui/                        # primitives: Button, Card, Chip, Sheet, Skeleton
│  ├─ intent/
│  │  ├─ IntentGrid.tsx          # 5 nút lớn
│  │  └─ IntentCard.tsx
│  ├─ wizard/
│  │  ├─ IntentWizard.tsx        # orchestrator; giữ reducer
│  │  ├─ QuestionStep.tsx        # một câu hỏi, N lựa chọn
│  │  ├─ OptionChip.tsx
│  │  └─ ProgressDots.tsx
│  ├─ spin/
│  │  ├─ SpinStage.tsx           # màn reveal ~2.5s
│  │  ├─ CandidateReel.tsx       # danh sách candidate chạy qua
│  │  └─ useSpinSequence.ts      # timing, tôn trọng prefers-reduced-motion
│  ├─ result/
│  │  ├─ ResultCard.tsx          # hero — phải đẹp ngay khi screenshot
│  │  ├─ ResultMeta.tsx          # các dòng 📍 💰 ⏱ ⭐
│  │  ├─ DirectionsButton.tsx    # maps deep link
│  │  ├─ ShareButton.tsx         # Web Share API → fallback clipboard
│  │  ├─ RerollButton.tsx        # "Chọn lại" — sống còn cho retention
│  │  └─ SponsoredBadge.tsx
│  └─ itinerary/ItineraryTimeline.tsx   # hẹn hò: cafe → activity → dinner
│
├─ lib/
│  ├─ places/
│  │  ├─ types.ts                # Place, City, District, Category, PriceRange…
│  │  ├─ schema.ts               # Zod — validate /data lúc build
│  │  ├─ repository.ts           # interface PlaceRepository
│  │  └─ static-repository.ts    # implementation cho MVP
│  ├─ recommend/
│  │  ├─ criteria.ts             # type Criteria + codec URL <-> Criteria
│  │  ├─ score.ts                # pure scoring
│  │  ├─ select.ts               # weighted random trên top-K
│  │  ├─ itinerary.ts            # composer cho hẹn hò
│  │  └─ *.test.ts
│  ├─ intents/registry.ts        # ⭐ intent → questions → options → filters
│  ├─ geo/{haversine,maps-link}.ts
│  ├─ time/open-now.ts           # theo Asia/Ho_Chi_Minh
│  └─ analytics/track.ts         # lớp mỏng bọc provider
│
└─ data/
   ├─ cities/ho-chi-minh.json    # districts + centroid
   └─ places/{food,cafe,entertainment,outdoor,dating}.json
```

Thứ giữ cho cấu trúc này không phình ra là **`lib/intents/registry.ts`**: mỗi intent là
*dữ liệu* — câu hỏi, lựa chọn, icon, và cách map mỗi lựa chọn sang scoring criteria.
Thêm "Đi đâu cuối tuần?" sau này = thêm một entry trong registry + seed data,
không phải dựng cây page mới.

---

## 4. Data model

```ts
type Place = {
  id: string;                    // ổn định, không bao giờ tái sử dụng
  slug: string;                  // "binh-quoi-resort" — định danh trên URL
  name: string;
  shortName?: string;            // cho spin reel & OG image
  category: Category;            // Food | Cafe | Entertainment | Outdoor |
                                 // Dating | Family | Shopping | Activity
  subCategory?: string;          // "bun-bo", "board-game"
  tags: Tag[];                   // lam-viec | chill | yen-tinh | chup-anh |
                                 // ngoai-troi | may-lanh | nhom-dong | lang-man …
  goodFor: Companion[];          // mot-minh | nguoi-yeu | ban-be | gia-dinh
  priceRange: PriceRange;        // under100k | 100to300k | 300to500k | over500k
  avgPrice?: number;             // VND, để sort mịn hơn
  durationMinutes?: [min, max];  // để hiện "⏱ ~3 giờ"
  location: {
    districtId: string;          // "binh-thanh"
    address: string;
    lat: number; lng: number;
    googleMapsPlaceId?: string;  // deep link chỉ đường chất lượng nhất
  };
  openingHours: OpeningHours;    // khoảng giờ theo thứ, hỗ trợ qua đêm
  rating?: number;               // 0–5, nhập tay, kèm `ratingSource`
  images: PlaceImage[];          // { url, blurDataURL, credit }
  popularity: number;            // 0–100, biên tập; prior cho cold-start
  editorialNote?: string;        // một câu có cá tính — đây là moat
  sponsored?: { until: string; weight: number; label: string };
  affiliate?: { provider: string; url: string }[];
  status: 'active' | 'hidden' | 'closed';
  updatedAt: string;
};
```

Ghi chú về model:

- **`editorialNote`** là thứ tạo khác biệt. "Ngồi ngoài bờ sông, chiều muộn có gió" mới là
  lý do người ta chụp màn hình. Chất lượng dữ liệu quan trọng hơn sự tinh vi của scoring.
- **`durationMinutes` và `goodFor`** phải có ở mọi record — chúng tạo ra dòng
  "Hợp với: Bạn bè · ~3 giờ" trên card, và đó là thứ khiến card đáng share.
- **`status: 'closed'`** thay vì xóa, để URL đã share vẫn resolve được và đề xuất thay thế
  thay vì trả 404.
- **Validate bằng Zod lúc build.** Một record seed sai định dạng sẽ làm fail `pnpm build`,
  không phải fail ở production.
- Shape JSON cố tình là projection thẳng của những gì một bảng `places` sẽ trả về,
  để .NET API sau này serialize đúng DTO đó.

### Recommendation engine

```
score(place, criteria) =
    categoryMatch   × 30      // gần như hard gate
  + companionMatch  × 20
  + tagMatch        × 15      // tỉ lệ tag yêu cầu có mặt
  + budgetMatch     × 15      // đúng bracket 15, bracket kề 7, còn lại 0
  + distanceScore   × 10      // trùng quận, hoặc haversine nếu cho phép geo
  + popularity      ×  7
  + openNowScore    ×  3
  + sponsoredBoost  (≤ 8, có trần, chỉ áp cho place đã đủ điều kiện)
```

Sau đó: lọc `status==='active'` → lấy top-K (K≈12) → **weighted random** theo `score²`.
Đó là thứ tạo ra cảm giác "một lựa chọn tốt mà tôi chưa nghĩ tới" thay vì luôn ra cùng một kết quả.

Hai quy tắc cần giữ chặt:

- **Sponsored có trần và luôn được công bố.** Boost ≤8 điểm có thể đẩy một place lên
  trong nhóm đã đủ điều kiện, nhưng không bao giờ kéo được một place không liên quan lên;
  card luôn hiện badge "Được tài trợ". Placement trả tiền mà không công bố vừa là vấn đề
  niềm tin vừa là vấn đề pháp lý, và gắn sự minh bạch vào sau khó hơn nhiều so với làm đúng từ đầu.
- **Reroll loại trừ 3 kết quả gần nhất** (sessionStorage). Ra trùng địa điểm hai lần liên tiếp
  giết chết cảm giác thú vị ngay lập tức.

Engine trả về `{ winner, candidates: Place[], appliedCriteria }` — `candidates` chính là thứ
spin reel chạy qua, nên animation hiển thị **lựa chọn thật**, không phải danh sách giả.

---

## 5. Quyết định thiết kế đã chốt

| Vấn đề | Quyết định |
|---|---|
| Framework | Next.js App Router + TypeScript strict |
| Styling | Tailwind CSS |
| Dữ liệu | Static JSON trong `/data`, validate bằng Zod |
| Test | Vitest (tập trung vào recommendation engine) |
| Hosting | GitHub Pages (static export, deploy bằng GitHub Actions) |
| Maps | Deep link Google Maps (không nhúng map SDK ở MVP) |
| Ảnh ở Phase 0 | Card gradient + typography lớn, **không dùng ảnh** |
| Auth / payment / review | Không có trong MVP |

---

## 6. Rủi ro đã xác định

**Seed data mới là nút thắt, không phải code.** Code Phase 0 khoảng hai ngày; nhưng
300 địa điểm TP.HCM gắn tag chính xác kèm lat/lng, giờ mở cửa, giá và một câu mô tả
viết tay thì nặng hơn thế nhiều — và không thể scrape từ Google Maps hay Foody nếu không
vi phạm điều khoản của họ. Kế hoạch: curate thủ công (nền là OpenStreetMap + hiểu biết
cá nhân), bắt đầu ở 25, và dựng form đóng góp công khai sớm để cộng đồng phụ vào.
**80 địa điểm mô tả thật kỹ tốt hơn 300 địa điểm mỏng** — dữ liệu mỏng làm kết quả
trở nên ngẫu nhiên theo nghĩa xấu.

**Ảnh.** Result card và OG image sống chết nhờ ảnh, mà ta không được hotlink ảnh của Google.
Phương án: Phase 0 ship bằng card gradient + typography lớn, **không ảnh**. Rẻ hơn, sạch về
pháp lý, nổi bật hơn trên feed Facebook so với ảnh stock, và khớp với định hướng
"premium, typography lớn". Ảnh thật thêm sau, chỉ ở nơi ta có quyền sử dụng.

---

## 7. Progress tracking

Quy ước: **mỗi bước hoàn thành = một commit riêng.**

### Phase 0 — Vertical slice

Mục tiêu: một intent chạy hết luồng, ~25 địa điểm seed, deploy được và share được.
Đây chính là toàn bộ giả thuyết sản phẩm — ship rồi gửi cho 20 người trước khi xây thêm gì.

- [x] **0.1** Scaffold: Next.js App Router + TS strict + Tailwind + Vitest + ESLint/Prettier; `git init`
- [x] **0.2** GitHub Actions workflow deploy lên GitHub Pages (deploy sớm để không bất ngờ về sau)
- [x] **0.3** Types + Zod schema + `PlaceRepository` + `StaticPlaceRepository`
- [x] **0.4** Seed ~25 địa điểm `Outdoor`/`Dating` cho intent "Đi đâu"
- [x] **0.5** Scoring + weighted selection + unit test
- [x] **0.6** Landing page với 5 nút intent (tự bật theo seed data)
- [x] **0.7** Wizard `/di-dau`: 3 câu (đi với ai + ngân sách + khu vực) — dùng chung cho cả 5 intent
- [x] **0.8** Spin animation → điều hướng sang `/dia-diem/[slug]`
- [x] **0.9** Result card + deep link Google Maps + Web Share
- [x] **0.10** `generateMetadata` + OG image sinh lúc build (PNG tĩnh)
- [x] **0.11** Analytics event trên toàn funnel

### Phase 1 — Mở rộng

- [x] **1.1** 4 intent còn lại qua `intents/registry`
- [x] **1.2** Seed lên 114 địa điểm (đủ cả 5 intent; tiếp tục bổ sung dần)
- [x] **1.3** Trang SEO theo quận `/quan/[district]` + sitemap.xml + robots.txt
- [x] **1.4** "Chọn lại" + loại trừ kết quả gần nhất
- [x] **1.5** Lọc theo giờ mở cửa (open now)
- [x] **1.6** Mini-itinerary cho hẹn hò (`/lich-trinh`)
- [x] **1.7** Trang "gợi ý địa điểm" + trang giới thiệu

### Phase 2 — Chỉ làm nếu viral loop được chứng minh

- [ ] **2.1** Geolocation tùy chọn → khoảng cách thật
- [ ] **2.2** Sponsored slots (có trần, có công bố)
- [ ] **2.3** Affiliate links
- [ ] **2.4** .NET 10 + PostgreSQL API sau `PlaceRepository`
- [ ] **2.5** Thành phố thứ hai

---

## 8. Câu hỏi đang chờ quyết định

- [ ] **Intent cho Phase 0** — mặc định là **"Đi đâu"** theo brief; nhưng **"Ăn gì"** có sức kéo
  hằng ngày cao hơn và dễ seed hơn. Chọn cái nào?
- [ ] **Result card không ảnh ở Phase 0** — cần xác nhận, vì nó định hình toàn bộ ngôn ngữ thị giác.
