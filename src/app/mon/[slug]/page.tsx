import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { DishPlaces } from '@/components/dishes/DishPlaces';
import { DISHES, getDish } from '@/lib/dishes/catalogue';
import { dishPhoto } from '@/lib/dishes/photos';
import { absoluteUrl, SITE_NAME } from '@/lib/site';

/**
 * One static page per dish — around thirty of them, so they are cheap to prerender
 * and each one is a real landing page for "ăn phở ở đâu".
 *
 * The dish itself is build-time content; the places that serve it are not, because
 * they depend on the visitor's city. That split is what lets a static host answer a
 * question whose answer differs per reader.
 */

export function generateStaticParams() {
  return DISHES.map((dish) => ({ slug: dish.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dish = getDish(slug);
  if (!dish) return {};

  const title = dish.kind === 'mon-an' ? `Ăn ${dish.name} ở đâu?` : `Uống ${dish.name} ở đâu?`;
  const description = `${dish.note} Tụi mình gợi ý những chỗ có ${dish.name.toLowerCase()} gần bạn.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/mon/${dish.id}/`) },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      images: [{ url: absoluteUrl('/og/home.jpg'), width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function DishDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dish = getDish(slug);
  if (!dish) notFound();

  const photo = dishPhoto(dish.id);
  const backPath = dish.kind === 'mon-an' ? '/mon-an' : '/do-uong';
  const backLabel = dish.kind === 'mon-an' ? 'Chọn món khác' : 'Chọn đồ uống khác';

  return (
    <PageShell>
      <main className="flex flex-1 flex-col gap-6 py-4">
        <Link
          href="/"
          className="self-start text-sm font-medium text-ink-faint underline-offset-4 hover:text-ink hover:underline"
        >
          ← {SITE_NAME}
        </Link>

        <article
          className="relative overflow-hidden rounded-card px-6 py-9 text-center text-white"
          style={{
            backgroundImage:
              dish.kind === 'mon-an'
                ? 'linear-gradient(160deg, #ef4d23, #f5a524)'
                : 'linear-gradient(160deg, #8b5a2b, #c78a3e)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.55), transparent 60%)',
            }}
          />
          {/* A photograph when there is one, behind the gradient rather than instead
              of it — the type has to stay readable and the card has to stay
              recognisably the same object with or without an image. */}
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element --
               next/image needs a loader and an optimiser; this is a static export
               with no server, and the file is already cut to exactly the size it is
               displayed at. */
            <img
              src={photo.src}
              alt={dish.name}
              width={720}
              height={480}
              className="pointer-events-none absolute inset-0 size-full object-cover opacity-45 mix-blend-overlay"
            />
          ) : null}

          <div className="relative">
            <p className="text-xs font-semibold tracking-[0.22em] uppercase opacity-80">
              {dish.kind === 'mon-an' ? 'Tụi mình chọn món' : 'Tụi mình chọn đồ uống'}
            </p>
            <p className="mt-4 text-6xl" aria-hidden>
              {dish.emoji}
            </p>
            <h1 className="mt-3 text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl">
              {dish.name}
            </h1>
            <p className="mx-auto mt-4 max-w-sm leading-relaxed text-balance opacity-90">
              {dish.note}
            </p>
          </div>
        </article>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Ăn ở đâu?</h2>
          {/* The list reads the city from the browser, so it cannot render on the
              server — and `useSearchParams` inside needs a boundary either way. */}
          <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-cream-deep" />}>
            <DishPlaces dishId={dish.id} />
          </Suspense>
          <p className="text-xs leading-relaxed text-ink-faint">
            Danh sách dựa trên phân loại của Overture Maps và tên quán, nên có thể chưa đầy đủ.
            Biết chỗ ngon hơn?{' '}
            <Link href="/dong-gop" className="underline underline-offset-4">
              Gợi ý cho tụi mình
            </Link>
            .
          </p>
        </section>

        <Link
          href={backPath as Route}
          className="rounded-2xl bg-ink px-5 py-4 text-center text-lg font-bold text-cream transition active:scale-[0.98]"
        >
          🎲 {backLabel}
        </Link>
      </main>

      {photo ? (
        <p className="text-center text-xs text-ink-faint">
          Ảnh minh hoạ:{' '}
          <a
            href={photo.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            {photo.author}
          </a>{' '}
          trên Pexels — không phải ảnh chụp tại quán.
        </p>
      ) : null}

      <SiteFooter />
    </PageShell>
  );
}
