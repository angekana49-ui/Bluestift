import Link from "next/link";
import { getPaymentById } from "@/lib/billing/payments-data";
import { getServerTranslate } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";

export const metadata = { title: "BlueStift · Payment" };

/**
 * Landing after the hosted checkout. Reads the payment's real status from our DB
 * (set by the webhook), so it's truthful even if the browser returns before the
 * notification lands ("processing"). Never activates anything itself.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ pid?: string }>;
}) {
  const { pid } = await searchParams;
  const payment = pid ? await getPaymentById(pid) : null;
  const status = payment?.status ?? "unknown";
  const tr = await getServerTranslate();

  const view =
    status === "paid"
      ? { emoji: "✅", title: tr("checkout.return.paid.title"), body: tr("checkout.return.paid.body"), cta: audienceHome(payment?.audience, tr) }
      : status === "pending"
        ? { emoji: "⏳", title: tr("checkout.return.pending.title"), body: tr("checkout.return.pending.body"), cta: { href: "/pricing", label: tr("checkout.return.pending.cta") } }
        : status === "failed" || status === "cancelled" || status === "expired"
          ? { emoji: "⚠️", title: tr("checkout.return.failed.title"), body: tr("checkout.return.failed.body"), cta: { href: "/pricing", label: tr("checkout.return.failed.cta") } }
          : { emoji: "❓", title: tr("checkout.return.notfound.title"), body: tr("checkout.return.notfound.body"), cta: { href: "/contact", label: tr("checkout.return.notfound.cta") } };

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        background: "#f6f8fc",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          border: "1px solid #e6ebf3",
          borderRadius: 22,
          padding: 32,
          textAlign: "center",
          boxShadow: "0 24px 60px rgba(15,23,42,0.10)",
        }}
      >
        <div style={{ fontSize: 49 }}>{view.emoji}</div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0b1220", margin: "12px 0 8px", letterSpacing: "-0.02em" }}>
          {view.title}
        </h1>
        <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.7, margin: "0 0 22px" }}>{view.body}</p>
        <Link
          href={view.cta.href}
          style={{
            display: "inline-block",
            background: "#0b1220",
            color: "#fff",
            borderRadius: 999,
            padding: "11px 28px",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {view.cta.label}
        </Link>
      </div>
    </main>
  );
}

function audienceHome(audience: string | undefined, tr: (key: MessageKey) => string): { href: string; label: string } {
  return audience === "b2b"
    ? { href: "/school", label: tr("checkout.return.paid.ctaSchool") }
    : { href: "/chat", label: tr("checkout.return.paid.ctaRaya") };
}
