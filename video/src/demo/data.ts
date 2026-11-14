import type { Msg } from "@/components/chat/types";
import type { GroupMsg } from "@/components/rooms/room-group-chat";
import type { ConceptStateOut, KCStatus, PrerequisiteGapsResponse } from "@/lib/kernel/types";
import type { MemorizedConversation } from "@/components/kernel-memory";
import type { LearningGraph, RosterStudent, StudentDetail } from "@/lib/school-admin";

/**
 * The demo family and everything they touch — "Bluestift Demo High",
 * Sofia Martinez and co., as the brief's Phase 0 seeds them.
 *
 * All content English, all numbers consistent across screens (Sofia's
 * algebra gap is 22% everywhere: chat, insights, roster, graph).
 */

export const SOFIA = { id: "u-sofia", name: "Sofia Martinez", first: "Sofia", initials: "SM" };
export const RAYA_ID = "raya";
export const CLASSMATES = [
  { id: "u-aarav", name: "Aarav Patel", initials: "AP" },
  { id: "u-lena", name: "Lena Fischer", initials: "LF" },
  { id: "u-yuki", name: "Yuki Tanaka", initials: "YT" },
];
export const TEACHER = { id: "u-rivera", name: "Ms. Rivera", first: "Ms. Rivera", initials: "MR" };

const T0 = "2026-10-30T21:14:00.000Z";
const at = (sec: number) => new Date(new Date(T0).getTime() + sec * 1000).toISOString();

/* ── Raya solo chat (cues 5 + 9) ── */

export interface ChatBeat {
  at: number;
  mine: string | null;
  raya: string | null;
}

/** Message bodies only — timing comes from the narration at render. */
export const RAYA_THREAD: { mine: string; raya: string }[] = [
  {
    mine: "I'm stuck on this velocity-time graph — what does the slope actually tell me?",
    raya: "Good question to ask! Before I explain anything — what would **you** try first?",
  },
  {
    mine: "Find... the slope of the line?",
    raya: "Exactly the right instinct — the slope is the key. On a velocity-time graph the slope has a special meaning. Any guess?",
  },
  {
    mine: "Acceleration?? But I don't know how to compute it",
    raya: "Yes — slope = acceleration. Pick two points on the line and divide: $a = \\frac{\\Delta v}{\\Delta t}$. Try the points at $t = 0$ and $t = 2$.",
  },
];

export const RAYA_SOLVED: { mine: string; raya: string } = {
  mine: "a = (4 − 0) / (2 − 0) = 2 m/s². IT CLICKS!!",
  raya: "That's it — nicely done! Want to lock it in? I put a quiz and flashcards in Tools Studio for you.",
};

export function chatMessages(pairs: { mine: string; raya: string }[], partialRaya: string | null): Msg[] {
  const out: Msg[] = [];
  pairs.forEach((p, i) => {
    out.push({ id: `m${i}`, role: "user", content: p.mine });
    out.push({ id: `r${i}`, role: "assistant", content: p.raya });
  });
  if (partialRaya != null) {
    out.push({ id: "r-stream", role: "assistant", content: partialRaya });
  }
  return out;
}

/* ── Study Room (cues 6 + 15) ── */

export const ROOM_MESSAGES: GroupMsg[] = [
  { id: "g1", user_id: SOFIA.id, role: "member", content: "Anyone else stuck on the velocity-time graph?", created_at: at(0) },
  { id: "g2", user_id: "u-aarav", role: "member", content: "me — wait, is slope really acceleration?", created_at: at(14) },
  {
    id: "g3",
    user_id: RAYA_ID,
    role: "assistant",
    content: "Yes! And if the line curves, the slope — and the acceleration — changes along the way.",
    created_at: at(26),
  },
  { id: "g4", user_id: "u-lena", role: "member", content: "physics-chapter-5.pdf", created_at: at(40), has_media: true },
  { id: "g5", user_id: "u-lena", role: "member", content: "I put my chapter 5 notes in files, they helped me a lot", created_at: at(48) },
  { id: "g6", user_id: SOFIA.id, role: "member", content: "ooh the curve thing makes sense now, thanks!", created_at: at(60) },
];

