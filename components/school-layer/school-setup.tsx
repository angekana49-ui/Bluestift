"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { netFetch } from "@/lib/net/client-fetch";
import { COUNTRIES, SCHOOL_TYPES } from "@/lib/school-constants";
import { MIN_B2B_SEATS, SCHOOL_PILOT_DAYS, termTotal } from "@/lib/billing/terms";
import { initialsOf } from "@/lib/name";
import { isNameTooShort } from "@/lib/names";
import { useAppLocale, useTranslate } from "@/components/ui/locale";
import { fieldInput, fieldLabel, heading, primaryBtn, secondaryBtn, sub, WORDMARK_B } from "@/components/ui/auth-chrome";
import type { MessageKey } from "@/lib/i18n";
import { AllSetCard, LayerShell } from "./layer-shell";

/** Mirror of lib/billing.ts BillingPlan — that module is server-only. */
export type LayerPlan = {
  id: string;
  name: string;
  tier: string | null;
  price: number | null;
  priceUnit: "flat" | "per_seat";
  features: string[];
};

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEAM_EMAIL = "hello@thebluestift.com";

/**
 * Translations of the plan features, which live in the database in English.
 * Keyed by plan and position. If a plan's list in the database no longer has
 * the length these were written for, the card shows the database's own words
 * rather than a translation of something that changed underneath it.
 */
const PLAN_FEATURES: Record<string, MessageKey[]> = {
  school_standard: ["plan.feature.standard.0", "plan.feature.standard.1", "plan.feature.standard.2", "plan.feature.standard.3"],
  school_plus: ["plan.feature.plus.0", "plan.feature.plus.1", "plan.feature.plus.2", "plan.feature.plus.3", "plan.feature.plus.4"],
  school_custom: ["plan.feature.custom.0", "plan.feature.custom.1", "plan.feature.custom.2", "plan.feature.custom.3", "plan.feature.custom.4"],
};

const money = (n: number, locale: string) => `$${n.toLocaleString(locale, { maximumFractionDigits: 2 })}`;

/** A plan with no price yet cannot start a pilot: there are no terms to agree to. */
const isQuoted = (p: LayerPlan) => p.price == null || p.tier === "custom";

/**
 * The school form of the layer between onboarding and Schools, in two steps
 * under the onboarding's own progress gauge — two short screens hold up on a
 * phone where one long one did not.
 *
 *   1. The school: logo, name, type, country, city, phone, school email, and
 *      the admin's own email shown read-only (it already receives requests and
 *      receipts).
 *   2. The offer: the headcount (at least MIN_B2B_SEATS), the plan, the terms
 *      those make, and ONE wide button at the bottom that starts the pilot.
 *
 * Committing to a plan and a real headcount is the filter against schools made
 * on a whim; the server enforces the same rule. A plan without a price (Custom)
 * is shown but cannot be chosen — it offers a way to reach the team instead.
 */
