"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { defaultConfig } from "@/components/LandingPage";

// ─────────────────────────────────────────────────────────────
//  Static seed content — this template has no backend, so posts
//  and issues are illustrative placeholders for the layout.
// ─────────────────────────────────────────────────────────────
type PostType = "paper" | "experiment" | "article" | "update";
type ResearchPost = {
  id: string;
  type: PostType;
  title: string;
  excerpt: string;
  month: string;
  readTime: string;
  authors: { name: string; institution?: string }[];
};

const TYPE_META: Record<PostType, { label: string; icon: string }> = {
  paper: { label: "Paper", icon: "📄" },
  experiment: { label: "Expérience", icon: "🧪" },
  article: { label: "Article", icon: "✍️" },
  update: { label: "Update", icon: "⚡" },
};

const POSTS: ResearchPost[] = [
  {
    id: "1",
    type: "paper",
    title: "Mesurer la maîtrise par concept plutôt que par note globale",
    excerpt:
      "Comment le Cognitive Kernel décompose une matière en concepts atomiques et recalcule une probabilité de maîtrise après chaque interaction, plutôt que d'attendre un contrôle.",
    month: "Juin 2026",
    readTime: "6 min",
    authors: [{ name: "Aïcha N.", institution: "Équipe Kernel" }],
  },
  {
    id: "2",
    type: "experiment",
    title: "Pilote terrain : 40 élèves de 3ème, six semaines avec RAYA",
    excerpt:
      "Premiers résultats d'un pilote mené avec deux collèges partenaires — temps de blocage, taux de complétion des exercices, retours des enseignants.",
    month: "Mai 2026",
    readTime: "8 min",
    authors: [{ name: "Samuel K." }, { name: "Léa D." }],
  },
  {
    id: "3",
    type: "article",
    title: "Pourquoi la méthode Socratique tient mieux la route qu'un chatbot",
    excerpt:
      "Un chatbot répond. RAYA questionne. Ce choix de conception a des conséquences directes sur la rétention et sur la détection des blocages.",
    month: "Avril 2026",
    readTime: "5 min",
    authors: [{ name: "Aïcha N.", institution: "Équipe Kernel" }],
  },
  {
    id: "4",
    type: "update",
    title: "Le Kernel passe en version 2 : profils multi-matières",
    excerpt: "Note de version courte sur l'extension du profil cognitif à plusieurs matières simultanément.",
    month: "Mars 2026",
    readTime: "3 min",
    authors: [{ name: "Équipe RAYA" }],
  },
];

const ISSUES = [
  { id: "1", number: "2", title: "Ce que le pilote de 3ème nous a appris", month: "Juin 2026" },
  { id: "2", number: "1", title: "Pourquoi on construit RAYA", month: "Mai 2026" },
];

