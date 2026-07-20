"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { defaultConfig } from "@/components/LandingPage";

type Question = {
  id: string;
  question: string;
  type: "choice" | "text";
  options?: string[];
  placeholder?: string;
};

const TEACHER_QUESTIONS: Question[] = [
  { id: "t1", question: "Tu enseignes à quel niveau ?", type: "choice", options: ["Primaire (CE1–CM2)", "Collège (6ème–3ème)", "Lycée (2nde–Tle)", "Supérieur"] },
  { id: "t2", question: "Combien d'élèves as-tu en moyenne par classe ?", type: "choice", options: ["Moins de 20", "20–35", "35–50", "Plus de 50"] },
  { id: "t3", question: "Quelle est ta plus grande frustration au quotidien en tant qu'enseignant ?", type: "text", placeholder: "Prends le temps d'être honnête — c'est ce qui nous aide le plus." },
  { id: "t4", question: "Sais-tu aujourd'hui, avec précision, quels élèves bloquent sur quoi ?", type: "choice", options: ["Oui, clairement", "Partiellement", "Non, je manque de visibilité", "Je n'ai pas le temps d'y penser"] },
  { id: "t5", question: "Si un outil pouvait te donner ça chaque matin en 2 minutes — l'utiliserais-tu ?", type: "choice", options: ["Oui, sans hésitation", "Peut-être, si c'est simple", "Faudrait que je voie", "Non"] },
  { id: "t6", question: "Un dernier mot — qu'est-ce qu'un bon outil EdTech devrait arrêter de faire ?", type: "text", placeholder: "Libre à toi…" },
];

const STUDENT_QUESTIONS: Question[] = [
  { id: "s1", question: "Tu es en quelle classe ?", type: "choice", options: ["Collège (6ème–3ème)", "Lycée (2nde–Tle)", "Prépa / Supérieur", "Autre"] },
  { id: "s2", question: "Quand tu bloques sur un exercice, qu'est-ce que tu fais ?", type: "choice", options: ["Je demande à un ami", "Je cherche sur YouTube / Google", "Je demande à ChatGPT", "Je laisse tomber"] },
  { id: "s3", question: "Qu'est-ce qui t'énerve le plus dans la façon dont tu apprends aujourd'hui ?", type: "text", placeholder: "Sois direct — pas de bonne ou mauvaise réponse." },
  { id: "s4", question: "Utilises-tu déjà des outils IA pour tes devoirs ?", type: "choice", options: ["Oui, souvent", "Oui, parfois", "J'ai essayé mais j'ai arrêté", "Non jamais"] },
  { id: "s5", question: "Si tu pouvais avoir un tuteur IA qui se souvient de toi entre les sessions — ça changerait quoi ?", type: "text", placeholder: "Imagine…" },
];

type Answer = { question_id: string; answer_text?: string; answer_choice?: string };
type WallPost = { id: string; content: string; profile: string; resonates: number; important: number; isNew?: boolean };

const SEED_POSTS: WallPost[] = [
  { id: "p1", content: "Ce qui me manque le plus c'est quelqu'un qui remarque que je bloque avant que je décroche complètement.", profile: "student", resonates: 14, important: 6 },
  { id: "p2", content: "J'ai 38 élèves. Je ne peux pas savoir qui a besoin de quoi sans y passer mes soirées.", profile: "teacher", resonates: 22, important: 11 },
];

