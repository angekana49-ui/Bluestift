"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { netFetch } from "@/lib/net/client-fetch";
import { COUNTRIES, SCHOOL_TYPES } from "@/lib/school-constants";
import { MIN_B2B_SEATS, SCHOOL_PILOT_DAYS, termTotal } from "@/lib/billing/terms";
import { initialsOf } from "@/lib/name";
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

const money = (n: number, locale: string) => `$${n.toLocaleString(locale, { maximumFractionDigits: 2 })}`;

/**
 * The school form of the layer between onboarding and Schools.
 *
 * Everything the Schools settings panel asks, asked once up front (logo, name,
 * type, country, city, contact email, phone), with the admin's own email shown
 * but not editable: it is the verified address join requests and receipts
 * already go to.
 *
 * It deliberately has no plain "Create" button. The plan cards ARE the submit,
 * working the way the Billing tab's do: choosing one opens the headcount and
 * the terms, and confirming there creates the school on a 45-day pilot of that
 * plan. Having to commit to a plan and at least MIN_B2B_SEATS students is the
 * filter against schools created on a whim; the server enforces the same rule.
 */
export function SchoolSetup({ plans, adminEmail }: { plans: LayerPlan[]; adminEmail: string }) {
  const tr = useTranslate();
  const { locale } = useAppLocale();

  const [logo, setLogo] = useState<{ file: File; url: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [effectif, setEffectif] = useState(String(MIN_B2B_SEATS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailErrors, setShowDetailErrors] = useState(false);
  const [done, setDone] = useState<{ name: string; pilotUntil: string; logoFailed: boolean } | null>(null);

  const detailsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A preview URL holds the file in memory until revoked.
  useEffect(() => () => {
    if (logo) URL.revokeObjectURL(logo.url);
  }, [logo]);

  const detailErrors: Partial<Record<"name" | "country" | "email", MessageKey>> = {};
  if (!name.trim()) detailErrors.name = "layer.school.err.name";
  if (!countryCode) detailErrors.country = "layer.school.err.country";
  if (email.trim() && !EMAIL_RE.test(email.trim())) detailErrors.email = "layer.school.err.email";
  const detailsOk = Object.keys(detailErrors).length === 0;
  const fieldError = (k: keyof typeof detailErrors) =>
    showDetailErrors && detailErrors[k] ? (
      <p style={{ color: "#dc2626", fontSize: 14, margin: "-10px 0 12px" }}>{tr(detailErrors[k]!)}</p>
    ) : null;

  function pickLogo(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setLogoError(tr("layer.school.logoType"));
    if (file.size > MAX_LOGO_BYTES) return setLogoError(tr("layer.school.logoTooBig"));
    setLogo({ file, url: URL.createObjectURL(file) });
  }

  async function start(plan: LayerPlan) {
    if (busy) return;
    setError(null);
    if (!detailsOk) {
      setShowDetailErrors(true);
      setError(tr("layer.plans.fixDetails"));
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const seats = Number(effectif);
    if (!Number.isInteger(seats) || seats < MIN_B2B_SEATS) {
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

  const switchLink = (
    <Link href="/school/enter?as=teacher" style={{ fontSize: 15, fontWeight: 600, color: "#334155", textDecoration: "none" }}>
      {tr("layer.switch.toTeacher")}
    </Link>
  );

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

  return (
    <LayerShell top={switchLink}>
      <div ref={detailsRef} style={{ scrollMarginTop: 24 }}>
        <h1 style={heading}>{tr("layer.school.heading")}</h1>
        <p style={{ ...sub, maxWidth: 520, marginInline: "auto" }}>{tr("layer.school.sub")}</p>

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
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              style={{ ...secondaryBtn, padding: "8px 16px", fontSize: 15 }}
            >
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
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        {fieldError("name")}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", columnGap: 14 }}>
          <div>
            <label htmlFor="school-type" style={fieldLabel}>
              {tr("layer.school.type")}
            </label>
            <select
              id="school-type"
              style={{ ...fieldInput, cursor: "pointer" }}
              value={schoolType}
              onChange={(e) => setSchoolType(e.target.value)}
              disabled={busy}
            >
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
              onChange={(e) => setCountryCode(e.target.value)}
              disabled={busy}
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
              {tr("layer.school.city")}
            </label>
            <input id="school-city" style={fieldInput} value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} disabled={busy} />
          </div>
          <div>
            <label htmlFor="school-phone" style={fieldLabel}>
              {tr("layer.school.phone")}
            </label>
            <input
              id="school-phone"
              style={fieldInput}
              type="tel"
              autoComplete="tel"
              value={phone}
              maxLength={40}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
            />
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
              disabled={busy}
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
      </div>

      {/* Plans — the submit */}
      <div style={{ borderTop: "1px solid #e6ecf3", marginTop: 8, paddingTop: 26 }}>
        <h2 style={{ ...heading, fontSize: 22 }}>{tr("layer.plans.heading")}</h2>
        <p style={{ ...sub, fontSize: 16, maxWidth: 540, marginInline: "auto", marginBottom: 20 }}>
          {tr("layer.plans.subA")} {SCHOOL_PILOT_DAYS}
          {tr("layer.plans.subB")}
        </p>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", alignItems: "start" }}>
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              open={openPlan === p.id}
              onOpen={() => {
                setOpenPlan(p.id);
                setError(null);
              }}
              onClose={() => {
                setOpenPlan(null);
                setError(null);
              }}
              effectif={effectif}
              setEffectif={setEffectif}
              busy={busy}
              error={openPlan === p.id ? error : null}
              onStart={() => start(p)}
            />
          ))}
        </div>
        {plans.length === 0 && (
          <p style={{ textAlign: "center", color: "#64748b", fontSize: 15 }}>{tr("layer.plans.unavailable")}</p>
        )}
        {error && !openPlan && <p style={{ color: "#dc2626", textAlign: "center", marginTop: 14, fontSize: 15 }}>{error}</p>}
      </div>
    </LayerShell>
  );
}

function PlanCard({
  plan,
  open,
  onOpen,
  onClose,
  effectif,
  setEffectif,
  busy,
  error,
  onStart,
}: {
  plan: LayerPlan;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  effectif: string;
  setEffectif: (v: string) => void;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const tr = useTranslate();
  const { locale } = useAppLocale();
  const perSeat = plan.priceUnit === "per_seat";
  const quoted = plan.price == null || plan.tier === "custom";
  const seats = Number(effectif);
  const validSeats = Number.isInteger(seats) && seats >= MIN_B2B_SEATS;

  // Same arithmetic as the Billing tab (lib/billing/terms.ts), so the figure
  // shown here is the figure the admin meets there after the pilot.
  const monthly = !quoted && validSeats ? (perSeat ? (plan.price as number) * seats : (plan.price as number)) : null;
  const yearly = monthly != null ? termTotal(monthly * 12, 12) : null;

  const priceLabel = quoted
    ? tr("school.billing.onQuote")
    : perSeat
      ? `$${plan.price} ${tr("school.billing.perStudentMoSuffix")}`
      : `$${plan.price} / ${tr("school.billing.mo")}`;

  return (
    <div
      style={{
        border: `1.5px solid ${open ? "#0b1220" : "#dde5ee"}`,
        borderRadius: 16,
        padding: 16,
        background: open ? "#ffffff" : "#fbfcfe",
        boxShadow: open ? "0 10px 28px rgba(11,18,32,0.10)" : "none",
        display: "flex",
        flexDirection: "column",
        transition: "border-color .15s, box-shadow .15s",
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700, color: "#0b1220" }}>{plan.name}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: WORDMARK_B, margin: "2px 0 10px" }}>{priceLabel}</div>
      <ul style={{ margin: "0 0 14px", padding: 0, listStyle: "none" }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ fontSize: 14, color: "#475569", marginBottom: 5, display: "flex", gap: 6, lineHeight: 1.45 }}>
            <span style={{ color: "#16a34a" }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {!open ? (
        <button type="button" onClick={onOpen} disabled={busy} style={{ ...primaryBtn, marginTop: "auto", padding: 12, fontSize: 15 }}>
          {tr("layer.plans.choose")}
        </button>
      ) : (
        <div style={{ marginTop: "auto" }}>
          <label htmlFor={`effectif-${plan.id}`} style={{ ...fieldLabel, fontSize: 14 }}>
            {tr("layer.plans.students")}
          </label>
          <input
            id={`effectif-${plan.id}`}
            style={{ ...fieldInput, marginBottom: 4 }}
            type="number"
            inputMode="numeric"
            min={MIN_B2B_SEATS}
            step={1}
            value={effectif}
            onChange={(e) => setEffectif(e.target.value)}
            disabled={busy}
          />
          <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#64748b" }}>
            {tr("layer.plans.minA")} {MIN_B2B_SEATS} {tr("layer.plans.minB")}
          </p>

          {/* The terms, stated before the button that accepts them. */}
          <div style={{ background: "#eef3f9", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "#0b1220", lineHeight: 1.55, marginBottom: 12 }}>
            <strong>
              {SCHOOL_PILOT_DAYS}
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
            <div style={{ color: "#475569", marginTop: 4 }}>
              {tr("layer.plans.after")}{" "}
              {quoted ? (
                tr("layer.plans.quote")
              ) : monthly != null && yearly != null ? (
                <>
                  <strong style={{ color: "#0b1220" }}>{money(monthly, locale)}</strong> {tr("layer.plans.perMonth")} {tr("layer.plans.or")}{" "}
                  <strong style={{ color: "#0b1220" }}>{money(yearly, locale)}</strong> {tr("layer.plans.perYear")}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 14, margin: "0 0 10px" }}>{error}</p>}
          <button type="button" onClick={onStart} disabled={busy} style={{ ...primaryBtn, marginTop: 0, padding: 12, fontSize: 15, opacity: busy ? 0.6 : 1 }}>
            {busy ? tr("layer.plans.starting") : `${tr("layer.plans.startA")}${SCHOOL_PILOT_DAYS}${tr("layer.plans.startB")}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{ background: "none", border: "none", width: "100%", marginTop: 8, fontSize: 14, fontWeight: 600, color: "#64748b", cursor: "pointer" }}
          >
            {tr("layer.plans.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
