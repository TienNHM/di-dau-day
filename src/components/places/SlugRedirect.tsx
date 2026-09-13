'use client';

import { useEffect, useState } from 'react';
import { BASE_PATH } from '@/lib/site';

/**
 * Follows a renamed place to wherever it lives now.
 *
 * Slugs are a pure function of the place today, but the catalogue was rebuilt once
 * before that was true and every link shared until then points at a name that no
 * longer exists. The import records each rename, and this resolves them — so an old
 * link lands on the place it always meant rather than on a dead end.
 *
 * Runs only on the 404 page, and the map is fetched rather than bundled: 276 KB in
 * the JavaScript of every page, to be read by almost none of them, is the wrong
 * trade. A visitor who is not following a stale link pays nothing for this.
 */

const PREFIX = '/dia-diem/';
/** A rename of a rename still resolves, but a cycle must not hang the page. */
const MAX_HOPS = 5;

export function SlugRedirect({ onGaveUp }: { onGaveUp: () => void }) {
  const [status, setStatus] = useState<'checking' | 'redirecting'>('checking');

  useEffect(() => {
    const path = window.location.pathname.replace(BASE_PATH, '');
    if (!path.startsWith(PREFIX)) {
      onGaveUp();
      return;
    }

    const slug = path.slice(PREFIX.length).replace(/\/$/, '');
    if (!slug) {
      onGaveUp();
      return;
    }

    let active = true;

    fetch(`${BASE_PATH}/data/slug-aliases.json`, { cache: 'force-cache' })
      .then((response) => (response.ok ? response.json() : {}))
      .then((aliases: Record<string, string>) => {
        if (!active) return;

        let current = slug;
        for (let hop = 0; hop < MAX_HOPS; hop += 1) {
          const next = aliases[current];
          if (!next || next === current) break;
          current = next;
        }

        if (current === slug) {
          onGaveUp();
          return;
        }

        setStatus('redirecting');
        // Replace, not push: the dead URL should not sit in the back button.
        window.location.replace(`${BASE_PATH}${PREFIX}${current}/${window.location.search}`);
      })
      .catch(() => {
        if (active) onGaveUp();
      });

    return () => {
      active = false;
    };
  }, [onGaveUp]);

  return (
    <p className="text-ink-soft" role="status">
      {status === 'redirecting' ? 'Đang chuyển bạn tới chỗ đúng…' : 'Đang tìm lại chỗ này…'}
    </p>
  );
}