function SurveyFlow({ profile, onDone }: { profile: "teacher" | "student"; onDone: () => void }) {
  const questions = profile === "teacher" ? TEACHER_QUESTIONS : STUDENT_QUESTIONS;
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const q = questions[step];
  const total = questions.length;
  const progress = (step / total) * 100;
  const isLast = step === total - 1;

  function advance() {
    setText("");
    if (isLast) {
      setSubmitting(true);
      window.setTimeout(onDone, 500);
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-9 flex items-center gap-3">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-bluestift-orange transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="flex-shrink-0 text-[11px] text-slate-400">
          {step + 1} / {total}
        </span>
      </div>

      <div className="mb-8">
        <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-bluestift-orange">
          {profile === "teacher" ? "👩‍🏫 Enseignant" : "🎓 Élève"}
        </div>
        <h2 className="mb-7 font-display font-bold leading-snug tracking-tight text-primary" style={{ fontSize: "clamp(1.2rem,3vw,1.7rem)" }}>
          {q.question}
        </h2>

        {q.type === "choice" ? (
          <div className="flex flex-col gap-2.5">
            {q.options!.map((opt) => (
              <button
                key={opt}
                onClick={advance}
                disabled={submitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-[13px] font-medium text-slate-900 transition-transform hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
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
              className="w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-[13px] leading-relaxed text-slate-900 outline-none"
            />
            <button
              onClick={advance}
              disabled={submitting}
              className="mt-3 rounded-lg bg-bluestift-orange px-6 py-2.5 text-xs font-bold text-white"
            >
              {submitting ? "Envoi…" : isLast ? "Terminer ✓" : "Continuer →"}
            </button>
          </div>
        )}
      </div>

      <button onClick={advance} disabled={submitting} className="text-[11px] text-slate-400">
        Passer cette question →
      </button>
    </div>
  );
}

function DoneScreen({ onFreeWall }: { onFreeWall: () => void }) {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      <div className="mb-5 text-5xl">🙏</div>
      <h2 className="mb-3 text-3xl font-black tracking-tight text-primary">Merci.</h2>
      <p className="mb-6 text-[13px] leading-relaxed text-solid">
        Tes réponses vont directement alimenter le développement de RAYA. Laisse ton email si tu veux un accès
        anticipé quand la beta sera prête.
      </p>

      {!saved && (
        <div className="mb-6 flex justify-center gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.com"
            type="email"
            className="w-[190px] rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none"
          />
          <button
            onClick={() => email.includes("@") && setSaved(true)}
            className="rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-bold text-white"
          >
            Accès anticipé
          </button>
        </div>
      )}
      {saved && <p className="mb-6 text-xs font-semibold text-emerald-600">✓ Noté — à bientôt !</p>}

      <div className="flex flex-col items-center gap-2.5">
        <button onClick={onFreeWall} className="rounded-lg bg-bluestift-orange px-7 py-3 text-[13px] font-bold text-white">
          Partager librement ✍️
        </button>
        <Link href="/" className="rounded-lg border border-slate-200 px-7 py-2.5 text-[13px] text-slate-500">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

function FreeWall() {
  const [posts, setPosts] = useState<WallPost[]>(SEED_POSTS);
  const [text, setText] = useState("");
  const [profile, setProfile] = useState("student");
  const [reacted, setReacted] = useState<Set<string>>(new Set());

  function submit() {
    if (!text.trim()) return;
    setPosts((p) => [{ id: `new-${Date.now()}`, content: text.trim(), profile, resonates: 0, important: 0, isNew: true }, ...p]);
    setText("");
  }

  function react(id: string, type: "resonates" | "important") {
    const key = `${id}:${type}`;
    if (reacted.has(key)) return;
    setReacted((s) => new Set(s).add(key));
    setPosts((p) => p.map((post) => (post.id === id ? { ...post, [type]: post[type] + 1 } : post)));
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <h2 className="mb-2 font-display font-bold tracking-tight text-primary" style={{ fontSize: "clamp(1.3rem,3vw,1.8rem)" }}>
          Dis-nous ce que tu penses.
        </h2>
        <p className="text-[13px] leading-relaxed text-solid">
          Pas de questions, pas de formulaire. Juste un espace pour t&apos;exprimer librement. Ce que tu écris ici
          alimente directement le produit.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[
            ["student", "🎓 Élève"],
            ["teacher", "👩‍🏫 Enseignant"],
            ["anonymous", "👤 Anonyme"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setProfile(k)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                profile === k ? "border-bluestift-orange bg-orange-50 text-orange-700" : "border-slate-200 text-slate-500"
              }`}
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
          className="mb-2.5 w-full resize-none rounded-xl border-none bg-slate-50 p-3.5 text-[13px] leading-relaxed text-slate-900 outline-none"
        />
        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="rounded-lg bg-bluestift-orange px-5 py-2.5 text-xs font-bold text-white disabled:bg-slate-100 disabled:text-slate-400"
          >
            Publier
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {posts.map((post) => (
          <div
            key={post.id}
            className={`rounded-2xl border p-4 ${post.isNew ? "border-orange-200 bg-orange-50/60" : "border-slate-200 bg-white"}`}
          >
            <div className="mb-2.5 flex items-center gap-2">
              <span>{post.profile === "teacher" ? "👩‍🏫" : post.profile === "student" ? "🎓" : "👤"}</span>
              <span className="text-[11px] font-semibold text-slate-500">
                {post.profile === "teacher" ? "Enseignant" : post.profile === "student" ? "Élève" : "Anonyme"}
              </span>
            </div>
            <p className="font-accent italic mb-3.5 text-[13px] leading-relaxed text-slate-900">&ldquo;{post.content}&rdquo;</p>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => react(post.id, "resonates")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] ${
                  reacted.has(`${post.id}:resonates`) ? "border-bluestift-orange text-orange-700" : "border-slate-200 text-slate-500"
                }`}
              >
                💛 Ça me parle — {post.resonates}
              </button>
              <button
                onClick={() => react(post.id, "important")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] ${
                  reacted.has(`${post.id}:important`) ? "border-bluestift-orange text-orange-700" : "border-slate-200 text-slate-500"
                }`}
              >
                🔥 Important — {post.important}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SurveyPage() {
  const [view, setView] = useState<"landing" | "survey-teacher" | "survey-student" | "done" | "free">("landing");

  const tabs = (
    <div className="flex gap-1.5">
      {[
        ["landing", "Survey"],
        ["free", "Expression libre"],
      ].map(([k, l]) => {
        const activeGroup = k === "landing" ? view !== "free" : view === "free";
        return (
          <button
            key={k}
            onClick={() => setView(k as "landing" | "free")}
            className={`rounded-full border px-3 py-1 text-[11px] ${
              activeGroup ? "border-bluestift-orange bg-orange-50 text-orange-700" : "border-transparent text-slate-500"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen font-sans">
      <Navbar config={defaultConfig} active="Survey" section="Survey" />

      <Reveal>
        <div className="pt-[140px] pb-6">
          <div className="mb-8 flex justify-center">{tabs}</div>

          {view === "landing" && (
            <div className="mx-auto max-w-lg px-4 pb-16 text-center sm:px-6">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-bluestift-orange" />
                <span className="text-[11px] font-semibold text-orange-700">R&D · 5 minutes · Anonyme</span>
              </div>

              <h1 className="mb-4 font-display font-black leading-tight tracking-tight text-primary" style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)" }}>
                Tu enseignes ou tu apprends ?
                <br />
                <em className="font-accent not-italic italic text-bluestift-orange">Dis-nous ce qui bloque vraiment.</em>
              </h1>
              <p className="mx-auto mb-9 max-w-sm text-[13px] leading-relaxed text-solid">
                6 questions. Pas de compte requis. Tes réponses alimentent directement le développement de RAYA et du
                Cognitive Kernel.
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setView("survey-teacher")}
                  className="flex items-center gap-2 rounded-xl bg-slate-950 px-7 py-3.5 text-[13px] font-bold text-white"
                >
                  👩‍🏫 Je suis enseignant
                </button>
                <button
                  onClick={() => setView("survey-student")}
                  className="flex items-center gap-2 rounded-xl bg-bluestift-orange px-7 py-3.5 text-[13px] font-bold text-white"
                >
                  🎓 Je suis élève
                </button>
              </div>

              <button onClick={() => setView("free")} className="mt-5 text-xs text-slate-400 underline">
                Ou m&apos;exprimer librement →
              </button>

              <div className="mt-10 flex justify-center gap-8">
                {[
                  { v: "312", l: "réponses collectées" },
                  { v: "58", l: "témoignages partagés" },
                ].map((s) => (
                  <div key={s.l} className="text-center">
                    <div className="text-xl font-extrabold text-bluestift-orange">{s.v}</div>
                    <div className="text-[10px] text-slate-400">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "survey-teacher" && <SurveyFlow profile="teacher" onDone={() => setView("done")} />}
          {view === "survey-student" && <SurveyFlow profile="student" onDone={() => setView("done")} />}
          {view === "done" && <DoneScreen onFreeWall={() => setView("free")} />}
          {view === "free" && <FreeWall />}
        </div>
      </Reveal>

      <Footer config={defaultConfig} />
    </div>
  );
}
