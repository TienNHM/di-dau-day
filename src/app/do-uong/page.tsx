import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { DishSpinner } from '@/components/dishes/DishSpinner';
import { absoluteUrl, SITE_NAME } from '@/lib/site';

const TITLE = 'Uống gì bây giờ?';
const DESCRIPTION =
  'Cà phê, trà sữa, sinh tố hay bia? Bấm một cái, tụi mình chọn giùm — rồi chỉ luôn chỗ uống.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl('/do-uong/') },
  openGraph: {
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
    images: [{ url: absoluteUrl('/og/home.jpg'), width: 1200, height: 630, alt: TITLE }],
  },
};

export default function DrinkPage() {
  return (
    <PageShell>
      <DishSpinner
        kind="do-uong"
        title={TITLE}
        subtitle="Từ cà phê vỉa hè tới cocktail. Để tụi mình quyết."
        accent={{ from: '#8b5a2b', to: '#c78a3e', on: '#ffffff' }}
      />
    </PageShell>
  );
}
