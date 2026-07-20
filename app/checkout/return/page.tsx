import Link from "next/link";
import { getPaymentById } from "@/lib/billing/payments-data";

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

  const view =
    status === "paid"
      ? { emoji: "✅", title: "You're all set", body: "Your payment went through and your plan is now active.", cta: audienceHome(payment?.audience) }
      : status === "pending"
        ? { emoji: "⏳", title: "Payment processing", body: "We're confirming your payment. This page will reflect the final status shortly — you can safely refresh.", cta: { href: "/pricing", label: "Back to plans" } }
        : status === "failed" || status === "cancelled" || status === "expired"
          ? { emoji: "⚠️", title: "Payment didn't complete", body: "No charge was made. You can try again with another method.", cta: { href: "/pricing", label: "Try again" } }
          : { emoji: "❓", title: "Payment not found", body: "We couldn't find this checkout. If you were charged, contact support.", cta: { href: "/contact", label: "Contact us" } };

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
        <div style={{ fontSize: 44 }}>{view.emoji}</div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0b1220", margin: "12px 0 8px", letterSpacing: "-0.02em" }}>
          {view.title}
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: "0 0 22px" }}>{view.body}</p>
        <Link
          href={view.cta.href}
          style={{
            display: "inline-block",
            background: "#0b1220",
            color: "#fff",
            borderRadius: 999,
            padding: "11px 28px",
            fontSize: 13,
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

function audienceHome(audience?: string): { href: string; label: string } {
  return audience === "b2b" ? { href: "/school", label: "Go to your school" } : { href: "/chat", label: "Open RAYA" };
}
