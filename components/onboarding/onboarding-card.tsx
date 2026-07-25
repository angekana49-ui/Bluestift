"use client";

import { useState } from "react";
import { IconCheck } from "@/components/ui/icons";
import { display } from "@/components/ui/tokens";

type Role = "student" | "teacher";
type Status = "pending" | "success";

/**
 * Onboarding — join-a-school-via-code, faithful reproduction of the design
 * handoff (`reference-Onboarding.html`). A standalone, centered auth-style card
 * (no sidebar, no cloud shell) shared by both roles via a top segmented control;
 * a teacher is a basic user until their code is redeemed, same as a student.
 * The code cells are a static mock — wire per-character focus/paste when hooked
 * to the real join flow (POST /api/school/join for students).
 */
export function OnboardingCard() {
  const [role, setRole] = useState<Role>("student");
  const [status, setStatus] = useState<Status>("pending");
  const isStudent = role === "student";

  const headline = isStudent ? "Rejoins ta classe" : "Rejoins ton établissement";
  const subline = isStudent
    ? "Entre le code donné par ton professeur pour accéder à tes cours et à Raya."
    : "Entre le code donné par ton administrateur pour rejoindre l'équipe enseignante.";
  const codeHint = isStudent ? "professeur ou administrateur" : "administrateur";
  const successLine = isStudent
    ? "Tu es maintenant inscrit·e en 6e-A. Raya connaît déjà ton programme."
    : "Ton compte professeur est activé. Tu peux voir tes classes dans Schools.";
  const enterLabel = isStudent ? "Aller à Raya" : "Aller à Schools";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        background: "linear-gradient(180deg,#eef3f9 0%,#dde8f3 45%,#c9d9ea 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#ffffff",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 24,
          boxShadow: "0 30px 80px rgba(15,23,42,0.14)",
          padding: 32,
        }}
      >
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/raya-logo.jpeg" alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover" }} />
          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: display }}>
            <span style={{ color: "#173d8a" }}>Blue</span>
            <span style={{ color: "#2f7fe0" }}>Stift</span>
          </span>
        </div>

        {/* role tabs */}
        <div style={{ display: "flex", gap: 2, background: "rgba(15,23,42,0.05)", borderRadius: 99, padding: 4, marginBottom: 24 }}>
          <RoleTab label="Élève" active={isStudent} onClick={() => setRole("student")} />
          <RoleTab label="Professeur" active={!isStudent} onClick={() => setRole("teacher")} />
        </div>

        {status === "pending" ? (
          <>
            <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, letterSpacing: "-0.01em", margin: "0 0 6px", textAlign: "center" }}>{headline}</h1>
            <p style={{ fontSize: 12.5, color: "#64748b", textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>{subline}</p>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 8 }}>
              {["V", "O", "L", "T", "6", "A"].map((ch, i) => (
                <input key={i} maxLength={1} defaultValue={ch} style={codeInputStyle} />
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "center", margin: "8px 0 24px" }}>Code fourni par ton établissement ({codeHint})</p>

            <div onClick={() => setStatus("success")} style={{ cursor: "pointer", background: "#0b1220", color: "#fff", borderRadius: 99, padding: 14, textAlign: "center", fontSize: 13, fontWeight: 600 }}>
              Rejoindre l&apos;établissement
            </div>
            <p style={{ fontSize: 11.5, color: "#64748b", textAlign: "center", marginTop: 16 }}>
              Pas de code ? <span style={{ color: "#2f7fe0", fontWeight: 600, cursor: "pointer" }}>Continuer sans école</span>
            </p>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "12px 0 4px" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <IconCheck size={26} />
            </div>
            <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: 19, margin: "0 0 6px" }}>Bienvenue chez Lycée Voltaire</h1>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 24px", lineHeight: 1.6 }}>{successLine}</p>
            <div onClick={() => setStatus("pending")} style={{ cursor: "pointer", width: "100%", background: "#0b1220", color: "#fff", borderRadius: 99, padding: 14, textAlign: "center", fontSize: 13, fontWeight: 600, boxSizing: "border-box" }}>
              {enterLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const codeInputStyle: React.CSSProperties = {
  width: 44,
  height: 56,
  textAlign: "center",
  fontSize: 24,
  fontWeight: 700,
  borderRadius: 12,
  border: "1px solid #dde5ee",
  background: "#f3f6fa",
  color: "#0b1220",
  fontFamily: display,
};

function RoleTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: "center",
        padding: "10px 18px",
        borderRadius: 99,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background .2s ease,color .2s ease",
        background: active ? "#ffffff" : "transparent",
        color: active ? "#0b1220" : "#64748b",
      }}
    >
      {label}
    </div>
  );
}