export const ROOM_TEACHER_JOIN: GroupMsg = {
  id: "g7",
  user_id: TEACHER.id,
  role: "member",
  content: "Evening all — I'm here if you get stuck. Keep going, you're close.",
  created_at: at(80),
};

export const ROOM_NAME = "Physics 11-B · Evening session";
export const ROOM_SUBJECT = "Physics";

/* ── My Kernel insights (cues 7 + 8) ── */

export const KERNEL_CONCEPTS: ConceptStateOut[] = [
  { concept_id: "slope-line", label: "Slope of a line", k_raw: 0.2, k_effective: 0.22, v_score: 0.31, p_score: 0.18, status: "gap", last_interaction_at: T0 },
  { concept_id: "vt-graphs", label: "Velocity-time graphs", k_raw: 0.61, k_effective: 0.64, v_score: 0.7, p_score: 0.58, status: "partial", last_interaction_at: T0 },
  { concept_id: "acceleration", label: "Acceleration", k_raw: 0.68, k_effective: 0.71, v_score: 0.74, p_score: 0.66, status: "partial", last_interaction_at: T0 },
  { concept_id: "data-tables", label: "Reading data tables", k_raw: 0.8, k_effective: 0.83, v_score: 0.85, p_score: 0.79, status: "mastered", last_interaction_at: T0 },
  { concept_id: "units", label: "Unit conversion", k_raw: 0.9, k_effective: 0.91, v_score: 0.93, p_score: 0.88, status: "mastered", last_interaction_at: T0 },
];

export const KERNEL_GAUGE = 0.64;

export const SOFIA_MINDSET = { m_score: 0.32, detected_mindset: "fixed" };
export const KERNEL_UPDATED = "2026-10-30T21:14:00.000Z";

export const SOFIA_PROGRESS = [
  { t: "2026-10-21T18:00:00.000Z", score: 0.34 },
  { t: "2026-10-22T18:00:00.000Z", score: 0.38 },
  { t: "2026-10-23T18:00:00.000Z", score: 0.41 },
  { t: "2026-10-24T18:00:00.000Z", score: 0.39 },
  { t: "2026-10-25T18:00:00.000Z", score: 0.47 },
  { t: "2026-10-26T18:00:00.000Z", score: 0.52 },
  { t: "2026-10-27T18:00:00.000Z", score: 0.55 },
  { t: "2026-10-28T18:00:00.000Z", score: 0.58 },
  { t: "2026-10-29T18:00:00.000Z", score: 0.62 },
  { t: "2026-10-30T18:00:00.000Z", score: 0.66 },
];

export const WHY_STUCK: PrerequisiteGapsResponse = {
  target: "Velocity-time graphs",
  gaps: [
    { label: "Slope of a line", concept_id: "slope-line", hops: 2, k_effective: 0.22, status: "gap" as KCStatus },
    { label: "Δ notation (change over change)", concept_id: "delta-notation", hops: 1, k_effective: 0.35, status: "gap" as KCStatus },
  ],
  frontier: [
    { label: "Plotting points", hops: 1 },
    { label: "Reading axes", hops: 1 },
  ],
  max_hops: 3,
  truncated: false,
  resources_available: true,
};

export const KERNEL_MEMORY: MemorizedConversation[] = [
  { id: "c1", title: "Velocity-time graphs — slope practice", memorized_at: T0 },
  { id: "c2", title: "Acceleration word problems", memorized_at: T0 },
];

/* ── Tools Studio (cue 10) ── */

export interface DemoUpload {
  id: string;
  title: string | null;
  url: string | null;
  type: string | null;
  created_at: string;
}
export interface DemoOutput {
  id: string;
  tool_type: string;
  status: string;
  output_content: unknown;
  created_at: string;
  archived_at?: string | null;
}

