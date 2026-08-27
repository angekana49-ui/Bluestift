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
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

type IconEl = ComponentType<{ size?: number; filled?: boolean }>;

/**
 * `value` is what actually lands in `answer_choice` — a stable English string,
 * unrelated to the UI language, so responses stay comparable across locales
 * (see content.survey_answers). `labelKey` is only what's displayed.
 */
type Option = { value: string; labelKey: MessageKey };

type Question = {
  id: string;
  questionKey: MessageKey;
  type: "choice" | "text";
  options?: Option[];
  placeholderKey?: MessageKey;
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

/** The value stored in `answer_choice` when the "Something else" escape hatch
 *  is taken — the specifics land in `answer_text` beside it. Stable English,
 *  like every other option value; only its displayed label (survey.other) is
 *  translated. */
const OTHER = "Something else";

const LEVEL_OPTIONS: Option[] = [
  { value: "Primary", labelKey: "survey.level.primary" },
  { value: "Secondary — early years", labelKey: "survey.level.secondaryEarly" },
  { value: "Secondary — exam years", labelKey: "survey.level.secondaryExam" },
  { value: "Higher education", labelKey: "survey.level.higher" },
];

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
const TEACHER_QUESTIONS: Question[] = [
  // Vocational, special education and homeschooling all fall outside these four
  // and are exactly the teachers worth hearing from, so this one has a way out.
  { id: "t1_level", questionKey: "survey.t1.q", type: "choice", options: LEVEL_OPTIONS, other: true },
  {
    id: "t2",
    questionKey: "survey.t2.q",
    type: "choice",
    options: [
      { value: "Fewer than 20", labelKey: "survey.t2.o1" },
      { value: "20–35", labelKey: "survey.t2.o2" },
      { value: "35–50", labelKey: "survey.t2.o3" },
      { value: "More than 50", labelKey: "survey.t2.o4" },
    ],
  },
  // The visibility question, made concrete. "Do you know who is stuck?" invites
  // a comfortable "partially"; naming three students and their topics is a test
  // you either pass or fail, and the reader knows which before they answer.
  {
    id: "t4_name3",
    questionKey: "survey.t4.q",
    type: "choice",
    options: [
      { value: "Yes — names and topics", labelKey: "survey.t4.o1" },
      { value: "The names, not the topics", labelKey: "survey.t4.o2" },
      { value: "I'd have to check my records", labelKey: "survey.t4.o3" },
      { value: "Honestly, no", labelKey: "survey.t4.o4" },
    ],
  },
  // How late the news arrives. Every option is a real channel, and the last one
  // is the one nobody volunteers unprompted.
  {
    id: "t7_findout",
    questionKey: "survey.t7.q",
    type: "choice",
    options: [
      { value: "The test, afterwards", labelKey: "survey.t7.o1" },
      { value: "They ask me", labelKey: "survey.t7.o2" },
      { value: "A parent, or the next teacher", labelKey: "survey.t7.o3" },
      { value: "Often I don't", labelKey: "survey.t7.o4" },
    ],
    other: true,
  },
  // The entry argument, put as a question instead of asserted. If this comes
  // back "no change", the thesis the whole product rests on is wrong — which is
  // the only reason worth running a survey at all.
  {
    id: "t5_signal",
    questionKey: "survey.t5.q",
    type: "choice",
    options: [
      { value: "Much less", labelKey: "survey.t5.o1" },
      { value: "A little less", labelKey: "survey.t5.o2" },
      { value: "No change", labelKey: "survey.t5.o3" },
      { value: "More", labelKey: "survey.t5.o4" },
    ],
  },
  { id: "t8_nohelp", questionKey: "survey.t8.q", type: "text", placeholderKey: "survey.t8.placeholder" },
];

const STUDENT_QUESTIONS: Question[] = [
  { id: "s1_level", questionKey: "survey.s1.q", type: "choice", options: LEVEL_OPTIONS, other: true },
  // "Ask ChatGPT" named one product, which dates the question and quietly steers
  // it: a reader who uses Gemini reads their own habit as absent from the list
  // and picks something else. The examples stay, because recognition is what
  // makes the option land — they just no longer decide what counts as an AI.
  {
    id: "s2",
    questionKey: "survey.s2.q",
    type: "choice",
    options: [
      { value: "Ask a friend", labelKey: "survey.s2.o1" },
      { value: "Search YouTube / Google", labelKey: "survey.s2.o2" },
      { value: "Ask an AI (ChatGPT, Gemini, Copilot…)", labelKey: "survey.s2.o3" },
      { value: "Give up", labelKey: "survey.s2.o4" },
    ],
    other: true,
  },
  {
    id: "s4",
    questionKey: "survey.s4.q",
    type: "choice",
    options: [
      { value: "Yes, often", labelKey: "survey.s4.o1" },
      { value: "Yes, sometimes", labelKey: "survey.s4.o2" },
      { value: "I tried but stopped", labelKey: "survey.s4.o3" },
      { value: "Never", labelKey: "survey.s4.o4" },
    ],
  },
  // The uncomfortable one, and the fourth option is the point: it is the honest
  // answer a good student gives, and no free-text box would ever have got it.
  {
    id: "s7_passed",
    questionKey: "survey.s7.q",
    type: "choice",
    options: [
      { value: "Often", labelKey: "survey.s7.o1" },
      { value: "Once or twice", labelKey: "survey.s7.o2" },
      { value: "Never", labelKey: "survey.s7.o3" },
      { value: "Yes — and I made sure they thought so", labelKey: "survey.s7.o4" },
    ],
  },
  // Tests the premise the privacy guardrail rests on — that a student stops
  // admitting confusion to anyone who might report it — rather than assuming it.
  {
    id: "s5_tells",
    questionKey: "survey.s5.q",
    type: "choice",
    options: [
      { value: "My teacher", labelKey: "survey.s5.o1" },
      { value: "A friend", labelKey: "survey.s5.o2" },
      { value: "An AI", labelKey: "survey.s5.o3" },
      { value: "Nobody", labelKey: "survey.s5.o4" },
    ],
    other: true,
  },
  { id: "s6_wish", questionKey: "survey.s6.q", type: "text", placeholderKey: "survey.s6.placeholder" },
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
  const tr = useTranslate();
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
          {profile === "teacher" ? tr("survey.badge.teacher") : tr("survey.badge.student")}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: t.text }}>{tr(q.questionKey)}</div>

        {q.type === "choice" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options!.map((opt) => (
              <button
                key={opt.value}
                onClick={() => answer({ question_id: q.id, answer_choice: opt.value })}
                disabled={submitting}
                style={{ border: `1px solid ${t.cardBorder}`, background: t.inputBg, borderRadius: 12, padding: "12px 16px", fontSize: 14, textAlign: "left", color: t.text, cursor: submitting ? "default" : "pointer" }}
              >
                {tr(opt.labelKey)}
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
                    placeholder={tr("survey.other.inputPlaceholder")}
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
                    {isLast ? tr("survey.finish") : tr("onb.continueArrow")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setOtherOpen(true)}
                  disabled={submitting}
                  style={{ border: `1px dashed ${t.cardBorder}`, background: "transparent", borderRadius: 12, padding: "12px 16px", fontSize: 14, textAlign: "left", color: t.muted, cursor: submitting ? "default" : "pointer" }}
                >
                  {tr("survey.other")}…
                </button>
              ))}
          </div>
        ) : (
          <div>
            <textarea placeholder={q.placeholderKey ? tr(q.placeholderKey) : undefined} rows={4} value={text} onChange={(e) => setText(e.target.value)} style={fieldStyle(t)} />
            <button
              onClick={() => answer(text.trim() ? { question_id: q.id, answer_text: text.trim() } : null)}
              disabled={submitting}
              style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, background: t.orange, color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer" }}
            >
              {submitting ? tr("feedback.form.sending") : isLast ? tr("survey.finish") : tr("onb.continueArrow")}
              {!submitting && isLast && <IconCheck size={14} />}
            </button>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        </div>
        {error && <p style={{ marginTop: 10, fontSize: 13, color: "#ef4444" }}>{tr("survey.submitError")}</p>}
        <button onClick={() => answer(null)} disabled={submitting} style={{ marginTop: 14, background: "none", border: "none", fontSize: 13, color: t.mutedLight, cursor: "pointer" }}>
          {tr("survey.skip")}
        </button>
      </div>
    </div>
  );
}

