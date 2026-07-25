import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOC_BRANDS, parseDoc, splitInline, footerLine, type DocBrand } from "@/lib/doc-format";

export const dynamic = "force-dynamic";
// Link-shared, not for search engines.
export const metadata = { robots: { index: false, follow: false } };

/**
 * Public, read-only view of a shared document (/s/[token]). No auth — the token
 * is the capability. Read with the service role, and only the Markdown body the
 * owner chose to share is rendered. Self-contained, light, branded.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .schema("learning")
    .from("shares")
    .select("title, body, brand, created_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (!data || data.revoked_at) notFound();

  const brand = DOC_BRANDS[(data.brand as DocBrand) in DOC_BRANDS ? (data.brand as DocBrand) : "raya"];
  const blocks = parseDoc(data.body ?? "");
  const inline = (text: string) =>
    splitInline(text).map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>));

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#eef4fb",
        padding: "40px 16px 64px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <article
        style={{
          width: "100%",
          maxWidth: 720,
          background: "#ffffff",
          border: "1px solid rgba(15,23,42,0.10)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px", borderBottom: "1px solid rgba(15,23,42,0.08)", background: "#f6f9fd" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo} alt="" style={{ height: 24, width: "auto" }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: brand.accent }}>{brand.name}</span>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#8a97a8" }}>Shared · read-only</span>
        </header>

        <div style={{ padding: "20px 24px 4px" }}>
          {data.title && <h1 style={{ fontSize: 25, fontWeight: 800, color: "#0b1220", margin: 0, lineHeight: 1.25 }}>{data.title}</h1>}
          <div style={{ width: 40, height: 3, borderRadius: 2, background: brand.accent, margin: "12px 0 4px" }} />
        </div>

        <div style={{ padding: "6px 24px 8px", color: "#0b1220" }}>
          {blocks.map((b, i) => {
            if (b.type === "h1") return <h2 key={i} style={{ fontSize: 21, fontWeight: 800, margin: "18px 0 8px" }}>{inline(b.text)}</h2>;
            if (b.type === "h2") return <h3 key={i} style={{ fontSize: 17, fontWeight: 700, color: brand.accent, margin: "16px 0 6px" }}>{inline(b.text)}</h3>;
            if (b.type === "h3") return <h4 key={i} style={{ fontSize: 16, fontWeight: 700, margin: "12px 0 5px" }}>{inline(b.text)}</h4>;
            if (b.type === "li")
              return (
                <div key={i} style={{ display: "flex", gap: 8, margin: "4px 0", fontSize: 16, lineHeight: 1.6 }}>
                  <span style={{ color: brand.accent, flex: "none" }}>•</span>
                  <span>{inline(b.text)}</span>
                </div>
              );
            return <p key={i} style={{ fontSize: 16, lineHeight: 1.65, margin: "8px 0" }}>{inline(b.text)}</p>;
          })}
        </div>

        <footer style={{ padding: "14px 24px 18px", marginTop: 8, borderTop: "1px solid rgba(15,23,42,0.08)", fontSize: 13, color: "#8a97a8", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span>{footerLine((data.brand as DocBrand) in DOC_BRANDS ? (data.brand as DocBrand) : "raya")} ·</span>
          <a href={`https://${brand.url}`} style={{ color: brand.accent, textDecoration: "none" }}>{brand.url}</a>
        </footer>
      </article>
    </main>
  );
}
