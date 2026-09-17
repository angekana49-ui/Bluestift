import type { CSSProperties, ReactNode } from "react";
import { Img } from "remotion";
import { RAYA_FONT } from "@/components/ui/brand";
import { FONTS } from "./brand";
import { MARKS } from "./generated/marks";
import { clamp01, mix } from "./motion";

/**
 * The three screens of the "people stay in control" passage, drawn for the
 * film because the site has no shot of them — each traced from the real one,
 * with its real words:
 *
 *  - LoginScreen        → app/login (`login.*`): the anonymous start
 *  - SettingsScreen     → the recovery key (components/onboarding-form.tsx,
 *                         `auth.recovery.*`) and Settings › Your data
 *                         (components/raya/settings-data-card.tsx), with the
 *                         consent banner (components/analytics/ConsentBanner.tsx)
 *  - SubprocessorsScreen → /legal/subprocessors (SubprocessorsView), the rows
 *                         that carry learning data
 *
 * Every moving part is a number the scene passes in, so the screens are
 * still pictures of one moment and the film decides which moment.
 */

const INK = { text: "#0b1220", muted: "#44546a", faint: "#64748b", border: "#dde5ee", field: "#f3f6fa", blue: "#3b6ef5", red: "#dc2626", page: "#f2f5fa" };
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const ui = (size: number, weight = 500, color: string = INK.text): CSSProperties => ({ fontFamily: FONTS.display, fontSize: size, fontWeight: weight, color, lineHeight: 1.35 });

