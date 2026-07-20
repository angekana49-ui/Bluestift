"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PublicNav } from "@/components/public/nav";
import { PublicFooter } from "@/components/public/footer";
import { research as T, serif, sans } from "@/components/public/theme";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { formatMonth, readTime } from "@/components/public/format";
import type { PublicNewsletterIssue, PublicResearchPost } from "@/lib/content";

const TYPE_META: Record<string, { label: string; icon: string; bg: string; c: string }> = {
  paper: { label: "Paper", icon: "📄", bg: T.violetBg, c: T.violet },
  experiment: { label: "Expérience", icon: "🧪", bg: T.greenBg, c: T.green },
  article: { label: "Article", icon: "✍️", bg: "#fef3c7", c: "#92400e" },
  update: { label: "Update", icon: "⚡", bg: "#f0f9ff", c: "#0369a1" },
};

function excerpt(content: string | null): string {
  if (!content) return "";
  const text = content.replace(/[#*_>`]/g, "").trim();
  return text.length > 260 ? text.slice(0, 260) + "…" : text;
}

// ─── Article card ────────────────────────────────────────────
function ArticleCard({ post, large }: { post: PublicResearchPost; large?: boolean }) {
  const type = TYPE_META[post.type ?? "article"] ?? TYPE_META.article;
  return (
    <Link
      href={`/research/${post.slug ?? post.id}`}
      style={{
        display: "block",
        background: T.white,
        border: `1px solid ${T.border}`,
        borderLeft: large ? `3px solid ${T.green}` : `1px solid ${T.border}`,
        borderRadius: 14,
        padding: large ? "24px 28px" : "18px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14 }}>{type.icon}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: T.inkMuted,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {type.label}
        </span>
        <span style={{ fontSize: 10, color: T.inkMuted }}>·</span>
        <span style={{ fontSize: 10, color: T.inkMuted }}>{formatMonth(post.published_at ?? post.created_at)}</span>
        <span style={{ fontSize: 10, color: T.inkMuted }}>·</span>
        <span style={{ fontSize: 10, color: T.inkMuted }}>{readTime(post.content)}</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 99,
            background: type.bg,
            color: type.c,
          }}
        >
          {type.label}
        </span>
      </div>

      <h3
        style={{
          fontSize: large ? 18 : 14,
          fontWeight: 700,
          fontFamily: serif,
          color: T.ink,
          lineHeight: 1.35,
          margin: "0 0 10px",
          letterSpacing: "-0.01em",
        }}
      >
        {post.title}
      </h3>

      {post.content && (
        <p
          style={{
            fontSize: 12,
            color: T.sub,
            lineHeight: 1.65,
            margin: "0 0 14px",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {excerpt(post.content)}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {post.authors.map((a) => (
            <div key={a.full_name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: T.green,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {a.full_name[0]}
              </div>
              <span style={{ fontSize: 11, color: T.sub }}>{a.full_name}</span>
              {a.institution && <span style={{ fontSize: 10, color: T.inkMuted }}>· {a.institution}</span>}
            </div>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.green, fontWeight: 600 }}>Lire →</span>
      </div>
    </Link>
  );
}

// ─── Newsletter subscribe box ────────────────────────────────
function NewsletterBox() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  async function subscribe() {
    if (!email.includes("@") || state === "busy") return;
    setState("busy");
    const res = await fetch("/api/content/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token: captchaToken }),
    });
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    setState(res.ok ? "done" : "error");
  }

  return (
    <div
      style={{
        background: T.greenBg,
        border: `1px solid ${T.greenBd}`,
        borderRadius: 16,
        padding: "28px 32px",
        margin: "0 0 24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: T.green,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Newsletter · Mensuel
          </div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 800,
              fontFamily: serif,
              color: T.greenDk,
              margin: "0 0 8px",
              letterSpacing: "-0.01em",
            }}
          >
            Bluestift Research Digest
          </h3>
          <p style={{ fontSize: 12, color: T.green, lineHeight: 1.6, margin: 0 }}>
            Avancées du Kernel, résultats terrain, lectures recommandées. Une fois par mois, pas de spam.
          </p>
        </div>
        {state !== "done" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                type="email"
                style={{
                  background: "white",
                  border: `1px solid ${T.greenBd}`,
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 12,
                  color: T.ink,
                  outline: "none",
                  width: 200,
                }}
              />
              <button
                onClick={subscribe}
                disabled={state === "busy"}
                style={{
                  background: T.green,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {state === "busy" ? "…" : "S'abonner"}
              </button>
            </div>
            <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
            {state === "error" && (
              <span style={{ fontSize: 11, color: "#dc2626" }}>Échec de l&apos;inscription — réessaie.</span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.green }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Inscrit ! Vérifie ta boîte mail.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Propose (contribution) form ─────────────────────────────
function ProposeForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", category: "article", title: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "white",
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    color: T.ink,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  async function submit() {
    if (!form.title.trim() || state === "busy") return;
    if (file && file.size > 15 * 1024 * 1024) {
      setState("error");
      return;
    }
    setState("busy");
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("token", captchaToken ?? "");
    if (file) fd.append("file", file);
    const res = await fetch("/api/content/contribute", { method: "POST", body: fd });
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    setState(res.ok ? "done" : "error");
  }

  if (state === "done") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 16 }}>🙏</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "0 0 10px" }}>Proposition reçue.</h2>
        <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.6, marginBottom: 24 }}>
          On la relit et on te répond par email. Merci de contribuer à la recherche Bluestift.
        </p>
        <button
          onClick={onClose}
          style={{
            background: T.green,
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "10px 24px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Retour aux articles
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 24px" }}>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, fontSize: 12, marginBottom: 20, padding: 0 }}
      >
        ← Retour
      </button>
      <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: serif, color: T.ink, margin: "0 0 8px" }}>
        Proposer une contribution
      </h2>
      <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.6, marginBottom: 20 }}>
        Paper, expérience terrain, article ou jeu de données — décris ta proposition, l&apos;équipe research te
        recontacte.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="pub-grid-2" style={{ gap: 10 }}>
          <input
            placeholder="Ton nom"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="ton@email.com"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={inputStyle}
          />
        </div>
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          style={inputStyle}
        >
          <option value="paper">Paper académique</option>
          <option value="experiment">Expérience terrain</option>
          <option value="article">Article</option>
          <option value="dataset">Jeu de données</option>
          <option value="other">Autre</option>
        </select>
        <input
          placeholder="Titre de la proposition"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          style={inputStyle}
        />
        <textarea
          placeholder="Décris ta contribution : sujet, méthode, données disponibles…"
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
        />
        <label style={{ fontSize: 12, color: T.sub }}>
          Document (optionnel) — paper, dataset, slides… (PDF, Word, Excel, images ; 15 Mo max)
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ display: "block", marginTop: 6, fontSize: 12, color: T.ink }}
          />
          {file && (
            <span style={{ fontSize: 11, color: T.inkMuted }}>
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} Mo
            </span>
          )}
        </label>
        <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        {state === "error" && (
          <span style={{ fontSize: 11, color: "#dc2626" }}>Échec de l&apos;envoi — réessaie.</span>
        )}
        <button
          onClick={submit}
          disabled={state === "busy" || !form.title.trim()}
          style={{
            alignSelf: "flex-start",
            background: form.title.trim() ? T.green : T.card,
            color: form.title.trim() ? "white" : T.inkMuted,
            border: "none",
            borderRadius: 10,
            padding: "11px 24px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {state === "busy" ? "Envoi…" : "Envoyer la proposition"}
        </button>
      </div>
    </div>
  );
}

// ─── Collaborations tab ──────────────────────────────────────
function Collaborations() {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: serif, color: T.ink, margin: "0 0 8px" }}>
          Collaborations académiques
        </h2>
        <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
          Bluestift souhaite collaborer avec des chercheurs en éducation pour valider le Cognitive Kernel.
          Ce chantier s&apos;ouvre : si le sujet vous intéresse, écrivez-nous.
        </p>
      </div>

      <div
        style={{
          background: T.violetBg,
          border: `1px solid ${T.violet}33`,
          borderRadius: 12,
          padding: "16px 18px",
          marginTop: 16,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>🤝</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.violet, marginBottom: 4 }}>
            Tu es chercheur en éducation ?
          </div>
          <p style={{ fontSize: 11, color: "#4a3d8f", lineHeight: 1.6, margin: "0 0 10px" }}>
            Nous partageons nos données anonymisées et notre code source avec les chercheurs intéressés par le
            Cognitive Kernel.
          </p>
          <Link
            href="/contact"
            style={{
              display: "inline-block",
              background: T.violet,
              color: "white",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Nous contacter
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────
type Props = {
  posts: PublicResearchPost[];
  issues: PublicNewsletterIssue[];
  signedIn: boolean;
  initialTab?: string;
};

export function ResearchView({ posts, issues, signedIn, initialTab }: Props) {
  const validTabs = ["articles", "newsletter", "collaborations"];
  const [tab, setTab] = useState(validTabs.includes(initialTab ?? "") ? (initialTab as string) : "articles");
  const [proposing, setProposing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const typesPresent = [...new Set(posts.map((p) => p.type).filter((t): t is string => !!t))];
  const filtered = filter === "all" ? posts : posts.filter((p) => p.type === filter);
  const [featured, ...rest] = filtered;

  const oldest = posts[posts.length - 1];
  const range =
    posts.length > 0
      ? `${formatMonth(oldest?.published_at ?? oldest?.created_at)} – ${formatMonth(posts[0].published_at ?? posts[0].created_at)}`
      : null;

  const tabs = (
    <div
      style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.05)", borderRadius: 99, padding: "3px 4px" }}
    >
      {[
        ["articles", "Articles"],
        ["newsletter", "Newsletter"],
        ["collaborations", "Collaborations"],
      ].map(([k, l]) => (
        <button
          key={k}
          onClick={() => {
            setTab(k);
            setProposing(false);
          }}
          style={{
            padding: "5px 14px",
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 500,
            background: tab === k && !proposing ? "white" : "transparent",
            color: tab === k && !proposing ? T.ink : T.sub,
            border: "none",
            cursor: "pointer",
            boxShadow: tab === k && !proposing ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );

  const actions = (
    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
      <button
        onClick={() => setProposing(true)}
        style={{
          fontSize: 11,
          padding: "6px 14px",
          borderRadius: 99,
          background: T.green,
          color: "white",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        + Proposer
      </button>
    </div>
  );

  return (
    <div style={{ fontFamily: sans, background: T.bg, minHeight: "100vh", color: T.ink }}>
      <PublicNav
        signedIn={signedIn}
        section="Research"
        accent={T.green}
        accentDark={T.greenDk}
        center={tabs}
        actions={actions}
      />

      {proposing ? (
        <ProposeForm onClose={() => setProposing(false)} />
      ) : tab === "articles" ? (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px" }}>
          {/* Volume header */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 20,
              paddingBottom: 14,
              borderBottom: `1px solid ${T.border}`,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.green,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Volume 1
            </span>
            {range && (
              <>
                <span style={{ fontSize: 10, color: T.inkMuted }}>·</span>
                <span style={{ fontSize: 10, color: T.inkMuted }}>{range}</span>
              </>
            )}
            <span style={{ fontSize: 10, color: T.inkMuted }}>·</span>
            <span style={{ fontSize: 10, color: T.inkMuted }}>
              {posts.length} publication{posts.length > 1 ? "s" : ""}
            </span>
            {typesPresent.length > 1 && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["all", "Tous"], ...typesPresent.map((t) => [t, TYPE_META[t]?.label ?? t])].map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 99,
                      border: `1px solid ${filter === k ? T.green : T.border}`,
                      background: filter === k ? T.greenBg : "white",
                      color: filter === k ? T.green : T.sub,
                      cursor: "pointer",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {posts.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: T.inkMuted, fontSize: 13 }}>
              Les premières publications arrivent bientôt. Abonne-toi à la newsletter pour être prévenu.
            </div>
          )}

          {featured && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.green,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                📌 À la une
              </div>
              <ArticleCard post={featured} large />
            </div>
          )}

          {rest.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.inkMuted,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                  marginTop: 20,
                }}
              >
                Publications récentes
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rest.map((p) => (
                  <ArticleCard key={p.id} post={p} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : tab === "newsletter" ? (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px" }}>
          <NewsletterBox />
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: T.inkMuted,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Archives
          </div>
          {issues.length === 0 && (
            <p style={{ fontSize: 12, color: T.inkMuted }}>Pas encore de numéro publié — le premier arrive.</p>
          )}
          {issues.map((issue) => {
            const inner = (
              <div
                style={{
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: "14px 18px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.green,
                    background: T.greenBg,
                    borderRadius: 6,
                    padding: "4px 8px",
                    flexShrink: 0,
                  }}
                >
                  #{issue.issue_number.replace(/^#/, "")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{issue.title}</div>
                  <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 2 }}>{formatMonth(issue.published_at)}</div>
                </div>
                {issue.content_url && <span style={{ fontSize: 11, color: T.green }}>Lire →</span>}
              </div>
            );
            return issue.content_url ? (
              <a key={issue.id} href={issue.content_url} target="_blank" rel="noreferrer">
                {inner}
              </a>
            ) : (
              <div key={issue.id}>{inner}</div>
            );
          })}
        </div>
      ) : (
        <Collaborations />
      )}

      <PublicFooter />
    </div>
  );
}
