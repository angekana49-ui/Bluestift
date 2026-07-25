"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A true viewport overlay: renders through a portal to <body>, so it escapes any
 * ancestor transform/overflow in the app shell (a `position: fixed` element is
 * trapped by a transformed ancestor — which is why an in-tree modal can render
 * "inline" instead of centred). Dimmed backdrop, scrollable, centred column.
 * Closes on backdrop click or Escape; locks body scroll while open.
 */
export function Modal({
  onClose,
  label,
  maxWidth = 900,
  children,
}: {
  onClose: () => void;
  label?: string;
  maxWidth?: number;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        background: "rgba(4,10,24,0.5)",
        overflowY: "auto",
        padding: "40px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
