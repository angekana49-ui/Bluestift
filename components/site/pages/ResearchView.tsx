"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import SitePage from "@/components/site/SitePage";
import RoadmapTimeline, { ROADMAP_UPDATED } from "@/components/site/RoadmapTimeline";
import type { Theme } from "@/components/site/theme";
import { GUTTER, MEASURE, PAGE_BOTTOM, lead, pageH1, pageSection, serifEm } from "@/components/site/layout";
import { useTranslate } from "@/components/ui/locale";
import { BluestiftText } from "@/components/ui/brand";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { readTime } from "@/components/public/format";
import type { PublicNewsletterIssue, PublicResearchPost } from "@/lib/content";
import type { MessageKey } from "@/lib/i18n";

const TYPE_META: Record<string, { labelKey: MessageKey; icon: string }> = {
  paper: { labelKey: "research.post.type.paper", icon: "📄" },
  experiment: { labelKey: "research.post.type.experiment", icon: "🧪" },
  article: { labelKey: "research.post.type.article", icon: "✍️" },
  update: { labelKey: "research.post.type.update", icon: "⚡" },
};

function enMonth(date: string | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(date));
}

function excerpt(content: string | null): string {
  if (!content) return "";
  const text = content.replace(/[#*_>`]/g, "").trim();
  return text.length > 220 ? text.slice(0, 220) + "…" : text;
}

function field(t: Theme) {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${t.cardBorder}`,
    background: t.inputFieldBg,
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 15,
    color: t.text,
    outline: "none",
  } as const;
}

// ─── Article card ────────────────────────────────────────────
function ArticleCard({ t, post, large }: { t: Theme; post: PublicResearchPost; large?: boolean }) {
  const tr = useTranslate();
  const meta = TYPE_META[post.type ?? "article"] ?? TYPE_META.article;
  return (
    <Link
      href={`/research/${post.slug ?? post.id}`}
      style={{
        display: "block",
        position: "relative",
        overflow: "hidden",
        background: t.cardBg,
        borderTop: `1px solid ${t.cardBorder}`,
        borderRight: `1px solid ${t.cardBorder}`,
        borderBottom: `1px solid ${t.cardBorder}`,
        borderLeft: large ? `3px solid ${t.greenSolid}` : `1px solid ${t.cardBorder}`,
        borderRadius: large ? 22 : 18,
        padding: large ? "26px 28px" : "18px 20px",
        boxShadow: t.cardShadow,
        textDecoration: "none",
        color: t.text,
      }}
    >
      {/* The featured card used to carry an infinite `shine` sweep. On a link to
          an article it read as a loading skeleton, not as emphasis — the card's
          size already says which post is featured. The hover lift is the
          emphasis now. */}
      <div style={{ position: "relative", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: large ? 12 : 8, fontSize: 13, color: t.mutedLight }}>
        <span>{meta.icon}</span>
        <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tr(meta.labelKey)}</span>
        <span>·</span>
        <span>{enMonth(post.published_at ?? post.created_at)}</span>
        {large && (
          <>
            <span>·</span>
            <span>{readTime(post.content)}</span>
          </>
        )}
      </div>
      <h3 style={{ position: "relative", fontFamily: "var(--font-instrument-serif),'Instrument Serif',serif", fontStyle: "italic", fontSize: large ? 18 : 14, margin: "0 0 10px", lineHeight: 1.4, color: t.text }}>
        {post.title}
      </h3>
      {large && post.content && (
        <p style={{ position: "relative", fontSize: 14, color: t.muted, lineHeight: 1.7, margin: "0 0 14px" }}>{excerpt(post.content)}</p>
      )}
      {large && (
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
          {post.authors.slice(0, 1).map((a) => (
            <span key={a.full_name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#22c55e", color: "white", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.full_name[0]}</span>
              <span style={{ fontSize: 13, color: t.muted }}>
                {a.full_name}
                {a.institution ? ` · ${a.institution}` : ""}
              </span>
            </span>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: t.greenDot }}>{tr("research.hub.readMore")}</span>
        </div>
      )}
    </Link>
  );
}

// ─── Newsletter subscribe box ────────────────────────────────
function NewsletterBox({ t }: { t: Theme }) {
  const tr = useTranslate();
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
    <div style={{ marginBottom: 24, borderRadius: 18, border: `1px solid ${t.greenBorder}`, background: t.greenBg, padding: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }}>
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.greenText }}>{tr("research.hub.newsletterEyebrow")}</div>
          <h3 style={{ fontFamily: "var(--font-instrument-serif),'Instrument Serif',serif", fontStyle: "italic", fontSize: 18, margin: "0 0 8px", color: t.greenText }}>
            <BluestiftText>{tr("research.hub.newsletterTitle")}</BluestiftText>
          </h3>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: t.greenText, margin: 0, opacity: 0.85 }}>{tr("research.hub.newsletterTagline")}</p>
        </div>
        {state !== "done" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" style={{ width: 210, border: `1px solid ${t.greenBorder}`, background: t.cardBg, borderRadius: 8, padding: "10px 14px", fontSize: 14, color: t.text, outline: "none" }} />
            <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
            {state === "error" && <span style={{ fontSize: 13, color: "#ef4444" }}>{tr("research.hub.subscribeError")}</span>}
            <button onClick={subscribe} style={{ background: t.greenSolid, color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {state === "busy" ? "…" : tr("research.hub.subscribe")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.greenText }}>
            <span>✓</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{tr("research.hub.subscribed")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Propose a contribution ──────────────────────────────────
function ProposeForm({ t, onClose }: { t: Theme; onClose: () => void }) {
  const tr = useTranslate();
  const [form, setForm] = useState({ name: "", email: "", category: "article", title: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

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
      <div style={{ maxWidth: MEASURE.form, margin: "0 auto", padding: "8px 0" }}>
        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: "48px 24px", boxShadow: t.cardShadow, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🙏</div>
          <h2 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 10px", color: t.text }}>{tr("research.hub.propose.received")}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: t.muted, marginBottom: 24 }}>
            <BluestiftText>{tr("research.hub.propose.receivedBody")}</BluestiftText>
          </p>
          <button onClick={onClose} style={{ background: t.greenSolid, color: "#ffffff", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{tr("research.hub.propose.backToArticles")}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: MEASURE.form, margin: "0 auto", padding: "8px 0" }}>
      <button onClick={onClose} style={{ background: "none", border: "none", marginBottom: 16, fontSize: 14, color: t.muted, cursor: "pointer" }}>{tr("research.hub.propose.back")}</button>
      <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 24, boxShadow: t.cardShadow }}>
        <h2 style={{ fontFamily: "var(--font-instrument-serif),'Instrument Serif',serif", fontStyle: "italic", fontSize: 23, margin: "0 0 8px", color: t.text }}>{tr("research.hub.propose.title")}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: t.muted, marginBottom: 20 }}>{tr("research.hub.propose.lead")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input placeholder={tr("research.hub.propose.namePlaceholder")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={field(t)} />
          <input placeholder="you@email.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={field(t)} />
        </div>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={field(t)}>
          <option value="paper">{tr("research.hub.propose.categoryPaper")}</option>
          <option value="experiment">{tr("research.hub.propose.categoryExperiment")}</option>
          <option value="article">{tr("research.post.type.article")}</option>
          <option value="other">{tr("onb.other")}</option>
        </select>
        <input placeholder={tr("research.hub.propose.titlePlaceholder")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={field(t)} />
        <textarea placeholder={tr("research.hub.propose.descPlaceholder")} rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...field(t), resize: "vertical", lineHeight: 1.6 }} />
        <label style={{ fontSize: 13, color: t.muted }}>
          {tr("research.hub.propose.attachment")}
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ marginTop: 4, display: "block", fontSize: 13, color: t.muted }} />
        </label>
        <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        {state === "error" && <span style={{ fontSize: 13, color: "#ef4444" }}>{tr("research.hub.propose.sendError")}</span>}
        <button
          onClick={submit}
          disabled={!form.title.trim() || state === "busy"}
          style={{ alignSelf: "flex-start", background: form.title.trim() && state !== "busy" ? t.greenSolid : t.inputFieldBg, color: form.title.trim() && state !== "busy" ? "white" : t.muted, border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: form.title.trim() && state !== "busy" ? "pointer" : "default" }}
        >
          {state === "busy" ? tr("research.hub.propose.sending") : tr("research.hub.propose.send")}
        </button>
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
  /**
   * The two facts the "Payments & quotas" entry states about itself, resolved
   * server-side. They live in `server-only` modules, so the page reads them and
   * this client view is handed the answer rather than the module.
   */
  paymentsLive: boolean;
  quotasEnforced: boolean;
};

const TYPE_FILTERS = ["all", "paper", "experiment", "article", "update"] as const;
// "progress" sits second on purpose: after the writing, before the mailing
// list. It is the one tab a sceptical visitor is looking for, and it is the
// only one that is never empty.
const VALID_TABS = ["articles", "progress", "newsletter", "collaborations"] as const;

const TAB_LABEL_KEY: Record<(typeof VALID_TABS)[number], MessageKey> = {
  articles: "research.hub.tab.articles",
  progress: "research.hub.tab.progress",
  newsletter: "research.hub.tab.newsletter",
  collaborations: "research.hub.tab.collaborations",
};

export function ResearchView({ posts, issues, signedIn, initialTab, paymentsLive, quotasEnforced }: Props) {
  const tr = useTranslate();
  const [tab, setTab] = useState<string>(VALID_TABS.includes((initialTab ?? "") as (typeof VALID_TABS)[number]) ? (initialTab as string) : "articles");
  const [proposing, setProposing] = useState(false);
  const [filter, setFilter] = useState<(typeof TYPE_FILTERS)[number]>("all");

  const filtered = filter === "all" ? posts : posts.filter((p) => (p.type ?? "article") === filter);
  const [featured, ...rest] = filtered;

  return (
    <SitePage active="Research" section="Research" signedIn={signedIn}>
      {(t) => (
        <>
          {/* The tab strip has to sit tight under the title, so this header
              overrides only the bottom of the shared page padding. */}
          <section style={{ ...pageSection, paddingBottom: 40 }}>
            <div style={{ maxWidth: MEASURE.text, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.greenBg, border: `1px solid ${t.greenBorder}`, borderRadius: 999, padding: "6px 16px", marginBottom: 16 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.greenDot }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.greenText }}>{tr("research.hub.pillVolume")}</span>
                </div>
                <h1 style={{ ...pageH1(t), margin: 0 }}>
                  {tr("research.hub.h1.a")} <em style={{ ...serifEm, color: t.greenText }}>{tr("research.hub.h1.em")}</em>
                </h1>
                <p style={lead(t)}>
                  {tr("research.hub.lead")}
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 4, background: t.inputFieldBg, border: `1px solid ${t.cardBorder}`, borderRadius: 999, padding: 4, boxShadow: t.cardShadow }}>
                  {VALID_TABS.map((k) => {
                    const on = tab === k && !proposing;
                    return (
                      <button
                        key={k}
                        onClick={() => { setTab(k); setProposing(false); }}
                        style={{ padding: "6px 14px", borderRadius: 999, fontSize: 14, fontWeight: on ? 600 : 400, textTransform: "capitalize", color: on ? t.text : t.muted, background: on ? t.pillActiveBg : "transparent", boxShadow: on ? t.pillActiveShadow : "none", border: "none", cursor: "pointer" }}
                      >
                        {tr(TAB_LABEL_KEY[k])}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setProposing(true)} style={{ display: "inline-flex", alignItems: "center", background: t.greenSolid, color: "#ffffff", border: "none", borderRadius: 999, padding: "6px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 6px 16px rgba(16,185,129,0.35)" }}>
                  {tr("research.hub.submit")}
                </button>
              </div>
            </div>
          </section>

          <div style={{ maxWidth: MEASURE.text, margin: "0 auto", padding: `0 ${GUTTER}px ${PAGE_BOTTOM}px`, position: "relative", zIndex: 1 }}>
            {proposing ? (
              <ProposeForm t={t} onClose={() => setProposing(false)} />
            ) : tab === "articles" ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, borderBottom: `1px solid ${t.cardBorder}`, paddingBottom: 14, marginBottom: 20 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.greenDot }}>{tr("research.hub.volume1")}</span>
                  <span style={{ fontSize: 13, color: t.mutedLight }}>· {posts.length} {tr("research.hub.publications")}</span>
                  <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {TYPE_FILTERS.map((k) => {
                      const on = filter === k;
                      return (
                        <button
                          key={k}
                          onClick={() => setFilter(k)}
                          style={{ borderRadius: 999, border: `1px solid ${on ? t.greenSolid : t.cardBorder}`, background: on ? t.greenSolid : t.cardBg, color: on ? "#ffffff" : t.muted, padding: "4px 10px", fontSize: 13, cursor: "pointer" }}
                        >
                          {k === "all" ? tr("research.hub.filterAll") : tr(TYPE_META[k].labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {featured ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.greenDot, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>{tr("research.hub.featured")}</div>
                    <div style={{ marginBottom: 24 }}>
                      <ArticleCard t={t} post={featured} large />
                    </div>
                    {rest.length > 0 && (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.mutedLight, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>{tr("research.hub.recentPublications")}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {rest.map((p) => (
                            <ArticleCard key={p.id} t={t} post={p} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p style={{ padding: "40px 0", textAlign: "center", fontSize: 15, color: t.mutedLight }}>{tr("research.hub.noPublications")}</p>
                )}
              </>
            ) : tab === "progress" ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, borderBottom: `1px solid ${t.cardBorder}`, paddingBottom: 14, marginBottom: 20 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.greenDot }}>
                    {tr("site.roadmap.eyebrow")}
                  </span>
                  <span style={{ fontSize: 13, color: t.mutedLight }}>· {tr("site.roadmap.title.em")}</span>
                  {/* Undated, this list cannot be audited: nothing on a status
                      page looks stale, so "in progress" reads as current
                      whether it was written last week or last year. */}
                  <span style={{ marginLeft: "auto", fontSize: 13, color: t.mutedLight }}>
                    {tr("research.hub.checkedOn")} {ROADMAP_UPDATED}
                  </span>
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: t.muted, margin: "0 0 20px" }}>{tr("site.roadmap.sub")}</p>
                <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: "26px 28px", boxShadow: t.cardShadow }}>
                  <RoadmapTimeline theme={t} ringColor={t.cardBg} paymentsLive={paymentsLive} quotasEnforced={quotasEnforced} />
                </div>
              </>
            ) : tab === "newsletter" ? (
              <>
                <NewsletterBox t={t} />
                <div style={{ fontSize: 13, fontWeight: 700, color: t.mutedLight, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>{tr("research.hub.archive")}</div>
                {issues.length === 0 ? (
                  <p style={{ fontSize: 15, color: t.mutedLight }}>{tr("research.hub.noIssues")}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {issues.map((issue) => {
                      const inner = (
                        <div style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: 12, border: `1px solid ${t.cardBorder}`, background: t.cardBg, padding: "14px 16px" }}>
                          <div style={{ borderRadius: 6, background: t.greenBg, padding: "4px 8px", fontSize: 13, fontWeight: 700, color: t.greenText }}>#{issue.issue_number}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{issue.title}</div>
                            <div style={{ marginTop: 2, fontSize: 13, color: t.mutedLight }}>{enMonth(issue.published_at)}</div>
                          </div>
                          {issue.content_url && <span style={{ fontSize: 13, color: t.greenDot }}>{tr("research.hub.readMore")}</span>}
                        </div>
                      );
                      return issue.content_url ? (
                        <a key={issue.id} href={issue.content_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{inner}</a>
                      ) : (
                        <div key={issue.id}>{inner}</div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ maxWidth: MEASURE.form, margin: "0 auto" }}>
                <h2 style={{ ...serifEm, fontSize: 21, margin: "0 0 8px", color: t.greenText }}>{tr("research.hub.collab.title")}</h2>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: t.muted, marginBottom: 16 }}>
                  <BluestiftText>{tr("research.hub.collab.body")}</BluestiftText>
                </p>
                <div style={{ display: "flex", gap: 12, borderRadius: 12, borderTop: `1px solid ${t.cardBorder}`, borderRight: `1px solid ${t.cardBorder}`, borderBottom: `1px solid ${t.cardBorder}`, borderLeft: "3px solid #6366f1", background: t.cardBg, padding: 16, boxShadow: t.cardShadow }}>
                  <span style={{ fontSize: 23 }}>🤝</span>
                  <div>
                    <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 700, color: "#6366f1" }}>{tr("research.hub.collab.calloutTitle")}</div>
                    <p style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.7, color: t.muted }}>
                      {tr("research.hub.collab.calloutBody")}
                    </p>
                    <Link href="/contact" style={{ display: "inline-block", borderRadius: 8, background: "#6366f1", padding: "8px 16px", fontSize: 13, fontWeight: 700, color: "white", textDecoration: "none" }}>{tr("research.hub.contactUs")}</Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </SitePage>
  );
}
