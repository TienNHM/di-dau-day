import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { DishSpinner } from '@/components/dishes/DishSpinner';
import { absoluteUrl, SITE_NAME } from '@/lib/site';

const TITLE = 'Hôm nay ăn món gì?';
const DESCRIPTION =
  'Không nghĩ ra món nào? Bấm một cái, tụi mình chọn giùm bạn một món — rồi chỉ luôn những chỗ có bán món đó.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl('/mon-an/') },
  openGraph: {
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
    images: [{ url: absoluteUrl('/og/home.jpg'), width: 1200, height: 630, alt: TITLE }],
  },
};

export default function DishPage() {
  return (
    <PageShell>
      <DishSpinner
        kind="mon-an"
        title={TITLE}
        subtitle="Chọn món trước, chọn quán sau. Khỏi phải nghĩ."
        accent={{ from: '#ef4d23', to: '#f5a524', on: '#ffffff' }}
      />
    </PageShell>
  );
}
