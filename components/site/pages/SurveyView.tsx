"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useRef, useState } from "react";
import SitePage from "@/components/site/SitePage";
import type { Theme } from "@/components/site/theme";
import { GUTTER, MEASURE, pageH1, pageTop, serifEm } from "@/components/site/layout";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import type { WallPost } from "@/lib/content";
import { IconTeacher, IconStudent, IconUser, IconHeart, IconFlame, IconPencil, IconCheck } from "@/components/site/icons";
import { RayaName } from "@/components/ui/brand";

type IconEl = ComponentType<{ size?: number; filled?: boolean }>;

type Question = {
  id: string;
  question: string;
  type: "choice" | "text";
  options?: string[];
  placeholder?: string;
  /**
   * Offer "Something else" with a box to say what.
   *
   * Only on questions whose options are a list of KINDS, never on a scale. Four
   * points from "much less" to "more" already cover the axis, and an escape
   * hatch under them just invites people to re-enter an answer that was there —
   * whereas "how do you find out" or "who do you tell" can never be complete,
   * and without a way out the reader picks the nearest wrong box. That silently
   * turns a gap in our list into data, which is worse than a blank.
   */
  other?: boolean;
};

/** The label for that escape hatch, and the value stored in `answer_choice`
 *  when it is taken — the specifics land in `answer_text` beside it. */
const OTHER = "Something else";

/*
 * Put the work in the OPTIONS, never in the typing.
 *
 * A survey competes with a closing tab. The reader's attention is short and
 * genuinely effort-averse, so the instinct is to ask easy questions — which
 * yields easy answers, and easy answers are worth nothing. The way out is not to
 * ask less, it is to move the thinking off the keyboard: a question can demand a
 * real, uncomfortable act of recall and still cost exactly one tap to answer.
 * "Could you name the three most lost students in your class, and on what?" runs
 * a hard test in the reader's head; the four options let them report the result
 * without composing a word.
 *
 * So each track is five taps and ONE sentence, and the sentence comes last,
 * when someone has already invested five answers and is far more likely to
 * spend a line than they were on the first screen. The options carry the weight
 * instead: concrete, specific, and at least one of them uncomfortable enough to
 * be worth admitting. A bland option set is a wasted question.
 *
 * Two other rules, learned from the set this replaces:
 *
 *  - Never open on something personal. Age as question one is an interrogation,
 *    and it is also the least useful thing we could spend the reader's first and
 *    most generous answer on. It opens on what they teach or where they are —
 *    one tap, zero exposure.
 *
 *  - No grade numbers. "Grades 6–9" is one country's school system, and the
 *    market this is built for does not use it. The bands below name a stage
 *    every system has, including the one everybody recognises: the exam years.
 *
 * Changed questions get a NEW id rather than new text under the old one. Answers
 * live in content.survey_answers keyed by question_id, so reusing an id would
 * silently pool answers to two different questions into one column.
 *
 * Both tracks must stay the SAME LENGTH: the landing quotes one number before
 * the visitor has said which they are.
 */
const LEVELS = ["Primary", "Secondary — early years", "Secondary — exam years", "Higher education"];

const TEACHER_QUESTIONS: Question[] = [
  // Vocational, special education and homeschooling all fall outside these four
  // and are exactly the teachers worth hearing from, so this one has a way out.
  { id: "t1_level", question: "What level do you teach?", type: "choice", options: LEVELS, other: true },
  { id: "t2", question: "How many students do you have per class on average?", type: "choice", options: ["Fewer than 20", "20–35", "35–50", "More than 50"] },
  // The visibility question, made concrete. "Do you know who is stuck?" invites
  // a comfortable "partially"; naming three students and their topics is a test
  // you either pass or fail, and the reader knows which before they answer.
  { id: "t4_name3", question: "Right now, without looking anything up — could you name the three students who are most lost, and on what?", type: "choice", options: ["Yes — names and topics", "The names, not the topics", "I'd have to check my records", "Honestly, no"] },
  // How late the news arrives. Every option is a real channel, and the last one
  // is the one nobody volunteers unprompted.
  { id: "t7_findout", question: "How do you usually find out a student didn't understand?", type: "choice", options: ["The test, afterwards", "They ask me", "A parent, or the next teacher", "Often I don't"], other: true },
  // The entry argument, put as a question instead of asserted. If this comes
  // back "no change", the thesis the whole product rests on is wrong — which is
  // the only reason worth running a survey at all.
  { id: "t5_signal", question: "Since your students started using AI, does the work they hand in tell you more or less about how they actually think?", type: "choice", options: ["Much less", "A little less", "No change", "More"] },
  { id: "t8_nohelp", question: "Last one. What part of your job has no tool ever helped with?", type: "text", placeholder: "One sentence is plenty." },
];