function ArticleCard({ post, large }: { post: ResearchPost; large?: boolean }) {
  const meta = TYPE_META[post.type];
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className={`block rounded-[22px] border bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(15,23,42,0.1)] ${
        large ? "border-l-[3px] border-l-emerald-500 border-slate-200/80" : "border-slate-200/80"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm">{meta.icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{meta.label}</span>
        <span className="text-[10px] text-slate-300">·</span>
        <span className="text-[10px] text-slate-400">{post.month}</span>
        <span className="text-[10px] text-slate-300">·</span>
        <span className="text-[10px] text-slate-400">{post.readTime}</span>
      </div>
      <h3 className={`font-accent italic text-slate-950 leading-snug ${large ? "text-lg" : "text-sm"} mb-2.5`}>
        {post.title}
      </h3>
      <p className="text-xs leading-relaxed text-slate-500 mb-3.5">{post.excerpt}</p>
      <div className="flex flex-wrap items-center gap-3">
        {post.authors.map((a) => (
          <div key={a.name} className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bluestift-green text-[8px] font-bold text-white">
              {a.name[0]}
            </span>
            <span className="text-[11px] text-slate-500">{a.name}</span>
          </div>
        ))}
        <span className="ml-auto text-[11px] font-semibold text-emerald-600">Lire →</span>
      </div>
    </a>
  );
}

function NewsletterBox() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  function subscribe() {
    if (!email.includes("@") || state === "busy") return;
    setState("busy");
    window.setTimeout(() => setState("done"), 500);
  }

  return (
    <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-7">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[220px] flex-1">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-600">
            Newsletter · Mensuel
          </div>
          <h3 className="font-accent italic mb-2 text-base text-emerald-900">Bluestift Research Digest</h3>
          <p className="text-xs leading-relaxed text-emerald-700">
            Avancées du Kernel, résultats terrain, lectures recommandées. Une fois par mois, pas de spam.
          </p>
        </div>
        {state !== "done" ? (
          <div className="flex items-center gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              type="email"
              className="w-[190px] rounded-lg border border-emerald-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none"
            />
            <button
              onClick={subscribe}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white"
            >
              {state === "busy" ? "…" : "S'abonner"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-700">
            <span>✓</span>
            <span className="text-xs font-semibold">Inscrit ! Vérifie ta boîte mail.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ProposeForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", category: "article", title: "", description: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  function submit() {
    if (!form.title.trim() || state === "busy") return;
    setState("busy");
    window.setTimeout(() => setState("done"), 600);
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 outline-none";

  if (state === "done") {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mb-4 text-4xl">🙏</div>
        <h2 className="mb-2.5 text-xl font-bold text-slate-950">Proposition reçue.</h2>
        <p className="mb-6 text-[13px] leading-relaxed text-slate-500">
          On la relit et on te répond par email. Merci de contribuer à la recherche Bluestift.
        </p>
        <button onClick={onClose} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white">
          Retour aux articles
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-8">
      <button onClick={onClose} className="mb-5 text-xs text-slate-500">
        ← Retour
      </button>
      <h2 className="font-accent italic mb-2 text-xl text-slate-950">Proposer une contribution</h2>
      <p className="mb-5 text-[13px] leading-relaxed text-slate-500">
        Paper, expérience terrain, article ou jeu de données — décris ta proposition, l&apos;équipe research te
        recontacte.
      </p>
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <input placeholder="Ton nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          <input placeholder="ton@email.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
        </div>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
          <option value="paper">Paper académique</option>
          <option value="experiment">Expérience terrain</option>
          <option value="article">Article</option>
          <option value="other">Autre</option>
        </select>
        <input placeholder="Titre de la proposition" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
        <textarea
          placeholder="Décris ta contribution : sujet, méthode, données disponibles…"
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={`${inputClass} resize-y leading-relaxed`}
        />
        <button
          onClick={submit}
          disabled={!form.title.trim() || state === "busy"}
          className="self-start rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          {state === "busy" ? "Envoi…" : "Envoyer la proposition"}
        </button>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const [tab, setTab] = useState<"articles" | "newsletter" | "collaborations">("articles");
  const [proposing, setProposing] = useState(false);
  const [filter, setFilter] = useState<PostType | "all">("all");

  const filtered = filter === "all" ? POSTS : POSTS.filter((p) => p.type === filter);
  const [featured, ...rest] = filtered;

  return (
    <div className="min-h-screen font-sans">
      <Navbar config={defaultConfig} active="Research" section="Research" />

      <Reveal>
        <div className="mx-auto max-w-3xl px-4 pt-[140px] pb-24 sm:px-6">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              <span className="text-[11px] font-semibold text-emerald-700">Volume 1 · Recherche ouverte</span>
            </div>
            <h1 className="font-display font-black tracking-tight text-primary" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>
              Ce qu&apos;on apprend en <em className="font-accent not-italic italic">construisant RAYA.</em>
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-solid">
              Papers, expériences terrain et notes de version — publiés au fil de l&apos;eau, ouverts à tous.
            </p>
          </div>

          <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
            <div className="flex gap-1 rounded-full bg-black/5 p-1">
              {(["articles", "newsletter", "collaborations"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setTab(k);
                    setProposing(false);
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all ${
                    tab === k && !proposing ? "bg-white text-slate-950 shadow-[0_1px_4px_rgba(15,23,42,0.08)]" : "text-slate-500"
                  }`}
                >
                  {k === "articles" ? "Articles" : k === "newsletter" ? "Newsletter" : "Collaborations"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setProposing(true)}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white"
            >
              + Proposer
            </button>
          </div>

          {proposing ? (
            <ProposeForm onClose={() => setProposing(false)} />
          ) : tab === "articles" ? (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-600">Volume 1</span>
                <span className="text-[10px] text-slate-400">· {POSTS.length} publications</span>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {(["all", "paper", "experiment", "article", "update"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setFilter(k)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] ${
                        filter === k ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {k === "all" ? "Tous" : TYPE_META[k].label}
                    </button>
                  ))}
                </div>
              </div>

              {featured && (
                <div className="mb-4">
                  <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-emerald-600">
                    📌 À la une
                  </div>
                  <ArticleCard post={featured} large />
                </div>
              )}
              {rest.length > 0 && (
                <>
                  <div className="mb-2.5 mt-5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                    Publications récentes
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {rest.map((p) => (
                      <ArticleCard key={p.id} post={p} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : tab === "newsletter" ? (
            <>
              <NewsletterBox />
              <div className="mb-3.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Archives</div>
              <div className="flex flex-col gap-2">
                {ISSUES.map((issue) => (
                  <div key={issue.id} className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
                    <div className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                      #{issue.number}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-slate-950">{issue.title}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{issue.month}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-lg">
              <h2 className="font-accent italic mb-2 text-lg text-slate-950">Collaborations académiques</h2>
              <p className="mb-4 text-[13px] leading-relaxed text-slate-500">
                Bluestift souhaite collaborer avec des chercheurs en éducation pour valider le Cognitive Kernel. Ce
                chantier s&apos;ouvre : si le sujet t&apos;intéresse, écris-nous.
              </p>
              <div className="flex gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <span className="text-xl">🤝</span>
                <div>
                  <div className="mb-1 text-xs font-bold text-indigo-700">Tu es chercheur en éducation ?</div>
                  <p className="mb-3 text-[11px] leading-relaxed text-indigo-900/70">
                    Nous partageons nos données anonymisées et notre code source avec les chercheurs intéressés par le
                    Cognitive Kernel.
                  </p>
                  <a href="/contact" className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-[11px] font-bold text-white">
                    Nous contacter
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </Reveal>

      <Footer config={defaultConfig} />
    </div>
  );
}
