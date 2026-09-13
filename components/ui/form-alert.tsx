"use client";

/**
 * A stop the person has to see: red, with a "!" badge, announced to screen
 * readers, placed directly under the field or button it is about.
 *
 * The same look as the sign-in page's alerts (login-view), so "this email
 * already has an account", "this username is taken" and "that link expired"
 * read as the same kind of message wherever they appear. Fixed colours rather
 * than theme tokens on purpose: a red alert must stay a red alert in dark mode.
 */
export function FormAlert({
  text,
  hint,
  id,
  children,
}: {
  text: string;
  /** A second, lighter line: what to do about it. */
  hint?: string;
  id?: string;
  /** An action under the message, e.g. a "sign in instead" link. */
  children?: React.ReactNode;
}) {
  return (
    <div
      id={id}
      role="alert"
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        margin: "6px 0 8px",
        borderRadius: 12,
        padding: "12px 14px",
        fontSize: 15,
        lineHeight: 1.5,
        fontWeight: 600,
        border: "1.5px solid #f87171",
        background: "#fef2f2",
        color: "#991b1b",
        textAlign: "left",
        scrollMarginBlock: 24,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          marginTop: 1,
          borderRadius: "50%",
          background: "#dc2626",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          lineHeight: "20px",
          textAlign: "center",
        }}
      >
        !
      </span>
      <span>
        {text}
        {hint && <span style={{ display: "block", marginTop: 4, fontWeight: 500, color: "#b91c1c" }}>{hint}</span>}
        {children}
      </span>
    </div>
  );
}

/** The field an alert is about: a red edge, so the two line up at a glance. */
export const invalidField: React.CSSProperties = {
  border: "1.5px solid #f87171",
  boxShadow: "0 0 0 3px rgba(248,113,113,0.18)",
};
