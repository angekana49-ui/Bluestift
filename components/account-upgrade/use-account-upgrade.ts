"use client";

import { useCallback, useState } from "react";
import { netFetch } from "@/lib/net/client-fetch";
import { passwordProblem } from "@/lib/password";
import { useTranslate } from "@/components/ui/locale";
import {
  isPlausibleEmail,
  normalizeEmail,
  type UpgradeRequestError,
} from "@/lib/account-upgrade-shared";
import type { MessageKey } from "@/lib/i18n";

/** A refusal, and the field it is about when there is one. */
export type UpgradeNotice = { text: string; hint?: string; field?: "email" | "password" };

/**
 * The browser half of anonymous → verified (lib/account-upgrade.ts), shared by
 * the two places that offer it: onboarding's last screen and Settings. Each
 * draws its own fields; this owns the rules, the request and the waiting.
 */
export function useAccountUpgrade() {
  const tr = useTranslate();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<UpgradeNotice | null>(null);
  /** The address the link went to; null until a request succeeds. */
  const [sentTo, setSentTo] = useState<string | null>(null);

  const noticeFor = useCallback(
    (code: UpgradeRequestError | undefined, problem?: MessageKey): UpgradeNotice => {
      switch (code) {
        case "email_invalid":
          return { text: tr("upgrade.err.emailInvalid"), field: "email" };
        case "email_taken":
          return { text: tr("upgrade.err.emailTaken"), hint: tr("upgrade.err.emailTakenHint"), field: "email" };
        case "password":
          return { text: tr(problem ?? "pw.err.mix"), field: "password" };
        case "already_verified":
          return { text: tr("upgrade.err.alreadyVerified") };
        case "rate_limited":
          return { text: tr("upgrade.err.rateLimited") };
        case "email_failed":
          return { text: tr("upgrade.err.emailFailed") };
        default:
          return { text: tr("upgrade.err.unavailable") };
      }
    },
    [tr],
  );

  /** Resolves to the address the link went to, or null when it did not go. */
  async function submit(rawEmail: string, password: string): Promise<string | null> {
    if (busy) return null;
    const email = normalizeEmail(rawEmail);
    // The server checks both again; asking here spends no request and no email.
    if (!isPlausibleEmail(email)) {
      setNotice(noticeFor("email_invalid"));
      return null;
    }
    const problem = passwordProblem(password, email);
    if (problem) {
      setNotice(noticeFor("password", problem));
      return null;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await netFetch(
        "/api/account/upgrade",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
        { timeoutMs: 20_000 },
      );
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; email?: string; code?: UpgradeRequestError; problem?: MessageKey }
        | null;
      if (!res.ok || !data?.ok) {
        setNotice(noticeFor(data?.code, data?.problem));
        return null;
      }
      const sent = data.email ?? email;
      setSentTo(sent);
      return sent;
    } catch {
      setNotice({ text: tr("upgrade.err.network") });
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** For LinkSentDialog: has the address reached the account, from any device? */
  const checkConfirmed = useCallback(async (): Promise<boolean> => {
    const res = await netFetch("/api/account/upgrade", { cache: "no-store" }, { timeoutMs: 8_000 });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { verified?: boolean } | null;
    return data?.verified === true;
  }, []);

  return {
    busy,
    notice,
    sentTo,
    submit,
    checkConfirmed,
    clearNotice: () => setNotice(null),
    /** "Wrong address?" — back to the form, to send a new link. */
    reset: () => {
      setSentTo(null);
      setNotice(null);
    },
  };
}