const STUDENT_QUESTIONS: Question[] = [
  { id: "s1_level", question: "Where are you in school?", type: "choice", options: LEVELS, other: true },
  // "Ask ChatGPT" named one product, which dates the question and quietly steers
  // it: a reader who uses Gemini reads their own habit as absent from the list
  // and picks something else. The examples stay, because recognition is what
  // makes the option land — they just no longer decide what counts as an AI.
  { id: "s2", question: "When you're stuck on a problem, what do you do?", type: "choice", options: ["Ask a friend", "Search YouTube / Google", "Ask an AI (ChatGPT, Gemini, Copilot…)", "Give up"], other: true },
  { id: "s4", question: "Do you already use AI tools for your homework?", type: "choice", options: ["Yes, often", "Yes, sometimes", "I tried but stopped", "Never"] },
  // The uncomfortable one, and the fourth option is the point: it is the honest
  // answer a good student gives, and no free-text box would ever have got it.
  { id: "s7_passed", question: "Has a teacher ever thought you understood something you didn't?", type: "choice", options: ["Often", "Once or twice", "Never", "Yes — and I made sure they thought so"] },
  // Tests the premise the privacy guardrail rests on — that a student stops
  // admitting confusion to anyone who might report it — rather than assuming it.
  { id: "s5_tells", question: "When you don't understand something, who do you tell?", type: "choice", options: ["My teacher", "A friend", "An AI", "Nobody"], other: true },
  { id: "s6_wish", question: "Last one. What's one thing you wish your teacher knew about how you're actually doing?", type: "text", placeholder: "One sentence is plenty — nobody will know it was you." },
];

/*
 * Quoted on the landing before a profile is picked, so the two tracks have to
 * agree. Both numbers are derived rather than typed: the copy once said 6 while
 * the student track had 5, and a survey that miscounts itself on its own first
 * screen is a poor advertisement for the rigour it is asking people to trust.
 *
 * The tap count is published for the same reason it was designed: "6 questions"
 * is priced by the reader as six paragraphs, which is the cost that makes them
 * close the tab. Saying five are a single tap is both the truthful figure and
 * the one that gets the survey answered.
 */
const QUESTION_COUNT = TEACHER_QUESTIONS.length;
const TAP_COUNT = TEACHER_QUESTIONS.filter((q) => q.type === "choice").length;

type Answer = { question_id: string; answer_text?: string; answer_choice?: string };

function browserLang(): string {
  if (typeof navigator !== "undefined" && navigator.language) return navigator.language.slice(0, 2);
  return "en";
}

