"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { Modal } from "@/components/ui/modal";
import { useTranslate } from "@/components/ui/locale";
import type { AppTheme } from "@/components/ui/tokens";
import type { MessageKey } from "@/lib/i18n";

/**
 * "We emailed you a link" — as a dialog, and as a watcher.
 *
 * It used to be a line of grey 15px text under the last button on the form,
 * below the fold on a phone, in the one moment the person has stopped looking
 * at the screen and gone to their mail app. Half the job of this message is to
 * be noticed; a footnote cannot do that.
 *
 * The other half is what happens next, and that is the part with no UI at all:
 * see useIdentityChange below.
 */

type Palette = { card: string; border: string; text: string; muted: string; soft: string };

// Light by default because the two auth surfaces that are NOT inside the app
// shell (/login, onboarding) are light-only by design — see ui/auth-chrome.
// /account passes its resolved theme instead, so the dialog matches the page
// behind it in either place rather than flashing white over a dark shell.
const LIGHT: Palette = {
  card: "#ffffff",
  border: "#e3eaf3",
  text: "#0b1220",
  muted: "#475569",
  soft: "#f4f8fd",
};

const paletteOf = (t?: AppTheme): Palette =>
  t ? { card: t.cardBg, border: t.cardBorder, text: t.text, muted: t.muted, soft: t.cardBg2 } : LIGHT;

/** How often the tab asks whether the link has been opened elsewhere. */
const POLL_MS = 2500;
/** Long enough to read "you're in", short enough not to feel stuck. */
const HANDOVER_MS = 1100;

/**
 * Who is signed in, as one comparable string.
 *
 * Not "is there a session": one of the two callers is ALREADY signed in. An
 * anonymous account linking an email keeps its user id and simply gains an
 * address, so presence tells us nothing there — the identity changing does.
 */
async function identityOf(supabase: SupabaseClient<Database>): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return "";
  return `${user.id}|${user.email ?? ""}|${user.is_anonymous ? "anon" : "full"}`;
}

/**
 * Watches for the sign-in that happens SOMEWHERE ELSE.
 *
 * The link opens wherever the mail client decides — a new tab, another browser,
 * a phone. The tab that asked for it takes no part in that exchange, and until
 * this existed it simply sat there: you came back to a window still saying
 * "check your inbox", already signed in, with no hint that it was stale. The
 * app was open twice, in two different states, and the one you were looking at
 * was the wrong one.
 *
 * It has to be a poll. The session lives in COOKIES (lib/supabase/client.ts),
 * not localStorage, and a cookie changes silently — there is no `storage` event
 * to subscribe to. The read is local (document.cookie, through the client that
 * already exists on the page), so the cost is a string comparison every few
 * seconds and no network at all until something has actually changed.
 *
 * Coming back to the tab is both the likeliest moment for the answer to have
 * changed and the moment a 2.5-second wait is most visible, so focus and
 * visibility skip the queue.
 */
function useIdentityChange(supabase: SupabaseClient<Database>, onChange: () => void) {
  // Both in refs, and for the same reason: NOTHING about this watch may restart
  // it, because restarting re-captures the baseline — and a baseline captured
  // after the session arrives can never differ from it. A poll that resets
  // itself often enough simply stops detecting anything, silently.
  //
  // Both inputs move constantly. The callers pass an inline arrow, and they
  // build their client in the render body (`const supabase = createClient()`),
  // so its identity changes on every render of the page behind this dialog.
  const fire = useRef(onChange);
  fire.current = onChange;
  const client = useRef(supabase);

  useEffect(() => {
    const supa = client.current;
    let done = false;
    let baseline: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const id = await identityOf(supa);
      if (done) return;
      if (baseline === null) baseline = id;
      else if (id !== baseline) {
        done = true;
        fire.current();
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();

    const wake = () => {
      if (done || document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);

    return () => {
      done = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, []);
}

export function LinkSentDialog({
  supabase,
  email,
  theme,
  confirmedKey = "auth.linkSent.confirmed",
  onClose,
  onConfirmed,
}: {
  supabase: SupabaseClient<Database>;
  /** The address the link went to. Absent for the recovery-key flow, which
   *  deliberately doesn't reveal the account's email to whoever typed the key. */
  email?: string;
  /** Omit on the light auth surfaces; pass the resolved theme inside the shell. */
  theme?: AppTheme;
  /** What the confirmed state says. The default promises to move the page,
   *  which is a lie in onboarding — there the link only verifies an address and
   *  the person carries on exactly where they were. */
  confirmedKey?: MessageKey;
  onClose: () => void;
  /** Run once, when this tab notices the link has been opened. */
  onConfirmed: () => void;
}) {
  const tr = useTranslate();
  const p = paletteOf(theme);
  const [confirmed, setConfirmed] = useState(false);
  const handedOver = useRef(false);

  const handOver = useCallback(() => {
    if (handedOver.current) return;
    handedOver.current = true;
    onConfirmed();
  }, [onConfirmed]);

  useIdentityChange(supabase, () => {
    setConfirmed(true);
    setTimeout(handOver, HANDOVER_MS);
  });

  // Once the link is in, this dialog is the last thing standing between the
  // person and the app — so dismissing it means "go", not "stay here signed in
  // on a page that no longer applies".
  const close = () => (confirmed ? handOver() : onClose());

  return (
    <Modal onClose={close} label={tr("auth.linkSent.title")} maxWidth={440} center>
      <div
        style={{
          background: p.card,
          border: `1px solid ${p.border}`,
          borderRadius: 18,
          padding: "30px 28px 24px",
          textAlign: "center",
          boxShadow: "0 24px 60px rgba(4,10,24,0.22)",
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 14 }} aria-hidden>
          {confirmed ? "✅" : "✉️"}
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: p.text }}>
          {tr("auth.linkSent.title")}
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: 16, lineHeight: 1.6, color: p.muted }}>
          {email ? (
            <>
              {tr("auth.msg.linkSent.a")}{" "}
              <strong style={{ color: p.text, wordBreak: "break-all" }}>{email}</strong>.
            </>
          ) : (
            tr("auth.msg.keySent")
          )}
        </p>

        {/* The watcher, made visible. Without this strip the tab would move on
            its own with no prior explanation, which reads as a glitch rather
            than as the feature it is. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textAlign: "left",
            background: p.soft,
            border: `1px solid ${p.border}`,
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              flexShrink: 0,
              background: confirmed ? "#16a34a" : "#2f7fe0",
              animation: confirmed ? undefined : "pulseDot 1.4s ease-in-out infinite",
            }}
            aria-hidden
          />
          <span style={{ fontSize: 15, lineHeight: 1.5, color: p.muted }}>
            {confirmed ? tr(confirmedKey) : tr("auth.linkSent.waiting")}
          </span>
        </div>

        {!confirmed && (
          <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.5, color: p.muted, opacity: 0.85 }}>
            {tr("auth.linkSent.spam")}
          </p>
        )}

        <button
          type="button"
          onClick={close}
          style={{
            background: "none",
            border: `1px solid ${p.border}`,
            borderRadius: 99,
            padding: "10px 22px",
            fontSize: 15,
            fontWeight: 600,
            color: p.text,
            cursor: "pointer",
          }}
        >
          {confirmed ? tr("auth.linkSent.continue") : tr("auth.linkSent.close")}
        </button>
      </div>
    </Modal>
  );
}
