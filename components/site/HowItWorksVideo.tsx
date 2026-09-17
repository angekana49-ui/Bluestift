"use client";

import { useEffect, useRef } from "react";
import { useTranslate } from "@/components/ui/locale";

/**
 * The "How it works" explainer, played over the page from the hero's secondary
 * button. The video itself is rendered from the site's own product shots (see
 * video/README.md), so what plays is the surfaces the rest of this page shows.
 *
 * A native <dialog> opened with showModal(): Escape, the focus trap and the
 * inert page behind it come from the browser rather than from code here, and
 * focus returns to the button on close.
 *
 * The <video> is only mounted while the dialog is open. Most visitors never
 * press the button, and a `preload` on a ninety-megabyte file would charge
 * every one of them for it — on the phone data plans a lot of this audience is
 * on. Once open, the browser streams it in ranges as it plays, so a visitor who
 * watches twenty seconds pays for twenty seconds. Autoplay with sound is
 * allowed here because opening the dialog is the click.
 *
 * English only for now: one narration, subtitles beside it rather than burnt
 * into the picture (scripts/subtitles.mjs writes them from the film's own
 * clock), and every locale gets the same file until translated renders exist.
 *
 * The names carry a version because the file is served with a year of
 * immutable caching (next.config.ts): a new cut is a new name, never the same
 * URL with new bytes behind it.
 */
export const HOW_IT_WORKS_VIDEO = "/video/how-it-works-en-v2.mp4";
export const HOW_IT_WORKS_POSTER = "/video/how-it-works-poster-v2.jpg";
export const HOW_IT_WORKS_CAPTIONS = "/video/how-it-works-en-v2.vtt";

export default function HowItWorksVideo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useTranslate();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    // showModal() makes the page inert but not still: without this, a wheel over
    // the backdrop scrolls the landing page behind the video.
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={tr("site.hero.ctaSecondary")}
      // Escape closes the dialog natively; this keeps React's state in step.
      onClose={onClose}
      style={{
        padding: 0,
        border: "none",
        background: "transparent",
        width: "100vw",
        height: "100dvh",
        maxWidth: "100vw",
        maxHeight: "100dvh",
        margin: 0,
        overflow: "hidden",
      }}
    >
      {open && (
        <div
          // A click on the dim area around the video closes it; a click on the
          // video (its controls) does not reach here.
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,12,24,0.84)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("site.hero.videoClose")}
            className="pub-press"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.1)",
              color: "#ffffff",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
          <video
            src={HOW_IT_WORKS_VIDEO}
            poster={HOW_IT_WORKS_POSTER}
            controls
            autoPlay
            playsInline
            preload="auto"
            style={{
              width: "min(1200px, 100%)",
              maxHeight: "calc(100dvh - 120px)",
              aspectRatio: "16 / 9",
              borderRadius: 16,
              background: "#000",
              boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            }}
          >
            {/* Not `default`: the film is narrated and plays with sound here.
                The browser turns the track on by itself for anyone whose system
                asks for captions, and the controls offer it to everyone else.
                The label names the language in that language, as players list it. */}
            <track kind="captions" src={HOW_IT_WORKS_CAPTIONS} srcLang="en" label="English" />
          </video>
        </div>
      )}
    </dialog>
  );
}