function Button({ children, primary, pressed = 0, style }: { children: ReactNode; primary?: boolean; pressed?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        padding: "14px 22px",
        border: primary ? "none" : `1.5px solid ${INK.border}`,
        background: primary ? INK.text : "#ffffff",
        color: primary ? "#ffffff" : INK.text,
        fontFamily: FONTS.display,
        fontWeight: 650,
        fontSize: 22,
        transform: `scale(${1 - 0.04 * Math.sin(clamp01(pressed) * Math.PI)})`,
        filter: pressed > 0 && pressed < 1 ? `brightness(${1 - 0.12 * Math.sin(pressed * Math.PI)})` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Switch({ on }: { on: number }) {
  const k = clamp01(on);
  return (
    <div style={{ position: "relative", flex: "none", width: 64, height: 38, borderRadius: 99, background: `rgba(59,110,245,${k})`, border: `1.5px solid ${k > 0.5 ? INK.blue : INK.border}` }}>
      <div style={{ position: "absolute", top: 3.5, left: mix(3.5, 28.5, k), width: 29, height: 29, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }} />
    </div>
  );
}

/** A marker-pen sweep behind words the voice is saying. */
function Mark({ p, children, color = "rgba(59,110,245,0.18)" }: { p: number; children: ReactNode; color?: string }) {
  return (
    <span style={{ backgroundImage: `linear-gradient(${color}, ${color})`, backgroundRepeat: "no-repeat", backgroundSize: `${(clamp01(p) * 100).toFixed(1)}% 100%`, borderRadius: 4, padding: "0 2px" }}>
      {children}
    </span>
  );
}

/* ───────────────────────────── the anonymous start ───────────────────────────── */

export const LOGIN = { w: 1200, h: 720, anon: { x: 600, y: 590 } };

export function LoginScreen({ pressed }: { pressed: number }) {
  return (
    <div style={{ width: LOGIN.w, height: LOGIN.h, background: "linear-gradient(160deg,#eef4fd,#dfeafb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 620, background: "#fff", borderRadius: 26, border: "1px solid rgba(15,23,42,0.07)", boxShadow: "0 20px 50px rgba(15,23,42,0.1)", padding: "38px 44px" }}>
        <div style={{ ...ui(38, 700), letterSpacing: "-0.02em" }}>
          Sign in to <span style={{ fontFamily: RAYA_FONT }}>Raya</span>
        </div>
        <div style={{ ...ui(19, 450, INK.muted), marginTop: 8 }}>A password, an email link, a recovery key — or no account at all. One account covers everything.</div>
        <div style={{ ...ui(17, 600, INK.muted), marginTop: 26 }}>Email</div>
        <div style={{ marginTop: 8, height: 56, borderRadius: 14, background: INK.field, border: `1.5px solid ${INK.border}` }} />
        <Button style={{ width: "100%", marginTop: 14, boxSizing: "border-box", opacity: 0.55 }}>Sign in</Button>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "22px 0 16px" }}>
          <div style={{ flex: 1, height: 1, background: INK.border }} />
          <span style={ui(16, 600, INK.faint)}>New here</span>
          <div style={{ flex: 1, height: 1, background: INK.border }} />
        </div>
        <Button primary pressed={pressed} style={{ width: "100%", boxSizing: "border-box" }}>
          Start anonymously — no email needed
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────────── settings: key and data ───────────────────────────── */

export const SETTINGS = {
  w: 1700,
  h: 940,
  key: { x: 426, y: 300 },
  generate: { x: 250, y: 470 },
  banner: { x: 285, y: 790 },
  download: { x: 1240, y: 305 },
  analytics: { x: 1240, y: 410 },
  training: { x: 1240, y: 530 },
  minor: { x: 1240, y: 470 },
  remove: { x: 1240, y: 740 },
  data: { x: 1240, y: 500 },
};

export type SettingsState = {
  /** Characters of the key shown, 0 → 1. */
  keyShown: number;
  /** 0 the first key, 1 the replacement; scrambles in between. */
  keySwap: number;
  generatePressed: number;
  banner: number;
  markNoAds: number;
  markNeverSell: number;
  acceptPressed: number;
  analyticsOn: number;
  /** 0 an adult's rows, 1 an under-18's. */
  minor: number;
  markMinor: number;
  trainingOn: number;
  downloadPressed: number;
  fileChip: number;
  deleteTyped: number;
};

const KEY_A = "8QF2-KD7M-XR4P-3JHW";
const KEY_B = "T6NB-2WQH-9LCE-5RMA";
const KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function keyText(shown: number, swap: number) {
  const n = Math.round(KEY_A.length * clamp01(shown));
  if (swap <= 0) return KEY_A.slice(0, n);
  if (swap >= 1) return KEY_B;
  return KEY_A.split("")
    .map((c, i) => {
      if (c === "-") return c;
      const settle = (i + 1) / KEY_A.length;
      if (swap > settle) return KEY_B[i];
      return KEY_CHARS[Math.floor((swap * 97 + i * 13) * 7) % KEY_CHARS.length];
    })
    .join("");
}

export function SettingsScreen(s: SettingsState) {
  const row: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, padding: "20px 0", borderTop: `1px solid ${INK.border}` };
  const card: CSSProperties = { position: "absolute", background: "#fff", border: "1px solid rgba(15,23,42,0.07)", borderRadius: 24, padding: 30, boxSizing: "border-box" };
  const pill: CSSProperties = { ...ui(19, 600), padding: "9px 18px", borderRadius: 99, border: `1.5px solid ${INK.border}`, background: "#fff" };
  const typed = "DELETE".slice(0, Math.round(6 * clamp01(s.deleteTyped)));
  const armed = clamp01(s.deleteTyped * 6 - 5);

  return (
    <div style={{ position: "relative", width: SETTINGS.w, height: SETTINGS.h, background: INK.page, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 56, top: 34, display: "flex", alignItems: "center", gap: 14 }}>
        <Img src={MARKS["icon-raya-512.png"]} style={{ width: 40, height: 40 }} />
        <span style={{ ...ui(34, 700), letterSpacing: "-0.02em" }}>Settings</span>
      </div>

      {/* Recovery key */}
      <div style={{ ...card, left: 56, top: 110, width: 740, height: 470 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="15" r="4" />
            <path d="M10.8 12.2 20 3M17 6l3 3M15 8l2 2" />
          </svg>
          <span style={ui(27, 700)}>Recovery key</span>
        </div>
        <div style={{ ...ui(19, 450, INK.muted), marginTop: 10 }}>
          Your key is the <b style={{ color: INK.text }}>only way back into this account</b> if you lose access.
        </div>
        <div style={{ marginTop: 22, height: 74, borderRadius: 12, background: INK.field, border: `1.5px solid ${INK.border}`, display: "flex", alignItems: "center", padding: "0 22px", fontFamily: MONO, fontSize: 34, letterSpacing: "0.1em", color: INK.text }}>
          {keyText(s.keyShown, s.keySwap)}
          {s.keyShown > 0 && s.keyShown < 1 && <span style={{ width: 3, height: 34, background: INK.text, marginLeft: 4 }} />}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <span style={pill}>Hide</span>
          <span style={pill}>Copy</span>
          <span style={pill}>Download</span>
        </div>
        <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 18 }}>
          <Button pressed={s.generatePressed}>Generate a new key</Button>
          <span style={{ ...ui(18, 500, INK.muted), opacity: clamp01(s.keySwap * 3 - 2) }}>Any older key has stopped working.</span>
        </div>
      </div>

      {/* Your data */}
      <div style={{ ...card, left: 836, top: 110, width: 808, height: 790 }}>
        <div style={ui(27, 700)}>Your data</div>
        <div style={{ ...ui(18, 450, INK.muted), marginTop: 4, marginBottom: 14 }}>What we hold about you, and what you can do with it — right here, no request form.</div>

        <div style={row}>
          <div>
            <div style={ui(21, 700)}>Download a copy</div>
            <div style={ui(17, 450, INK.muted)}>Everything on your account, as a JSON file.</div>
          </div>
          <div style={{ position: "relative" }}>
            <Button pressed={s.downloadPressed} style={{ padding: "10px 18px", fontSize: 19 }}>Download</Button>
            {s.fileChip > 0 && (
              <div style={{ position: "absolute", right: "calc(100% + 14px)", top: 6, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", opacity: s.fileChip, transform: `translateX(${(1 - s.fileChip) * 16}px)`, ...ui(16, 600, "#047857") }}>
                ✓ bluestift-export.json
              </div>
            )}
          </div>
        </div>

        <div style={{ position: "relative", height: 232 }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - s.minor }}>
            <div style={row}>
              <div>
                <div style={ui(21, 700)}>Product analytics</div>
                <div style={{ ...ui(17, 450, INK.muted), maxWidth: 560 }}>Anonymous usage measurement so we can see which features actually help.</div>
              </div>
              <Switch on={s.analyticsOn} />
            </div>
            <div style={row}>
              <div>
                <div style={ui(21, 700)}>
                  Help improve <span style={{ fontFamily: RAYA_FONT }}>Raya</span>
                </div>
                <div style={{ ...ui(17, 450, INK.muted), maxWidth: 560 }}>Your conversations help train the tutor other students get.</div>
              </div>
              <Switch on={s.trainingOn} />
            </div>
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: s.minor }}>
            <div style={row}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={ui(21, 700)}>Analytics &amp; model improvement</span>
                  <span style={{ ...ui(15, 700, "#c2410c"), background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 99, padding: "3px 12px" }}>Under 18</span>
                </div>
                <div style={{ ...ui(18, 450, INK.muted), marginTop: 6, maxWidth: 700, lineHeight: 1.5 }}>
                  Both are switched off on this account and can't be turned on. Accounts belonging to under-18s aren't measured, and{" "}
                  <Mark p={s.markMinor}>their work is never used to improve our models.</Mark>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...row, display: "block" }}>
          <div style={ui(21, 700, INK.red)}>Delete this account</div>
          <div style={{ ...ui(17, 450, INK.muted), maxWidth: 700 }}>Permanent. Your conversations, documents, results and cognitive profile are erased.</div>
          <div style={{ ...ui(17, 450, INK.muted), marginTop: 10 }}>
            Type <b style={{ color: INK.text }}>DELETE</b> to confirm.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <div style={{ width: 200, height: 52, borderRadius: 12, border: `1.5px solid ${INK.border}`, display: "flex", alignItems: "center", padding: "0 16px", ...ui(20, 600, typed ? INK.text : INK.faint) }}>
              {typed || "DELETE"}
            </div>
            <div style={{ height: 52, display: "flex", alignItems: "center", padding: "0 20px", borderRadius: 12, border: `1.5px solid ${INK.red}`, ...ui(20, 700, INK.red), opacity: 0.45 + 0.55 * armed }}>Delete permanently</div>
          </div>
        </div>
      </div>

      {/* The consent banner, where the real one sits: bottom left, over the page. */}
      {s.banner > 0.001 && (
        <div
          style={{
            position: "absolute",
            left: 24,
            bottom: 24,
            width: 520,
            background: "#0b1220",
            color: "#eef2f8",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: "22px 24px",
            boxShadow: "0 16px 40px rgba(4,10,24,0.45)",
            fontFamily: FONTS.display,
            fontSize: 21,
            lineHeight: 1.5,
            opacity: s.banner,
            transform: `translateY(${((1 - s.banner) * 40).toFixed(1)}px)`,
          }}
        >
          <div style={{ margin: "0 0 16px" }}>
            We use privacy-friendly analytics to understand how Bluestift is used and make it better —{" "}
            <Mark p={s.markNoAds} color="rgba(138,180,255,0.3)">no ads</Mark>, and{" "}
            <Mark p={s.markNeverSell} color="rgba(138,180,255,0.3)">we never sell your data</Mark>. You can decline and keep using everything.{" "}
            <span style={{ color: "#8ab4ff", textDecoration: "underline" }}>Privacy</span>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <span style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cdd6e4", borderRadius: 999, padding: "8px 20px", fontWeight: 600 }}>Decline</span>
            <span
              style={{
                background: "#3b6ef5",
                color: "#fff",
                borderRadius: 999,
                padding: "8px 22px",
                fontWeight: 700,
                transform: `scale(${1 - 0.06 * Math.sin(clamp01(s.acceptPressed) * Math.PI)})`,
                boxShadow: s.acceptPressed > 0 && s.acceptPressed < 1 ? "0 0 0 6px rgba(59,110,245,0.3)" : undefined,
              }}
            >
              Accept
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── the public list ───────────────────────────── */

const PROVIDERS: [string, string, string][] = [
  ["Supabase", "Database, authentication and file storage — the system of record", "EU"],
  ["Vercel", "Application hosting and scheduled jobs", "EU / US"],
  ["Railway", "Hosts the Kernel — the engine that reads each tutoring exchange", "US"],
  ["Google (Gemini)", "Generates Raya's replies", "US"],
  ["Groq", "Fallback model for replies, and speech-to-text for voice", "US"],
  ["PostHog", "Product analytics — only for accounts that opted in, never under-18s", "US"],
  ["Cloudflare", "Turnstile bot protection on public forms and sign-up", "Global"],
  ["Resend", "Transactional email", "EU / US"],
];

export const SUBPROCESSORS = { w: 1500, h: 900 };

export function SubprocessorsScreen({ rows }: { rows: number }) {
  return (
    <div style={{ width: SUBPROCESSORS.w, height: SUBPROCESSORS.h, background: "linear-gradient(180deg,#f7faff,#e9f1fc)", padding: "56px 70px", boxSizing: "border-box" }}>
      <div style={{ ...ui(64, 700), letterSpacing: "-0.03em" }}>
        Sub-<span style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontWeight: 400 }}>processors.</span>
      </div>
      <div style={{ ...ui(22, 450, INK.muted), marginTop: 10 }}>Every third party that touches your data, what each one does, and where it runs. Named, not summarised.</div>
      <div style={{ marginTop: 34, background: "#fff", borderRadius: 22, border: "1px solid rgba(15,23,42,0.07)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 150px", padding: "18px 28px", background: "#f3f6fa", ...ui(17, 700, INK.muted), textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <span>Provider</span>
          <span>What it does</span>
          <span>Where</span>
        </div>
        {PROVIDERS.map(([name, what, where], i) => {
          const k = clamp01(rows * PROVIDERS.length - i);
          return (
            <div
              key={name}
              style={{
                display: "grid",
                gridTemplateColumns: "260px 1fr 150px",
                padding: "17px 28px",
                borderTop: `1px solid ${INK.border}`,
                opacity: k,
                transform: `translateY(${((1 - k) * 12).toFixed(1)}px)`,
                alignItems: "center",
              }}
            >
              <span style={ui(22, 700)}>{name}</span>
              <span style={ui(20, 450, INK.muted)}>{what}</span>
              <span style={ui(20, 600)}>{where}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
