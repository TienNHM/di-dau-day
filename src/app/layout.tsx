import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import './globals.css';

const beVietnam = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-be-vietnam',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'đi đâu',
    'ăn gì',
    'cafe',
    'hẹn hò',
    'chơi gì',
    'TP.HCM',
    'Sài Gòn',
    'Hà Nội',
    'Đà Nẵng',
    'Đà Lạt',
    'gợi ý địa điểm',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'vi_VN',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: absoluteUrl('/og/home.jpg'), width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl('/og/home.jpg')],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#fff8f0',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Analytics is opt-in through env vars and absent entirely when unset.
 *
 * Umami is cookie-less and collects no personal data, which is why there is no
 * consent banner — there is nothing to consent to. Swapping in Plausible or GA
 * means changing these two lines and the branch in lib/analytics/track.ts.
 */
const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC;
const umamiId = process.env.NEXT_PUBLIC_UMAMI_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <head>
        {umamiSrc && umamiId ? <script defer src={umamiSrc} data-website-id={umamiId} /> : null}
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
