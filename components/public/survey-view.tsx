"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PublicNav } from "@/components/public/nav";
import { PublicFooter } from "@/components/public/footer";
import { survey as T, serif, sans } from "@/components/public/theme";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import type { WallPost } from "@/lib/content";

// ─── Questions (question_id -> content.survey_answers.question_id) ──────────
type Question = {
  id: string;
  question: string;
  type: "choice" | "text";
  options?: string[];
  placeholder?: string;
};

const TEACHER_QUESTIONS: Question[] = [
  {
    id: "t1",
    question: "Tu enseignes à quel niveau ?",
    type: "choice",
    options: ["Primaire (CE1–CM2)", "Collège (6ème–3ème)", "Lycée (2nde–Tle)", "Supérieur"],
  },
  {
    id: "t2",
    question: "Combien d'élèves as-tu en moyenne par classe ?",
    type: "choice",
    options: ["Moins de 20", "20–35", "35–50", "Plus de 50"],
  },
  {
    id: "t3",
    question: "Quelle est ta plus grande frustration au quotidien en tant qu'enseignant ?",
    type: "text",
    placeholder: "Prends le temps d'être honnête — c'est ce qui nous aide le plus.",
  },
  {
    id: "t4",
    question: "Est-ce que tu sais aujourd'hui, avec précision, quels élèves bloquent sur quoi ?",
    type: "choice",
    options: ["Oui, clairement", "Partiellement", "Non, je manque de visibilité", "Je n'ai pas le temps d'y penser"],
  },
  {
    id: "t5",
    question: "Si un outil pouvait te donner ça chaque matin en 2 minutes — est-ce que tu l'utiliserais ?",
    type: "choice",
    options: ["Oui, sans hésitation", "Peut-être, si c'est simple", "Faudrait que je voie", "Non"],
  },
  {
    id: "t6",
    question: "Un dernier mot — qu'est-ce qu'un bon outil EdTech devrait arrêter de faire ?",
    type: "text",
    placeholder: "Libre à toi…",
  },
];

const STUDENT_QUESTIONS: Question[] = [
  {
    id: "s1",
    question: "Tu es en quelle classe ?",
    type: "choice",
    options: ["Collège (6ème–3ème)", "Lycée (2nde–Tle)", "Prépa / Supérieur", "Autre"],
  },
  {
    id: "s2",
    question: "Quand tu bloques sur un exercice, qu'est-ce que tu fais ?",
    type: "choice",
    options: ["Je demande à un ami", "Je cherche sur YouTube / Google", "Je demande à ChatGPT", "Je laisse tomber"],
  },
  {
    id: "s3",
    question: "Qu'est-ce qui t'énerve le plus dans la façon dont tu apprends aujourd'hui ?",
    type: "text",
    placeholder: "Sois direct — pas de bonne ou mauvaise réponse.",
  },
  {
    id: "s4",
    question: "Est-ce que tu utilises déjà des outils IA pour tes devoirs ?",
    type: "choice",
    options: ["Oui, souvent", "Oui, parfois", "J'ai essayé mais j'ai arrêté", "Non jamais"],
  },
  {
    id: "s5",
    question: "Si tu pouvais avoir un tuteur IA qui se souvient de toi entre les sessions — ça changerait quoi pour toi ?",
    type: "text",
    placeholder: "Imagine…",
  },
];

function browserLang(): string {
  if (typeof navigator !== "undefined" && navigator.language) return navigator.language.slice(0, 2);
  return "fr";
}

// ─── Survey flow ─────────────────────────────────────────────
type Answer = { question_id: string; answer_text?: string; answer_choice?: string };