// ─── Done screen ─────────────────────────────────────────────
function DoneScreen({ t, responseId, onFreeWall }: { t: Theme; responseId: string | null; onFreeWall: () => void }) {
  const tr = useTranslate();
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
      <h2 style={{ fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif", fontWeight: 900, fontSize: "1.9rem", letterSpacing: "-0.02em", margin: "0 0 12px", color: t.text }}>{tr("survey.done.title")}</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: t.text, marginBottom: 24 }}>
        {tr("survey.done.body.a")} <RayaName />&apos;s development. {tr("survey.done.body.b")}
      </p>

      {responseId && !saved && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr("auth.login.emailPlaceholder")} type="email" style={{ width: 220, border: `1px solid ${t.cardBorder}`, background: t.inputBg, borderRadius: 8, padding: "10px 14px", fontSize: 14, color: t.text, outline: "none" }} />
          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
          <button onClick={saveEmail} style={{ background: t.ctaBg, color: t.ctaText, border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {tr("survey.done.earlyAccess")}
          </button>
        </div>
      )}
      {saved && (
        <p style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 14, fontWeight: 600, color: t.greenText }}>
          <IconCheck size={13} /> {tr("survey.done.saved")}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button onClick={onFreeWall} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.orange, color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          <IconPencil size={15} />
          {tr("survey.done.shareFreely")}
        </button>
        <Link href="/" style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "10px 28px", fontSize: 15, color: t.link, textDecoration: "none" }}>
          {tr("survey.done.backHome")}
        </Link>
      </div>
    </div>
  );
}