function fieldStyle(t: Theme) {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${t.cardBorder}`,
    background: t.inputBg,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    lineHeight: 1.6,
    color: t.text,
    outline: "none",
    resize: "none",
  } as const;
}

// ─── Survey flow ─────────────────────────────────────────────
function SurveyFlow({ t, profile, onDone }: { t: Theme; profile: "teacher" | "student"; onDone: (responseId: string | null) => void }) {
  const questions = profile === "teacher" ? TEACHER_QUESTIONS : STUDENT_QUESTIONS;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [text, setText] = useState("");
  /** "Something else" picked on a choice question — the box is open, waiting to
   *  be told what. Reset on every move so it never leaks into the next screen. */
  const [otherOpen, setOtherOpen] = useState(false);
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
    const next = a ? [...answers.filter((x) => x.question_id !== a.question_id), a] : answers;
    setAnswers(next);
    setText("");
    setOtherOpen(false);
    if (isLast) void finish(next);
    else setStep((s) => s + 1);
  }

  return (
    <div style={{ maxWidth: MEASURE.form, margin: "0 auto", padding: `8px ${GUTTER}px 32px` }}>
      <div style={{ background: t.cardBg, borderRadius: 22, padding: 28, boxShadow: t.cardShadow, border: `1px solid ${t.cardBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ flex: 1, height: 3, background: t.pillTrackBg, borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: t.orange, transition: "width 0.3s ease" }} />
          </div>
          <span style={{ fontSize: 13, color: t.mutedLight }}>{step + 1} / {total}</span>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: t.orange, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          {profile === "teacher" ? <IconTeacher size={14} /> : <IconStudent size={14} />}
          {profile === "teacher" ? "Teacher" : "Student"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: t.text }}>{q.question}</div>

        {q.type === "choice" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options!.map((opt) => (
              <button
                key={opt}
                onClick={() => answer({ question_id: q.id, answer_choice: opt })}
                disabled={submitting}
                style={{ border: `1px solid ${t.cardBorder}`, background: t.inputBg, borderRadius: 12, padding: "12px 16px", fontSize: 14, textAlign: "left", color: t.text, cursor: submitting ? "default" : "pointer" }}
              >
                {opt}
              </button>
            ))}

            {/* The escape hatch. Closed it is one more option and costs the same
                single tap as the others; opened it asks for a few words, and
                only then does it become the one place in a choice question where
                the reader types. Both halves are stored: `answer_choice` stays
                OTHER so the option can be counted like any other, and the words
                land in `answer_text` beside it — so a category we failed to
                think of shows up as a count AND as its own sentences. */}
            {q.other &&
              (otherOpen ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Tell us what — a few words is enough."
                    style={{ ...fieldStyle(t), padding: "12px 16px", fontSize: 14 }}
                  />
                  <button
                    onClick={() =>
                      answer({
                        question_id: q.id,
                        answer_choice: OTHER,
                        ...(text.trim() ? { answer_text: text.trim() } : {}),
                      })
                    }
                    disabled={submitting}
                    style={{ alignSelf: "flex-start", background: t.orange, color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer" }}
                  >
                    {isLast ? "Finish" : "Continue →"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setOtherOpen(true)}
                  disabled={submitting}
                  style={{ border: `1px dashed ${t.cardBorder}`, background: "transparent", borderRadius: 12, padding: "12px 16px", fontSize: 14, textAlign: "left", color: t.muted, cursor: submitting ? "default" : "pointer" }}
                >
                  {OTHER}…
                </button>
              ))}
          </div>
        ) : (
          <div>
            <textarea placeholder={q.placeholder} rows={4} value={text} onChange={(e) => setText(e.target.value)} style={fieldStyle(t)} />
            <button
              onClick={() => answer(text.trim() ? { question_id: q.id, answer_text: text.trim() } : null)}
              disabled={submitting}
              style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, background: t.orange, color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer" }}
            >
              {submitting ? "Sending…" : isLast ? "Finish" : "Continue →"}
              {!submitting && isLast && <IconCheck size={14} />}
            </button>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        </div>
        {error && <p style={{ marginTop: 10, fontSize: 13, color: "#ef4444" }}>Couldn&apos;t submit — try again.</p>}
        <button onClick={() => answer(null)} disabled={submitting} style={{ marginTop: 14, background: "none", border: "none", fontSize: 13, color: t.mutedLight, cursor: "pointer" }}>
          Skip this question →
        </button>
      </div>
    </div>
  );
}