export const STUDIO_UPLOADS: DemoUpload[] = [
  { id: "u1", title: "physics-chapter-5.pdf", url: null, type: "pdf", created_at: T0 },
  { id: "u2", title: "Class notes Oct 28.txt", url: null, type: "text", created_at: T0 },
];

export const STUDIO_QUIZ: DemoOutput = {
  id: "o1",
  tool_type: "quiz",
  status: "done",
  output_content: { label: "Velocity-time graphs" },
  created_at: T0,
};
export const STUDIO_FLASHCARDS: DemoOutput = {
  id: "o2",
  tool_type: "flashcards",
  status: "done",
  output_content: { label: "Velocity-time graphs" },
  created_at: T0,
};

/* ── Teacher views (cues 12–14) ── */

export const CLASS_NAME = "Physics 11-B";
export const CLASS_ID = "class-phys-11b";

export const ROSTER: RosterStudent[] = [
  { userId: SOFIA.id, firstName: "Sofia", lastName: "Martinez", riskLevel: "high", statusLabel: "Leaning on answers", sessionsLast7d: 6, lastActiveAt: T0, avgMastery: 0.41, mindsetScore: 0.32, homeworkDone: 3, homeworkMissing: 2, homeworkAvg: 0.44 },
  { userId: "u-aarav", firstName: "Aarav", lastName: "Patel", riskLevel: "medium", statusLabel: "Shaky on graphs", sessionsLast7d: 5, lastActiveAt: T0, avgMastery: 0.58, mindsetScore: 0.61, homeworkDone: 4, homeworkMissing: 1, homeworkAvg: 0.66 },
  { userId: "u-lena", firstName: "Lena", lastName: "Fischer", riskLevel: null, statusLabel: null, sessionsLast7d: 7, lastActiveAt: T0, avgMastery: 0.82, mindsetScore: 0.78, homeworkDone: 5, homeworkMissing: 0, homeworkAvg: 0.88 },
  { userId: "u-yuki", firstName: "Yuki", lastName: "Tanaka", riskLevel: null, statusLabel: null, sessionsLast7d: 4, lastActiveAt: T0, avgMastery: 0.76, mindsetScore: 0.7, homeworkDone: 5, homeworkMissing: 0, homeworkAvg: 0.81 },
  { userId: "u-omar", firstName: "Omar", lastName: "Haddad", riskLevel: "high", statusLabel: "Stuck 3 sessions", sessionsLast7d: 5, lastActiveAt: T0, avgMastery: 0.38, mindsetScore: 0.4, homeworkDone: 2, homeworkMissing: 3, homeworkAvg: 0.35 },
  { userId: "u-chloe", firstName: "Chloe", lastName: "Dubois", riskLevel: null, statusLabel: null, sessionsLast7d: 6, lastActiveAt: T0, avgMastery: 0.79, mindsetScore: 0.72, homeworkDone: 5, homeworkMissing: 0, homeworkAvg: 0.84 },
  { userId: "u-liam", firstName: "Liam", lastName: "Nguyen", riskLevel: "medium", statusLabel: "Skipping practice", sessionsLast7d: 2, lastActiveAt: T0, avgMastery: 0.55, mindsetScore: 0.5, homeworkDone: 3, homeworkMissing: 1, homeworkAvg: 0.58 },
  { userId: "u-mia", firstName: "Mia", lastName: "Rossi", riskLevel: null, statusLabel: null, sessionsLast7d: 5, lastActiveAt: T0, avgMastery: 0.85, mindsetScore: 0.83, homeworkDone: 5, homeworkMissing: 0, homeworkAvg: 0.9 },
];

export const TEACHER_CLASSES = [
  { id: CLASS_ID, name: CLASS_NAME, studentCount: 28 },
  { id: "class-phys-10a", name: "Physics 10-A", studentCount: 31 },
];

