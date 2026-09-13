import type { Metadata } from "next";
import { peekAccountUpgrade } from "@/lib/account-upgrade";
import { UpgradeConfirm } from "@/components/account-upgrade/upgrade-confirm";
import { getServerTranslate } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getServerTranslate();
  return {
    title: { absolute: `${tr("upgrade.confirm.heading")} · Bluestift` },
    robots: { index: false, follow: false },
  };
}

/**
 * Where the upgrade email's link lands.
 *
 * This render changes nothing: it only reads whether the link is still good,
 * so the person sees the address before confirming, or why it cannot be used.
 * The swap is the button's POST (/api/account/upgrade/confirm). Mail scanners
 * open links to inspect them; a page that acted on the GET would be used up by
 * one before its owner ever tapped it.
 *
 * No session required — the link is the proof, and it is often opened on a
 * phone while the account lives on a school computer.
 */
export default async function UpgradeConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw : "";
  const peek = await peekAccountUpgrade(token);

  return (
    <main style={{ minHeight: "100vh", width: "100%" }}>
      <UpgradeConfirm
        token={token}
        email={peek.ok ? peek.email : null}
        initialError={peek.ok ? null : peek.code}
      />
    </main>
  );
}
