import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';
import { getPlaceRepository } from '@/lib/places/static-repository';
import { DEFAULT_CITY_ID, SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Về tụi mình',
  description: `${SITE_NAME} là gì, làm cho ai, và dữ liệu đến từ đâu.`,
  alternates: { canonical: '/ve-chung-toi/' },
};

export default async function AboutPage() {
  const repo = getPlaceRepository();
  const [places, city] = await Promise.all([
    repo.listPlaces({ cityId: DEFAULT_CITY_ID }),
    repo.getCity(DEFAULT_CITY_ID),
  ]);

  const districts = new Set(places.map((place) => place.location.districtId));

  return (
    <PageShell>
      <main className="flex flex-1 flex-col gap-8 py-4">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-ink-faint underline-offset-4 hover:text-ink hover:underline"
          >
            ← {SITE_NAME}
          </Link>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-balance">Về tụi mình</h1>
          <p className="mt-3 text-lg text-ink-soft">{SITE_TAGLINE}</p>
        </div>

        <Section title="Tụi mình giải quyết chuyện gì">
          <p>
            Không phải chuyện “chỗ nào ngon nhất Sài Gòn”. Chuyện tụi mình giải quyết nhỏ hơn
            nhiều: <strong>sáu giờ chiều, đói, và không ai nghĩ ra chỗ nào</strong>.
          </p>
          <p>
            Bạn không cần đọc năm trăm bài đánh giá. Bạn cần <em>một</em> lựa chọn đủ tốt, ngay
            bây giờ, để còn ra khỏi nhà.
          </p>
        </Section>

        <Section title="Chọn kiểu gì">
          <p>
            Tụi mình chấm điểm từng địa điểm theo những gì bạn trả lời — đi với ai, bao nhiêu tiền,
            ở khu nào — rồi <strong>bốc ngẫu nhiên trong nhóm điểm cao nhất</strong>.
          </p>
          <p>
            Phần ngẫu nhiên là cố ý. Nếu luôn trả về chỗ điểm cao nhất thì ai cũng nhận cùng một
            kết quả, và bạn sẽ không bao giờ biết tới chỗ thứ bảy trong danh sách — vốn thường là
            chỗ thú vị hơn.
          </p>
        </Section>

        <Section title="Dữ liệu đến từ đâu">
          <p>
            {places.length} địa điểm ở {districts.size} khu vực của {city?.name ?? 'TP.HCM'}, tuyển
            chọn thủ công. Tụi mình <strong>không scrape Google Maps hay Foody</strong> — làm vậy
            là vi phạm điều khoản của họ.
          </p>
          <p>
            Đổi lại, dữ liệu lớn chậm hơn và có thể sai sót. Thấy chỗ nào sai giá, sai giờ, hoặc đã
            đóng cửa thì{' '}
            <Link href="/dong-gop" className="underline underline-offset-4 hover:text-brand">
              báo cho tụi mình
            </Link>
            .
          </p>
        </Section>

        <Section title="Chỗ được tài trợ">
          <p>
            Hiện tại <strong>chưa có chỗ nào trả tiền</strong> để xuất hiện ở đây.
          </p>
          <p>
            Sau này nếu có, nó sẽ luôn gắn nhãn “Được tài trợ”, và điểm cộng bị giới hạn ở mức
            không bao giờ đủ để đẩy một chỗ không liên quan lên trước một chỗ hợp với bạn. Cái đó
            không phải chính sách — nó nằm trong công thức tính điểm.
          </p>
        </Section>

        <Section title="Tụi mình có theo dõi bạn không">
          <p>
            Không có tài khoản, không đăng nhập, không cookie theo dõi. Tụi mình chỉ đếm số lượt ở
            mức ẩn danh để biết người ta bỏ cuộc ở bước nào.
          </p>
        </Section>

        <p className="text-sm text-ink-faint">
          Một dự án nhỏ làm cho người Sài Gòn. Góp ý thì gửi qua{' '}
          <Link href="/dong-gop" className="underline underline-offset-4">
            trang đóng góp
          </Link>
          .
        </p>
      </main>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 flex flex-col gap-2.5 leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}