function SurveyFlow({
  profile,
  onDone,
}: {
  profile: "teacher" | "student";
  onDone: (responseId: string | null) => void;
}) {
  const questions = profile === "teacher" ? TEACHER_QUESTIONS : STUDENT_QUESTIONS;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const startedAt = useRef(Date.now());

  const q = questions[step];
  const total = questions.length;
  const progress = (step / total) * 100;
  const isLast = step === total - 1;

  async function finish(all: Answer[]) {
    setSubmitting(true);
    setError(false);
    const res = await fetch("/api/content/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        language: browserLang(),
        answers: all,
        time_to_complete_seconds: Math.round((Date.now() - startedAt.current) / 1000),
        token: captchaToken,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      setError(true);
      return;
    }
    const data = (await res.json()) as { id?: string };
    onDone(data.id ?? null);
  }

  function answer(a: Answer | null) {
    const next = a ? [...answers.filter((x) => x.question_id !== (a.question_id ?? "")), a] : answers;
    setAnswers(next);
    setText("");
    if (isLast) {
      void finish(next);
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
        <div style={{ flex: 1, height: 3, background: T.card, borderRadius: 99, overflow: "hidden" }}>
          <div
            style={{ height: "100%", width: `${progress}%`, background: T.amber, borderRadius: 99, transition: "width 0.3s" }}
          />
        </div>
        <span style={{ fontSize: 11, color: T.inkMuted, flexShrink: 0 }}>
          {step + 1} / {total}
        </span>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: T.amber,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          {profile === "teacher" ? "👩‍🏫 Enseignant" : "🎓 Élève"}
        </div>
        <h2
          style={{
            fontSize: "clamp(1.2rem,3vw,1.7rem)",
            fontWeight: 800,
            color: T.ink,
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            margin: "0 0 28px",
          }}
        >
          {q.question}
        </h2>

        {q.type === "choice" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {q.options!.map((opt) => (
              <button
                key={opt}
                onClick={() => answer({ question_id: q.id, answer_choice: opt })}
                disabled={submitting}
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 500,
                  border: `1px solid ${T.border}`,
                  background: T.white,
                  color: T.ink,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <textarea
              placeholder={q.placeholder}
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: "100%",
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 13,
                color: T.ink,
                fontFamily: "inherit",
                lineHeight: 1.6,
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => answer(text.trim() ? { question_id: q.id, answer_text: text.trim() } : null)}
              disabled={submitting}
              style={{
                marginTop: 12,
                background: T.amber,
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "11px 24px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {submitting ? "Envoi…" : isLast ? "Terminer ✓" : "Continuer →"}
            </button>
          </div>
        )}
      </div>

      {isLast && (
        <div style={{ marginBottom: 16 }}>
          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        </div>
      )}
      {error && (
        <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>
          Échec de l&apos;envoi — vérifie le CAPTCHA et réessaie.
        </p>
      )}

      <button
        onClick={() => answer(null)}
        disabled={submitting}
        style={{ background: "none", border: "none", fontSize: 11, color: T.inkMuted, cursor: "pointer", padding: 0 }}
      >
        Passer cette question →
      </button>
    </div>
  );
}

// ─── Done screen ─────────────────────────────────────────────
function DoneScreen({ responseId, onFreeWall }: { responseId: string | null; onFreeWall: () => void }) {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  async function saveEmail() {
    if (!email.includes("@") || !responseId) return;
    const res = await fetch("/api/content/survey/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_id: responseId, email, token: captchaToken }),
    });
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    if (res.ok) setSaved(true);
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🙏</div>
      <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: T.ink, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
        Merci.
      </h2>
      <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.7, marginBottom: 24 }}>
        Tes réponses vont directement alimenter le développement de Raya. Laisse ton email si tu veux un accès
        anticipé quand la beta sera prête.
      </p>

      {responseId && !saved && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              type="email"
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                color: T.ink,
                outline: "none",
                width: 200,
              }}
            />
            <button
              onClick={saveEmail}
              disabled={!captchaToken}
              style={{
                background: T.ink,
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                fontSize: 12,
                fontWeight: 700,
                cursor: captchaToken ? "pointer" : "not-allowed",
                opacity: captchaToken ? 1 : 0.6,
              }}
            >
              Accès anticipé
            </button>
          </div>
          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        </div>
      )}
      {saved && (
        <p style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginBottom: 24 }}>✓ Noté — à bientôt !</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <button
          onClick={onFreeWall}
          style={{
            background: T.amber,
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "12px 28px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Partager librement ✍️
        </button>
        <Link
          href="/"
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "11px 28px",
            fontSize: 13,
            color: T.sub,
          }}
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