export const TEACHER_ALERTS = [
  { classId: CLASS_ID, userId: SOFIA.id, studentName: "Sofia Martinez", className: CLASS_NAME, message: "Low mastery (41%) — may be leaning on answers" },
  { classId: CLASS_ID, userId: "u-omar", studentName: "Omar Haddad", className: CLASS_NAME, message: "Stuck 3 sessions on forces" },
  { classId: "class-phys-10a", userId: "u-noah", studentName: "Noah Kim", className: "Physics 10-A", message: "No practice in 6 days" },
];

export const SOFIA_GRAPH: LearningGraph = {
  nodes: [
    { id: "slope", label: "Slope of a line", mastery: 0.22, depth: 0 },
    { id: "delta", label: "Δ notation", mastery: 0.35, depth: 0 },
    { id: "plot", label: "Plotting points", mastery: 0.88, depth: 0 },
    { id: "axes", label: "Reading axes", mastery: 0.85, depth: 0 },
    { id: "vt", label: "Velocity-time graphs", mastery: 0.64, depth: 1 },
    { id: "acc", label: "Acceleration", mastery: 0.71, depth: 1 },
    { id: "motion", label: "Equations of motion", mastery: 0.58, depth: 2 },
  ],
  edges: [
    { from: "slope", to: "vt" },
    { from: "delta", to: "vt" },
    { from: "plot", to: "vt" },
    { from: "axes", to: "vt" },
    { from: "vt", to: "acc" },
    { from: "slope", to: "acc" },
    { from: "acc", to: "motion" },
    { from: "vt", to: "motion" },
  ],
};

export const SOFIA_DETAIL: StudentDetail = {
  userId: SOFIA.id,
  firstName: "Sofia",
  lastName: "Martinez",
  riskLevel: "high",
  statusLabel: "Leaning on answers",
  sessionsLast7d: 6,
  lastActiveAt: T0,
  avgMastery: 0.41,
  mindsetScore: 0.32,
  detectedMindset: "fixed",
  kcs: [
    { label: "Slope of a line", mastery: 0.22 },
    { label: "Acceleration", mastery: 0.71 },
    { label: "Velocity-time graphs", mastery: 0.64 },
  ],
  graph: SOFIA_GRAPH,
  insight: "Sofia's physics block traces to one algebra gap: slope of a line (22%). Everything above it — velocity graphs, acceleration — is shaky for the same reason.",
  homework: [
    { id: "h1", title: "Velocity graphs worksheet", kind: "worksheet", assignedAt: T0, dueAt: T0, status: "done" as const, score: 0.45, completedAt: T0 },
    { id: "h2", title: "Acceleration problems", kind: "problems", assignedAt: T0, dueAt: null, status: "open" as const, score: null, completedAt: null },
  ],
  missed: [{ question: "Find the acceleration from this v–t graph", assignment: "Velocity graphs worksheet" }],
  hasKernelProfile: true,
  joinedAt: T0,
};

/* ── Instructions to Raya + team notes (cues 15–17) ── */

export interface DemoInstruction {
  id: string;
  content: string;
  subjectId: string | null;
  subjectName: string | null;
  isActive: boolean;
}

export const INSTRUCTIONS: DemoInstruction[] = [
  { id: "i1", content: "For Sofia: ask for her first idea before any hint. She leans on answers.", subjectId: null, subjectName: null, isActive: true },
];

export const INSTRUCTION_DRAFT = "This week: drill slope of a line with Sofia before touching physics again.";

export interface DemoFollowup {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export const FOLLOWUPS: DemoFollowup[] = [
  { id: "f1", content: "Sent Sofia the algebra catch-up set — quiz + flashcards.", authorName: "Ms. Rivera", createdAt: T0, updatedAt: T0 },
];

export const FOLLOWUP_DRAFT = "Sofia's physics block is really an algebra gap. Starting there tomorrow.";
