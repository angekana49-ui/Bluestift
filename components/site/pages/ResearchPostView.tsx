"use client";

import Link from "next/link";
import SitePage from "@/components/site/SitePage";
import { readTime } from "@/components/public/format";
import { GUTTER, MEASURE, PAGE_BOTTOM, PAGE_TOP } from "@/components/site/layout";
import type { PublicMedia, PublicResearchPost } from "@/lib/content";

type PostDetail = PublicResearchPost & { media: PublicMedia[] };

const TYPE_META: Record<string, { label: string; icon: string }> = {
  paper: { label: "Paper", icon: "📄" },
  experiment: { label: "Experiment", icon: "🧪" },
  article: { label: "Article", icon: "✍️" },
  update: { label: "Update", icon: "⚡" },
};

function enMonth(date: string | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(date));
}

export function ResearchPostView({ post, signedIn }: { post: PostDetail; signedIn: boolean }) {
  const type = TYPE_META[post.type ?? "article"] ?? TYPE_META.article;
  const paragraphs = (post.content ?? "").split(/\n{2,}/).filter((p) => p.trim());
  const images = post.media.filter((m) => m.type === "image" && m.url);
  const files = post.media.filter((m) => m.type !== "image" && m.url);

  return (
    <SitePage active="Research" section="Research" signedIn={signedIn}>
      {(t) => (
        <div style={{ position: "relative", zIndex: 1, maxWidth: MEASURE.prose, margin: "0 auto", padding: `${PAGE_TOP}px ${GUTTER}px ${PAGE_BOTTOM}px` }}>
          <Link href="/research" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 24, fontSize: 14, color: t.link, textDecoration: "none" }}>
            ← Back to publications
          </Link>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "20px 0 16px" }}>
            <span style={{ fontSize: 16 }}>{type.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: t.mutedLight }}>{type.label}</span>
            <span style={{ marginLeft: "auto", fontSize: 13, color: t.mutedLight }}>
              {enMonth(post.published_at ?? post.created_at)} · {readTime(post.content)}
            </span>
          </div>

          <h1 style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", fontWeight: 400, fontSize: "clamp(1.6rem,3.4vw,2.2rem)", lineHeight: 1.3, margin: "0 0 20px", color: t.text }}>
            {post.title}
          </h1>

          {post.authors.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, borderBottom: `1px solid ${t.cardBorder}`, paddingBottom: 20, marginBottom: 24 }}>
              {post.authors.map((a) => (
                <div key={a.full_name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {a.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatar_url} alt={a.full_name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.greenSolid, color: "white", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.full_name[0]}</div>
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{a.full_name}</div>
                    {a.institution && <div style={{ fontSize: 13, color: t.mutedLight }}>{a.institution}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {paragraphs.length > 0 && (
            <div style={{ marginBottom: 24, borderRadius: 12, border: `1px solid ${t.greenBorder}`, background: t.greenBg, padding: "16px 18px" }}>
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: t.greenText }}>Summary</div>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: t.greenText, margin: 0 }}>{paragraphs[0]}</p>
            </div>
          )}

          <div style={{ fontSize: 16, lineHeight: 1.9, color: t.text }}>
            {paragraphs.slice(1).map((p, i) => (
              <p key={i} style={{ whiteSpace: "pre-wrap", marginTop: i > 0 ? 16 : 0 }}>{p}</p>
            ))}
          </div>

          {images.length > 0 && (
            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
              {images.map((m) => (
                <figure key={m.id} style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url!} alt={m.title ?? ""} style={{ maxWidth: "100%", borderRadius: 12, border: `1px solid ${t.cardBorder}` }} />
                  {m.title && <figcaption style={{ marginTop: 6, fontSize: 13, color: t.mutedLight }}>{m.title}</figcaption>}
                </figure>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {files.map((m) => (
                <a key={m.id} href={m.url!} target="_blank" rel="noreferrer" style={{ borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.cardBg, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: t.text, textDecoration: "none" }}>
                  {m.type === "pdf" ? "📄" : "🎬"} {m.title ?? m.type}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </SitePage>
  );
}