export function SchoolSetup({ plans, adminEmail }: { plans: LayerPlan[]; adminEmail: string }) {
  const tr = useTranslate();
  const { locale } = useAppLocale();

  const [step, setStep] = useState<1 | 2>(1);
  const [logo, setLogo] = useState<{ file: File; url: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [showDetailErrors, setShowDetailErrors] = useState(false);
  /** A refusal from the server that belongs to the details screen (e.g. a duplicate). */
  const [detailsNotice, setDetailsNotice] = useState<string | null>(null);

  const [planId, setPlanId] = useState<string | null>(null);
  const [effectif, setEffectif] = useState(String(MIN_B2B_SEATS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; pilotUntil: string; logoFailed: boolean } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // A preview URL holds the file in memory until revoked.
  useEffect(() => () => {
    if (logo) URL.revokeObjectURL(logo.url);
  }, [logo]);

  const detailErrors: Partial<Record<"name" | "country" | "city" | "email", MessageKey>> = {};
  if (!name.trim()) detailErrors.name = "layer.school.err.name";
  else if (isNameTooShort(name)) detailErrors.name = "layer.school.err.nameShort";
  if (!countryCode) detailErrors.country = "layer.school.err.country";
  if (!city.trim()) detailErrors.city = "layer.school.err.city";
  if (email.trim() && !EMAIL_RE.test(email.trim())) detailErrors.email = "layer.school.err.email";
  const detailsOk = Object.keys(detailErrors).length === 0;
  const fieldError = (k: keyof typeof detailErrors) =>
    showDetailErrors && detailErrors[k] ? (
      <p style={{ color: "#dc2626", fontSize: 14, margin: "-10px 0 12px" }}>{tr(detailErrors[k]!)}</p>
    ) : null;

  const seats = Number(effectif);
  const validSeats = Number.isInteger(seats) && seats >= MIN_B2B_SEATS;
  const plan = plans.find((p) => p.id === planId) ?? null;
  const monthly = plan && !isQuoted(plan) && validSeats ? (plan.priceUnit === "per_seat" ? plan.price! * seats : plan.price!) : null;
  const yearly = monthly != null ? termTotal(monthly * 12, 12) : null;
  const canLaunch = Boolean(plan && !isQuoted(plan) && validSeats && !busy);

  // The onboarding's gauge, same formula: seeded, never 0, never 100 before the end.
  const progress = step === 1 ? 28 : 95;

  function goTo(next: 1 | 2) {
    setError(null);
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function continueToPlans() {
    if (!detailsOk) {
      setShowDetailErrors(true);
      return;
    }
    goTo(2);
  }

  function pickLogo(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setLogoError(tr("layer.school.logoType"));
    if (file.size > MAX_LOGO_BYTES) return setLogoError(tr("layer.school.logoTooBig"));
    setLogo({ file, url: URL.createObjectURL(file) });
  }

  async function launch() {
    if (!plan || busy) return;
    setError(null);
    if (!detailsOk) {
      setShowDetailErrors(true);
      return goTo(1);
    }
    if (!validSeats) {
      return setError(`${tr("layer.plans.minErrorA")} ${MIN_B2B_SEATS} ${tr("layer.plans.minErrorB")}`);
    }

    setBusy(true);
    try {
      const res = await netFetch(
        "/api/school/create",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            schoolType,
            countryCode,
            city: city.trim(),
            email: email.trim(),
            phone: phone.trim(),
            planId: plan.id,
            effectif: seats,
          }),
        },
        { timeoutMs: 20_000 },
      );
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        // A school this admin already has, or a detail the server refused: the
        // fix is on the first screen, so that is where the message goes.
        if (d?.code === "duplicate_school") {
          setStep(1);
          setDetailsNotice(tr("layer.school.err.duplicate"));
          topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (d?.code === "name" || d?.code === "city" || d?.code === "country") {
          setShowDetailErrors(true);
          setStep(1);
          setDetailsNotice(d?.error ?? tr("layer.err.generic"));
          return;
        }
        setError(d?.error ?? tr("layer.err.generic"));
        return;
      }

      // The logo route needs the admin membership the call above just created,
      // so it can only run now. A failed upload is not a failed school.
      let logoFailed = false;
      if (logo) {
        try {
          const fd = new FormData();
          fd.append("file", logo.file);
          const up = await netFetch("/api/school/logo", { method: "POST", body: fd }, { timeoutMs: 60_000 });
          logoFailed = !up.ok;
        } catch {
          logoFailed = true;
        }
      }
      setDone({ name: d.name ?? name.trim(), pilotUntil: d.pilotUntil, logoFailed });
    } catch {
      setError(tr("layer.err.network"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    // In the APP's language, not the browser's: the sentence around the date is
    // translated, and "jusqu'au October 27" is what the browser default gave.
    const until = new Date(`${done.pilotUntil}T12:00:00Z`).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return (
      <LayerShell maxWidth={560}>
        <AllSetCard
          title={tr("layer.allSet.title")}
          body={
            <>
              <strong style={{ color: "#0b1220" }}>{done.name}</strong> {tr("layer.allSet.schoolBody")} {until}.
              {done.logoFailed && (
                <span style={{ display: "block", marginTop: 8, fontSize: 15 }}>{tr("layer.allSet.logoFailed")}</span>
              )}
            </>
          }
          cta={tr("layer.allSet.openSchool")}
          onCta={() => window.location.assign("/school")}
        />
      </LayerShell>
    );
  }

  const switchLink = (
    <Link href="/school/enter?as=teacher" style={{ fontSize: 15, fontWeight: 600, color: "#334155", textDecoration: "none" }}>
      {tr("layer.switch.toTeacher")}
    </Link>
  );

  return (
    <LayerShell maxWidth={step === 1 ? 620 : 760} top={switchLink}>
      <div ref={topRef} style={{ scrollMarginTop: 24 }}>
        {/* The onboarding's gauge: two forms, two steps. */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {tr("onb.stepLabel")} {step} {tr("onb.of")} 2
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: WORDMARK_B }}>
              {progress}% {tr("onb.setUp")}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "#eef2f8", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                borderRadius: 99,
                background: "linear-gradient(90deg,#2f7fe0,#6366f1)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      </div>

      {step === 1 ? (
        <>
          <h1 style={heading}>{tr("layer.school.heading")}</h1>
          <p style={{ ...sub, maxWidth: 520, marginInline: "auto" }}>{tr("layer.school.sub")}</p>

          {detailsNotice && (
            <div
              role="alert"
              style={{
                border: "1.5px solid #fca5a5",
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 12,
                padding: "12px 14px",
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.5,
                marginBottom: 18,
              }}
            >
              {detailsNotice}
            </div>
          )}

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                overflow: "hidden",
                flexShrink: 0,
                background: "#eef3f9",
                border: "1.5px solid #dde5ee",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 700,
                color: WORDMARK_B,
              }}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : name.trim() ? (
                initialsOf(name)
              ) : (
                "?"
              )}
            </div>
            <div>
              <span style={{ ...fieldLabel, marginBottom: 4 }}>{tr("layer.school.logo")}</span>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ ...secondaryBtn, padding: "8px 16px", fontSize: 15 }}>
                {logo ? tr("layer.school.logoChange") : tr("layer.school.logoAdd")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={LOGO_TYPES.join(",")}
                hidden
                onChange={(e) => {
                  pickLogo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <p style={{ margin: "6px 0 0", fontSize: 14, color: logoError ? "#dc2626" : "#64748b" }}>
                {logoError ?? tr("layer.school.logoHint")}
              </p>
            </div>
          </div>

          <label htmlFor="school-name" style={fieldLabel}>
            {tr("layer.school.name")} *
          </label>
          <input
            id="school-name"
            style={fieldInput}
            placeholder={tr("layer.school.namePlaceholder")}
            value={name}
            maxLength={120}
            onChange={(e) => {
              setName(e.target.value);
              setDetailsNotice(null);
            }}
          />
          {fieldError("name")}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", columnGap: 14 }}>
            <div>
              <label htmlFor="school-type" style={fieldLabel}>
                {tr("layer.school.type")}
              </label>
              <select id="school-type" style={{ ...fieldInput, cursor: "pointer" }} value={schoolType} onChange={(e) => setSchoolType(e.target.value)}>
                <option value="">{tr("layer.school.typeNone")}</option>
                {SCHOOL_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {tr(`school.type.${st}` as MessageKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="school-country" style={fieldLabel}>
                {tr("layer.school.country")} *
              </label>
              <select
                id="school-country"
                style={{ ...fieldInput, cursor: "pointer" }}
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  setDetailsNotice(null);
                }}
              >
                <option value="">{tr("layer.school.countryNone")}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldError("country")}
            </div>
            <div>
              <label htmlFor="school-city" style={fieldLabel}>
                {tr("layer.school.city")} *
              </label>
              <input
                id="school-city"
                style={fieldInput}
                value={city}
                maxLength={80}
                onChange={(e) => {
                  setCity(e.target.value);
                  setDetailsNotice(null);
                }}
              />
              {fieldError("city")}
            </div>
            <div>
              <label htmlFor="school-phone" style={fieldLabel}>
                {tr("layer.school.phone")}
              </label>
              <input id="school-phone" style={fieldInput} type="tel" autoComplete="tel" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label htmlFor="school-email" style={fieldLabel}>
                {tr("layer.school.email")}
              </label>
              <input
                id="school-email"
                style={fieldInput}
                type="email"
                placeholder={tr("layer.school.emailPlaceholder")}
                value={email}
                maxLength={160}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldError("email")}
            </div>
            <div>
              <label htmlFor="admin-email" style={fieldLabel}>
                {tr("layer.school.adminEmail")}
              </label>
              <input
                id="admin-email"
                style={{ ...fieldInput, background: "#f3f6fa", color: "#475569", cursor: "not-allowed", marginBottom: 4 }}
                value={adminEmail}
                readOnly
                aria-readonly
              />
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>{tr("layer.school.adminEmailHint")}</p>
            </div>
          </div>

          <button type="button" onClick={continueToPlans} style={{ ...primaryBtn, marginTop: 12 }}>
            {tr("onb.continueArrow")}
          </button>
        </>
      ) : (
        <>
          <h1 style={heading}>{tr("layer.plans.heading")}</h1>
          <p style={{ ...sub, maxWidth: 560, marginInline: "auto" }}>
            {tr("layer.plans.subA")} {SCHOOL_PILOT_DAYS}
            {tr("layer.plans.subB")}
          </p>

          {/* The headcount first: it is what turns a per-student rate into a price. */}
          <div style={{ maxWidth: 320, margin: "0 auto 22px" }}>
            <label htmlFor="effectif" style={{ ...fieldLabel, textAlign: "center" }}>
              {tr("layer.plans.students")}
            </label>
            <input
              id="effectif"
              style={{ ...fieldInput, marginBottom: 4, textAlign: "center", fontSize: 20, fontWeight: 700 }}
              type="number"
              inputMode="numeric"
              min={MIN_B2B_SEATS}
              step={1}
              value={effectif}
              onChange={(e) => setEffectif(e.target.value)}
              disabled={busy}
            />
            <p style={{ margin: 0, fontSize: 13.5, color: validSeats ? "#64748b" : "#dc2626", textAlign: "center" }}>
              {tr("layer.plans.minA")} {MIN_B2B_SEATS} {tr("layer.plans.minB")}
            </p>
          </div>

          <div role="radiogroup" aria-label={tr("layer.plans.heading")} style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", alignItems: "stretch" }}>
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                selected={planId === p.id}
                onSelect={() => {
                  setPlanId(p.id);
                  setError(null);
                }}
                seats={validSeats ? seats : null}
                disabled={busy}
              />
            ))}
          </div>
          {plans.length === 0 && (
            <p style={{ textAlign: "center", color: "#64748b", fontSize: 15 }}>{tr("layer.plans.unavailable")}</p>
          )}

          {/* The terms, stated right above the one button that accepts them. */}
          <div
            aria-live="polite"
            style={{ background: "#eef3f9", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: "#0b1220", lineHeight: 1.6, margin: "22px 0 14px" }}
          >
            {plan ? (
              <>
                <strong>
                  {plan.name} · {SCHOOL_PILOT_DAYS}
                  {tr("layer.plans.pilotDays")}
                </strong>
                {validSeats && (
                  <>
                    {" · "}
                    {seats} {tr("layer.plans.studentsWord")}
                  </>
                )}
                {" · "}
                {tr("layer.plans.nothingToday")}
                {monthly != null && yearly != null && (
                  <div style={{ color: "#475569", marginTop: 4 }}>
                    {tr("layer.plans.after")} <strong style={{ color: "#0b1220" }}>{money(monthly, locale)}</strong> {tr("layer.plans.perMonth")}{" "}
                    {tr("layer.plans.or")} <strong style={{ color: "#0b1220" }}>{money(yearly, locale)}</strong> {tr("layer.plans.perYear")}
                  </div>
                )}
              </>
            ) : (
              <span style={{ color: "#475569" }}>{tr("layer.plans.pickPrompt")}</span>
            )}
          </div>

          {error && <p style={{ color: "#dc2626", textAlign: "center", margin: "0 0 12px", fontSize: 15 }}>{error}</p>}

          <button
            type="button"
            onClick={launch}
            disabled={!canLaunch}
            style={{ ...primaryBtn, marginTop: 0, padding: 17, fontSize: 17, opacity: canLaunch ? 1 : 0.45, cursor: canLaunch ? "pointer" : "not-allowed" }}
          >
            {busy ? tr("layer.plans.starting") : `${tr("layer.plans.startA")}${SCHOOL_PILOT_DAYS}${tr("layer.plans.startB")}`}
          </button>
          <button
            type="button"
            onClick={() => goTo(1)}
            disabled={busy}
            style={{ background: "none", border: "none", width: "100%", marginTop: 12, fontSize: 15, fontWeight: 600, color: "#64748b", cursor: "pointer" }}
          >
            ← {tr("onb.back")}
          </button>
        </>
      )}
    </LayerShell>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
  seats,
  disabled,
}: {
  plan: LayerPlan;
  selected: boolean;
  onSelect: () => void;
  /** The declared headcount when valid, for the monthly estimate. */
  seats: number | null;
  disabled: boolean;
}) {
  const tr = useTranslate();
  const { locale } = useAppLocale();
  const quoted = isQuoted(plan);
  const perSeat = plan.priceUnit === "per_seat";

  const featureKeys = PLAN_FEATURES[plan.id];
  const features =
    featureKeys && featureKeys.length === plan.features.length ? featureKeys.map((k) => tr(k)) : plan.features;

  const priceLabel = quoted
    ? tr("school.billing.onQuote")
    : perSeat
      ? `$${plan.price} ${tr("school.billing.perStudentMoSuffix")}`
      : `$${plan.price} / ${tr("school.billing.mo")}`;
  const estimate = !quoted && seats != null ? (perSeat ? plan.price! * seats : plan.price!) : null;

  const featureList = (
    <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", textAlign: "left" }}>
      {features.map((f, i) => (
        <li key={i} style={{ fontSize: 14, color: "#475569", marginBottom: 5, display: "flex", gap: 6, lineHeight: 1.45 }}>
          <span style={{ color: quoted ? "#94a3b8" : "#16a34a" }}>✓</span>
          {f}
        </li>
      ))}
    </ul>
  );

  // No price yet: visible, so a large school knows it exists, but not a choice.
  if (quoted) {
    return (
      <div
        aria-disabled
        style={{
          border: "1.5px dashed #cbd5e1",
          borderRadius: 16,
          padding: 16,
          background: "#f6f8fb",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#64748b" }}>{plan.name}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", background: "#e2e8f0", borderRadius: 99, padding: "2px 9px", whiteSpace: "nowrap" }}>
            {tr("layer.plans.unavailableBadge")}
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#94a3b8", marginTop: 2 }}>{priceLabel}</div>
        <div style={{ opacity: 0.75, flex: 1 }}>{featureList}</div>
        <button type="button" disabled style={{ ...secondaryBtn, width: "100%", marginTop: 14, padding: 11, fontSize: 15, opacity: 0.5, cursor: "not-allowed" }}>
          {tr("layer.plans.unavailableBadge")}
        </button>
        <a
          href={`mailto:${TEAM_EMAIL}?subject=${encodeURIComponent(`${plan.name} — Bluestift Schools`)}`}
          style={{ display: "block", textAlign: "center", marginTop: 10, fontSize: 15, fontWeight: 600, color: WORDMARK_B, textDecoration: "none" }}
        >
          {tr("layer.plans.contactTeam")} →
        </a>
      </div>
    );
  }

  // A radio, not a <button>: the card holds a list, which a button may not.
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        border: `1.5px solid ${selected ? "#0b1220" : "#dde5ee"}`,
        borderRadius: 16,
        padding: 16,
        background: selected ? "#ffffff" : "#fbfcfe",
        boxShadow: selected ? "0 10px 28px rgba(11,18,32,0.10)" : "none",
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        transition: "border-color .15s, box-shadow .15s",
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%" }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "#0b1220" }}>{plan.name}</span>
        <span
          aria-hidden
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            flexShrink: 0,
            border: `2px solid ${selected ? "#0b1220" : "#cbd5e1"}`,
            background: selected ? "#0b1220" : "#fff",
            color: "#fff",
            fontSize: 12,
            lineHeight: "16px",
            textAlign: "center",
          }}
        >
          {selected ? "✓" : ""}
        </span>
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: WORDMARK_B, marginTop: 2 }}>{priceLabel}</span>
      {estimate != null && (
        <span style={{ fontSize: 14, color: "#475569", marginTop: 2 }}>
          ≈ {money(estimate, locale)} {tr("layer.plans.perMonth")}
        </span>
      )}
      <div style={{ flex: 1, width: "100%" }}>{featureList}</div>
    </div>
  );
}
