"use client";

import Link from "next/link";
import { useTranslate } from "@/components/ui/locale";
import { heading, primaryBtn, secondaryBtn, sub } from "@/components/ui/auth-chrome";
import { LayerShell } from "./layer-shell";

/**
 * The layer's door for an account with no real email. Onboarding already stops
 * an anonymous account from choosing Schools; this catches everyone who arrives
 * some other way (a bookmark, a shared link, an old /profile?intent=create).
 * The server refuses the same accounts on create, join-team and request-access.
 */
export function EmailRequired() {
  const tr = useTranslate();
  const link = { ...primaryBtn, display: "block", textAlign: "center" as const, textDecoration: "none", boxSizing: "border-box" as const };
  return (
    <LayerShell maxWidth={500}>
      <h1 style={heading}>{tr("layer.email.heading")}</h1>
      <p style={sub}>{tr("layer.email.body")}</p>
      <Link href="/account" style={link}>
        {tr("layer.email.add")}
      </Link>
      <Link
        href="/chat"
        style={{ ...secondaryBtn, display: "block", textAlign: "center", textDecoration: "none", marginTop: 10, boxSizing: "border-box" }}
      >
        {tr("layer.email.raya")}
      </Link>
    </LayerShell>
  );
}