// ─── Done screen ─────────────────────────────────────────────
function DoneScreen({ t, responseId, onFreeWall }: { t: Theme; responseId: string | null; onFreeWall: () => void }) {
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
    <div style={{ maxWidth: MEASURE.form, margin: "0 auto", padding: `64px ${GUTTER}px`, textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, color: t.orange }}>
        <IconHeart size={44} filled />
      </div>
      <h2 style={{ fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif", fontWeight: 900, fontSize: "1.9rem", letterSpacing: "-0.02em", margin: "0 0 12px", color: t.text }}>Thank you.</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: t.text, marginBottom: 24 }}>
        Your answers feed straight into <RayaName />&apos;s development. Leave your email if you want early access when the beta is ready.
      </p>

      {responseId && !saved && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" style={{ width: 220, border: `1px solid ${t.cardBorder}`, background: t.inputBg, borderRadius: 8, padding: "10px 14px", fontSize: 14, color: t.text, outline: "none" }} />
          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
          <button onClick={saveEmail} style={{ background: t.ctaBg, color: t.ctaText, border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Early access
          </button>
        </div>
      )}
      {saved && (
        <p style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 14, fontWeight: 600, color: t.greenText }}>
          <IconCheck size={13} /> Noted — see you soon!
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button onClick={onFreeWall} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.orange, color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          <IconPencil size={15} />
          Share freely
        </button>
        <Link href="/" style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "10px 28px", fontSize: 15, color: t.link, textDecoration: "none" }}>
          Back home
        </Link>
      </div>
    </div>
  );
}

// ─── Free wall ───────────────────────────────────────────────
const PROFILE_LABEL: Record<string, string> = { teacher: "Teacher", student: "Student", anonymous: "Anonymous" };
const PROFILE_ICON: Record<string, IconEl> = { teacher: IconTeacher, student: IconStudent, anonymous: IconUser };

