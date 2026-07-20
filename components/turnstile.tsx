"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

/**
 * Lightweight Cloudflare Turnstile widget (explicit render, no extra deps).
 * Emits a token via `onVerify`; expose `reset()` so the parent can request a
 * fresh token after each auth call (tokens are single-use).
 */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export type TurnstileHandle = { reset: () => void };

type Props = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
};

export const Turnstile = forwardRef<TurnstileHandle, Props>(function Turnstile(
  { onVerify, onExpire },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Keep the latest callbacks in refs so the render effect depends only on the
  // site key (avoids re-initialising the widget on every parent render).
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
      }
    },
  }));

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    function renderWidget() {
      if (cancelled || widgetId.current || !containerRef.current) return;
      if (!window.turnstile) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onVerifyRef.current(token),
        "expired-callback": () => onExpireRef.current?.(),
        "error-callback": () => onExpireRef.current?.(),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      poll = setInterval(() => {
        if (window.turnstile) {
          if (poll) clearInterval(poll);
          renderWidget();
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      // Tell Cloudflare to drop the widget from its registry — otherwise it logs
      // "Cannot find Widget …" after the DOM node unmounts (page navigation).
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // widget already gone
        }
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  if (!siteKey) {
    return (
      <p style={{ color: "#f87171" }}>
        Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY.
      </p>
    );
  }

  return <div ref={containerRef} />;
});