// ─── Free expression wall ────────────────────────────────────
function FreeWall({ initialPosts }: { initialPosts: WallPost[] }) {
  const [posts, setPosts] = useState<Array<WallPost & { isNew?: boolean }>>(initialPosts);
  const [text, setText] = useState("");
  const [profile, setProfile] = useState("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [reacted, setReacted] = useState<Set<string>>(new Set());
  const turnstileRef = useRef<TurnstileHandle>(null);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(false);
    const res = await fetch("/api/content/wall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim(), profile, language: browserLang(), token: captchaToken }),
    });
    setBusy(false);
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    if (!res.ok) {
      setError(true);
      return;
    }
    const { post } = (await res.json()) as { post: WallPost };
    setPosts((p) => [{ ...post, isNew: true }, ...p]);
    setText("");
  }

  async function react(id: string, type: "resonates" | "important") {
    const key = `${id}:${type}`;
    if (reacted.has(key)) return;
    setReacted((s) => new Set(s).add(key));
    setPosts((p) => p.map((post) => (post.id === id ? { ...post, [type]: post[type] + 1 } : post)));
    await fetch("/api/content/wall/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: id, type }),
    });
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "clamp(1.3rem,3vw,1.8rem)", fontWeight: 800, color: T.ink, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Dis-nous ce que tu penses.
        </h2>
        <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.6 }}>
          Pas de questions, pas de formulaire. Juste un espace pour t&apos;exprimer librement. Ce que tu écris ici
          alimente directement le produit.
        </p>
      </div>

      {/* Composer */}
      <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            ["student", "🎓 Élève"],
            ["teacher", "👩‍🏫 Enseignant"],
            ["anonymous", "👤 Anonyme"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setProfile(k)}
              style={{
                padding: "5px 12px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 600,
                border: `1px solid ${profile === k ? T.amber : T.border}`,
                background: profile === k ? T.amberBg : "transparent",
                color: profile === k ? T.amberDk : T.sub,
                cursor: "pointer",
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ce qui me manque vraiment dans les outils éducatifs actuels c'est…"
          rows={3}
          style={{
            width: "100%",
            background: T.card,
            border: "none",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
            color: T.ink,
            fontFamily: "inherit",
            lineHeight: 1.6,
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 10,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
          <button
            onClick={submit}
            disabled={busy}
            style={{
              background: text.trim() ? T.amber : T.card,
              color: text.trim() ? "white" : T.inkMuted,
              border: "none",
              borderRadius: 8,
              padding: "9px 20px",
              fontSize: 12,
              fontWeight: 700,
              cursor: text.trim() ? "pointer" : "default",
            }}
          >
            {busy ? "…" : "Publier"}
          </button>
        </div>
        {error && (
          <p style={{ fontSize: 11, color: "#dc2626", margin: "8px 0 0" }}>
            Échec de la publication — vérifie le CAPTCHA et réessaie.
          </p>
        )}
      </div>

      {/* Posts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {posts.length === 0 && (
          <p style={{ fontSize: 12, color: T.inkMuted, textAlign: "center", padding: "24px 0" }}>
            Personne n&apos;a encore posté — sois le premier.
          </p>
        )}
        {posts.map((post) => (
          <div
            key={post.id}
            style={{
              background: post.isNew ? T.amberBg : T.white,
              border: `1px solid ${post.isNew ? T.amberBd : T.border}`,
              borderRadius: 14,
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>
                {post.profile === "teacher" ? "👩‍🏫" : post.profile === "student" ? "🎓" : "👤"}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.sub }}>
                {post.profile === "teacher" ? "Enseignant" : post.profile === "student" ? "Élève" : "Anonyme"}
              </span>
              <span style={{ fontSize: 10, color: T.inkMuted, marginLeft: "auto" }}>
                {post.language === "en" ? "🇬🇧" : "🇫🇷"}
              </span>
            </div>
            <p
              style={{
                fontSize: 13,
                color: T.ink,
                lineHeight: 1.65,
                margin: "0 0 14px",
                fontStyle: "italic",
                fontFamily: serif,
              }}
            >
              &ldquo;{post.content}&rdquo;
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => react(post.id, "resonates")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 12px",
                  borderRadius: 99,
                  border: `1px solid ${reacted.has(`${post.id}:resonates`) ? T.amber : T.border}`,
                  background: "transparent",
                  fontSize: 11,
                  color: reacted.has(`${post.id}:resonates`) ? T.amber : T.sub,
                  cursor: "pointer",
                }}
              >
                <span>💛</span> Ça me parle — {post.resonates}
              </button>
              <button
                onClick={() => react(post.id, "important")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 12px",
                  borderRadius: 99,
                  border: `1px solid ${reacted.has(`${post.id}:important`) ? T.amber : T.border}`,
                  background: "transparent",
                  fontSize: 11,
                  color: reacted.has(`${post.id}:important`) ? T.amber : T.sub,
                  cursor: "pointer",
                }}
              >
                <span>🔥</span> Important — {post.important}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────
type Props = {
  signedIn: boolean;
  initialPosts: WallPost[];
  stats: { responses: number; posts: number };
};

export function SurveyView({ signedIn, initialPosts, stats }: Props) {
  const [view, setView] = useState<"landing" | "survey-teacher" | "survey-student" | "done" | "free">("landing");
  const [responseId, setResponseId] = useState<string | null>(null);

  const tabs = (
    <div style={{ display: "flex", gap: 6 }}>
      {[
        ["landing", "Survey"],
        ["free", "Expression libre"],
      ].map(([k, l]) => {
        const activeGroup = k === "landing" ? view !== "free" : view === "free";
        return (
          <button
            key={k}
            onClick={() => setView(k as "landing" | "free")}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 99,
              border: `1px solid ${activeGroup ? T.amber : T.border}`,
              background: activeGroup ? T.amberBg : "transparent",
              color: activeGroup ? T.amberDk : T.sub,
              cursor: "pointer",
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ fontFamily: sans, background: T.bg, minHeight: "100vh", color: T.ink }}>
      <PublicNav
        signedIn={signedIn}
        section="Survey"
        accent={T.amber}
        accentDark={T.amberDk}
        center={tabs}
      />

      {view === "landing" && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: T.amberBg,
              border: `1px solid ${T.amberBd}`,
              borderRadius: 99,
              padding: "5px 14px",
              marginBottom: 24,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.amber, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: T.amber }}>R&D · 5 minutes · Anonyme</span>
          </div>

          <h1
            style={{
              fontSize: "clamp(1.6rem,4vw,2.4rem)",
              fontWeight: 900,
              color: T.ink,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              margin: "0 0 16px",
            }}
          >
            Tu enseignes ou tu apprends ?<br />
            <em style={{ fontFamily: serif, fontStyle: "italic", color: T.amber }}>
              Dis-nous ce qui bloque vraiment.
            </em>
          </h1>
          <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.65, maxWidth: 400, margin: "0 auto 36px" }}>
            6 questions. Pas de compte requis. Tes réponses alimentent directement le développement de Raya et du
            Cognitive Kernel.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setView("survey-teacher")}
              style={{
                background: T.ink,
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "14px 28px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              👩‍🏫 Je suis enseignant
            </button>
            <button
              onClick={() => setView("survey-student")}
              style={{
                background: T.amber,
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "14px 28px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              🎓 Je suis élève
            </button>
          </div>

          <button
            onClick={() => setView("free")}
            style={{
              marginTop: 20,
              background: "none",
              border: "none",
              fontSize: 12,
              color: T.inkMuted,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Ou m&apos;exprimer librement →
          </button>

          {(stats.responses > 0 || stats.posts > 0) && (
            <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 40 }}>
              {[
                { v: String(stats.responses), l: "réponses collectées" },
                { v: String(stats.posts), l: "témoignages partagés" },
              ].map((s) => (
                <div key={s.l} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.amber }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: T.inkMuted }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "survey-teacher" && (
        <SurveyFlow
          profile="teacher"
          onDone={(id) => {
            setResponseId(id);
            setView("done");
          }}
        />
      )}
      {view === "survey-student" && (
        <SurveyFlow
          profile="student"
          onDone={(id) => {
            setResponseId(id);
            setView("done");
          }}
        />
      )}
      {view === "done" && <DoneScreen responseId={responseId} onFreeWall={() => setView("free")} />}
      {view === "free" && <FreeWall initialPosts={initialPosts} />}

      <PublicFooter />
    </div>
  );
}