function FreeWall({ t, initialPosts }: { t: Theme; initialPosts: WallPost[] }) {
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

  async function react(id: string, kind: "resonates" | "important") {
    const key = `${id}:${kind}`;
    if (reacted.has(key)) return;
    setReacted((s) => new Set(s).add(key));
    setPosts((p) => p.map((post) => (post.id === id ? { ...post, [kind]: post[kind] + 1 } : post)));
    await fetch("/api/content/wall/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: id, type: kind }),
    });
  }

  return (
    <div style={{ maxWidth: MEASURE.form, margin: "0 auto", padding: `8px ${GUTTER}px 32px` }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif", fontWeight: 900, fontSize: "clamp(1.3rem,3vw,1.8rem)", letterSpacing: "-0.02em", margin: "0 0 8px", color: t.text }}>Tell us what you think.</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: t.text, margin: 0 }}>
          No questions, no form. Just a space to express yourself freely. What you write here feeds straight into the product.
        </p>
      </div>

      <div style={{ marginBottom: 24, borderRadius: 18, border: `1px solid ${t.cardBorder}`, background: t.cardBg, padding: 16, boxShadow: t.cardShadow }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {(["student", "teacher", "anonymous"] as const).map((k) => {
            const on = profile === k;
            const Icon = PROFILE_ICON[k];
            return (
              <button
                key={k}
                onClick={() => setProfile(k)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${on ? t.orange : t.cardBorder}`, background: on ? t.orangeBg : "transparent", color: on ? t.orangeText : t.muted, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                <Icon size={13} /> {PROFILE_LABEL[k]}
              </button>
            );
          })}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What I really miss in today's education tools is…" rows={3} style={{ ...fieldStyle(t), background: t.inputFieldBg, border: "none", marginBottom: 10 }} />
        <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          {error && <span style={{ fontSize: 13, color: "#ef4444" }}>Couldn&apos;t post — try again.</span>}
          <button
            onClick={submit}
            disabled={!text.trim() || busy}
            style={{ background: text.trim() && !busy ? t.orange : t.inputFieldBg, color: text.trim() && !busy ? "white" : t.muted, border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: text.trim() && !busy ? "pointer" : "default" }}
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {posts.map((post) => {
          const p = post.profile ?? "anonymous";
          const Icon = PROFILE_ICON[p] ?? IconUser;
          return (
            <div key={post.id} style={{ borderRadius: 18, border: `1px solid ${post.isNew ? t.orangeBorder : t.cardBorder}`, background: post.isNew ? t.orangeBg : t.cardBg, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: t.muted }}>
                <Icon size={15} />
                <span style={{ fontSize: 13, fontWeight: 600, color: t.muted }}>{PROFILE_LABEL[p] ?? "Anonymous"}</span>
              </div>
              <p style={{ fontFamily: "var(--font-instrument-serif),'Instrument Serif',serif", fontStyle: "italic", fontSize: 15, lineHeight: 1.6, color: t.text, margin: "0 0 14px" }}>&ldquo;{post.content}&rdquo;</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {(["resonates", "important"] as const).map((kind) => {
                  const on = reacted.has(`${post.id}:${kind}`);
                  return (
                    <button
                      key={kind}
                      onClick={() => react(post.id, kind)}
                      style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${on ? t.orange : t.cardBorder}`, background: "transparent", color: on ? t.orangeText : t.muted, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
                    >
                      {kind === "resonates" ? (
                        <>
                          <IconHeart size={13} filled={on} /> Resonates — {post.resonates}
                        </>
                      ) : (
                        <>
                          <IconFlame size={13} filled={on} /> Important — {post.important}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
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

  return (
    <SitePage active="Survey" section="Survey" signedIn={signedIn}>
      {(t) => (
        <div style={{ position: "relative", zIndex: 1, paddingTop: pageTop, paddingBottom: GUTTER }}>
          {/* Survey / Free wall switch */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
            {([["landing", "Survey"], ["free", "Free wall"]] as const).map(([k, l]) => {
              const activeGroup = k === "landing" ? view !== "free" : view === "free";
              return (
                <button
                  key={k}
                  onClick={() => setView(k)}
                  style={{ borderRadius: 999, border: `1px solid ${activeGroup ? t.orange : "transparent"}`, background: activeGroup ? t.orangeBg : "transparent", color: activeGroup ? t.orangeText : t.muted, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
                >
                  {l}
                </button>
              );
            })}
          </div>

          {view === "landing" && (
            <div style={{ maxWidth: MEASURE.form, margin: "0 auto", padding: `0 ${GUTTER}px 40px`, textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.orangeBg, border: `1px solid ${t.orangeBorder}`, borderRadius: 999, padding: "6px 16px", marginBottom: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.orange }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: t.orangeText }}>R&amp;D · 5 minutes · Anonymous</span>
              </div>

              <h1 style={{ ...pageH1(t), lineHeight: 1.2, margin: "0 0 14px" }}>
                Do you teach or do you learn?
                <br />
                <em style={{ ...serifEm, color: t.orange }}>Tell us what&apos;s really getting in the way.</em>
              </h1>
              <p style={{ margin: "0 auto 32px", fontSize: 15, color: t.text, lineHeight: 1.7 }}>
                {QUESTION_COUNT} questions, {TAP_COUNT} of them a single tap. No account needed. Your answers feed
                directly into <RayaName />&apos;s development.
              </p>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
                <button onClick={() => setView("survey-teacher")} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.ctaBg, color: t.ctaText, border: "none", borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  <IconTeacher size={16} /> I&apos;m a teacher
                </button>
                <button onClick={() => setView("survey-student")} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.orange, color: "white", border: "none", borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  <IconStudent size={16} /> I&apos;m a student
                </button>
              </div>

              <button onClick={() => setView("free")} style={{ background: "none", border: "none", fontSize: 14, color: t.link, textDecoration: "underline", cursor: "pointer", marginBottom: 32 }}>
                Or share freely →
              </button>

              {(stats.responses > 0 || stats.posts > 0) && (
                <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
                  {[
                    { v: String(stats.responses), l: "responses collected" },
                    { v: String(stats.posts), l: "stories shared" },
                  ].map((s) => (
                    <div key={s.l}>
                      <div style={{ fontSize: 25, fontWeight: 800, color: t.orange }}>{s.v}</div>
                      <div style={{ fontSize: 13, color: t.mutedLight }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "survey-teacher" && <SurveyFlow t={t} profile="teacher" onDone={(id) => { setResponseId(id); setView("done"); }} />}
          {view === "survey-student" && <SurveyFlow t={t} profile="student" onDone={(id) => { setResponseId(id); setView("done"); }} />}
          {view === "done" && <DoneScreen t={t} responseId={responseId} onFreeWall={() => setView("free")} />}
          {view === "free" && <FreeWall t={t} initialPosts={initialPosts} />}
        </div>
      )}
    </SitePage>
  );
}
