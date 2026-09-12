import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { Suspense } from 'react';
import { ContributeScreen } from '@/components/contribute/ContributeScreen';
import { absoluteUrl, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Gợi ý địa điểm',
  description: `Biết một chỗ hay mà ${SITE_NAME} chưa có? Kể tụi mình nghe — không cần tài khoản gì.`,
  alternates: { canonical: absoluteUrl('/dong-gop/') },
};

export default function ContributePage() {
  return (
    <PageShell>
      <main className="flex flex-1 flex-col gap-7 py-4">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-ink-faint underline-offset-4 hover:text-ink hover:underline"
          >
            ← {SITE_NAME}
          </Link>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-balance">
            Biết chỗ nào hay không?
          </h1>
          <p className="mt-3 text-lg text-ink-soft text-balance">
            Sản phẩm này chỉ tốt bằng đúng dữ liệu của nó. Một chỗ bạn thật sự từng đi đáng giá
            hơn mười chỗ chép từ trên mạng.
          </p>
        </div>

        <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-cream-deep" />}>
          <ContributeScreen />
        </Suspense>
      </main>
      <SiteFooter />
    </PageShell>
  );
}
