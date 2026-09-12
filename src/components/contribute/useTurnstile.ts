'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/contribute';

/**
 * Turnstile, rendered explicitly rather than by the script's auto-scan.
 *
 * Two problems auto-rendering leaves unsolved, both of which end as a confusing
 * "Không xác minh được" after the user has already typed everything:
 *
 * 1. **Tokens expire after about five minutes.** Someone writing a thoughtful
 *    description will blow through that, and the submit would then fail. The
 *    expiry callback clears the token and asks for a fresh one.
 * 2. **Verification is not instant.** Submitting before it finishes sends an empty
 *    token, so the form needs to know whether one exists yet.
 *
 * Neither callback is reachable through the auto-render path without registering
 * global functions, so the widget is rendered by hand.
 */

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
      size?: string;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

export type TurnstileState = {
  /** Null until the visitor has been verified, or after the token expires. */
  token: string | null;
  /** False when Turnstile is not configured at all — then nothing gates the form. */
  required: boolean;
  failed: boolean;
  onScriptLoad: () => void;
};

/**
 * The container ref is owned by the caller rather than returned from here, so it
 * reaches `ref=` straight from a `useRef` — the shape React's lint rules recognise.
 */
export function useTurnstile(
  containerRef: React.RefObject<HTMLDivElement | null>,
): TurnstileState {
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  const onScriptLoad = useCallback(() => setScriptReady(true), []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !scriptReady) return;

    const api = (window as TurnstileWindow).turnstile;
    const container = containerRef.current;
    if (!api || !container || widgetIdRef.current !== null) return;

    widgetIdRef.current = api.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      size: 'flexible',
      callback: (value) => {
        setToken(value);
        setFailed(false);
      },
      'expired-callback': () => {
        // The widget re-challenges on its own; clearing the token is what stops a
        // submit going out with a value the server will reject.
        setToken(null);
      },
      'error-callback': () => {
        setToken(null);
        setFailed(true);
      },
    });

    return () => {
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id) api.remove(id);
    };
    // The ref is read inside an effect, never during render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady]);

  return {
    token,
    required: TURNSTILE_SITE_KEY !== null,
    failed,
    onScriptLoad,
  };
}
