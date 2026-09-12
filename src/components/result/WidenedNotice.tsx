'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Tells the user their district could not answer.
 *
 * Without this the engine's widening is invisible: someone who picked Thủ Đức and
 * landed in Quận 1 has no way to tell whether the app ignored them or genuinely had
 * nothing nearby. Saying it out loud turns a bug-looking result into an explanation.
 *
 * Read from the URL rather than passed as a prop because the page is static — the
 * wizard sets `rong=1` on the result link when it widened.
 */
export function WidenedNotice({ districtName }: { districtName: string | null }) {
  const searchParams = useSearchParams();
  if (searchParams.get('rong') !== '1') return null;

  return (
    <p className="rounded-2xl bg-sun/12 px-4 py-3 text-sm font-medium text-ink-soft ring-1 ring-sun/30">
      ℹ️ Tụi mình chưa có đủ chỗ hợp ở {districtName ?? 'khu bạn chọn'}, nên đã tìm rộng ra xung
      quanh.
    </p>
  );
}