// ─── Free wall ───────────────────────────────────────────────
const PROFILE_LABEL_KEY: Record<string, MessageKey> = {
  teacher: "survey.badge.teacher",
  student: "survey.badge.student",
  anonymous: "survey.wall.profile.anonymous",
};
const PROFILE_ICON: Record<string, IconEl> = { teacher: IconTeacher, student: IconStudent, anonymous: IconUser };

function FreeWall({ t, initialPosts }: { t: Theme; initialPosts: WallPost[] }) {
  const tr = useTranslate();
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
        <h2 style={{ fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif", fontWeight: 900, fontSize: "clamp(1.3rem,3vw,1.8rem)", letterSpacing: "-0.02em", margin: "0 0 8px", color: t.text }}>{tr("survey.wall.title")}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: t.text, margin: 0 }}>
          {tr("survey.wall.sub")}
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
                <Icon size={13} /> {tr(PROFILE_LABEL_KEY[k])}
              </button>
            );
          })}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("survey.wall.placeholder")} rows={3} style={{ ...fieldStyle(t), background: t.inputFieldBg, border: "none", marginBottom: 10 }} />
        <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          {error && <span style={{ fontSize: 13, color: "#ef4444" }}>{tr("survey.wall.postError")}</span>}
          <button
            onClick={submit}
            disabled={!text.trim() || busy}
            style={{ background: text.trim() && !busy ? t.orange : t.inputFieldBg, color: text.trim() && !busy ? "white" : t.muted, border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: text.trim() && !busy ? "pointer" : "default" }}
          >
            {busy ? tr("survey.wall.posting") : tr("survey.wall.post")}
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
                <span style={{ fontSize: 13, fontWeight: 600, color: t.muted }}>{tr(PROFILE_LABEL_KEY[p] ?? "survey.wall.profile.anonymous")}</span>
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
                          <IconHeart size={13} filled={on} /> {tr("survey.wall.resonates")} — {post.resonates}
                        </>
                      ) : (
                        <>
                          <IconFlame size={13} filled={on} /> {tr("survey.wall.important")} — {post.important}
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
  const tr = useTranslate();
  const [view, setView] = useState<"landing" | "survey-teacher" | "survey-student" | "done" | "free">("landing");
  const [responseId, setResponseId] = useState<string | null>(null);

  return (
    <SitePage active="Survey" section="Survey" signedIn={signedIn}>
      {(t) => (
        <div style={{ position: "relative", zIndex: 1, paddingTop: pageTop, paddingBottom: GUTTER }}>
          {/* Survey / Free wall switch */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
            {([["landing", tr("site.nav.survey")], ["free", tr("survey.tab.freeWall")]] as const).map(([k, l]) => {
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
                <span style={{ fontSize: 13, fontWeight: 600, color: t.orangeText }}>{tr("survey.badge.rd")}</span>
              </div>

              <h1 style={{ ...pageH1(t), lineHeight: 1.2, margin: "0 0 14px" }}>
                {tr("survey.hero.title")}
                <br />
                <em style={{ ...serifEm, color: t.orange }}>{tr("survey.hero.em")}</em>
              </h1>
              <p style={{ margin: "0 auto 32px", fontSize: 15, color: t.text, lineHeight: 1.7 }}>
                {QUESTION_COUNT} {tr("survey.hero.sub.p1")} {TAP_COUNT} {tr("survey.hero.sub.p2")} {tr("survey.hero.sub.p3")}{" "}
                <RayaName />&apos;s development.
              </p>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
                <button onClick={() => setView("survey-teacher")} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.ctaBg, color: t.ctaText, border: "none", borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  <IconTeacher size={16} /> {tr("survey.cta.teacher")}
                </button>
                <button onClick={() => setView("survey-student")} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.orange, color: "white", border: "none", borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  <IconStudent size={16} /> {tr("survey.cta.student")}
                </button>
              </div>

              <button onClick={() => setView("free")} style={{ background: "none", border: "none", fontSize: 14, color: t.link, textDecoration: "underline", cursor: "pointer", marginBottom: 32 }}>
                {tr("survey.cta.shareFreely")}
              </button>

              {(stats.responses > 0 || stats.posts > 0) && (
                <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
                  {[
                    { v: String(stats.responses), l: tr("survey.stats.responses") },
                    { v: String(stats.posts), l: tr("survey.stats.stories") },
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
