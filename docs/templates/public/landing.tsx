import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public/nav";
import { PublicFooter } from "@/components/public/footer";
import { landing as T, serif, sans } from "@/components/public/theme";

function CloudBg() {
  return (
    <svg
      viewBox="0 0 1200 520"
      preserveAspectRatio="xMidYMin slice"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.skyTop} />
          <stop offset="55%" stopColor={T.skyMid} />
          <stop offset="100%" stopColor={T.skyBg} />
        </linearGradient>
      </defs>
      <rect width="1200" height="520" fill="url(#lg-sky)" />
      <g opacity="0.92">
        <ellipse cx="130" cy="130" rx="200" ry="145" fill="white" />
        <ellipse cx="290" cy="95" rx="165" ry="125" fill="white" />
        <ellipse cx="70" cy="180" rx="130" ry="90" fill="white" />
        <ellipse cx="220" cy="175" rx="175" ry="110" fill="white" />
        <ellipse cx="420" cy="150" rx="130" ry="105" fill="white" />
      </g>
      <g opacity="0.88">
        <ellipse cx="980" cy="90" rx="240" ry="155" fill="white" />
        <ellipse cx="1130" cy="60" rx="180" ry="130" fill="white" />
        <ellipse cx="880" cy="145" rx="160" ry="110" fill="white" />
        <ellipse cx="1060" cy="175" rx="210" ry="125" fill="white" />
      </g>
      <g opacity="0.55">
        <ellipse cx="560" cy="65" rx="115" ry="72" fill="white" />
        <ellipse cx="660" cy="48" rx="95" ry="62" fill="white" />
        <ellipse cx="610" cy="90" rx="135" ry="68" fill="white" />
      </g>
      <g opacity="0.3">
        <ellipse cx="750" cy="280" rx="280" ry="72" fill="white" />
        <ellipse cx="300" cy="340" rx="220" ry="55" fill="white" />
      </g>
    </svg>
  );
}

function Hero() {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: 580,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 24px 60px",
      }}
    >
      <CloudBg />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 640 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: T.tealLight,
            border: `1px solid ${T.tealBorder}`,
            borderRadius: 99,
            padding: "5px 14px",
            marginBottom: 24,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.teal, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: T.teal, letterSpacing: "0.04em" }}>
            Tuteur IA · K-12 · Cameroun & US
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(2.4rem,5.5vw,3.8rem)",
            fontWeight: 900,
            color: T.ink,
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            margin: "0 0 20px",
          }}
        >
          Le tuteur IA qui{" "}
          <em style={{ fontFamily: serif, fontStyle: "italic", color: T.teal }}>se souvient</em>
          <br />
          de chaque élève.
        </h1>

        <p style={{ fontSize: 15, color: T.inkSub, lineHeight: 1.65, maxWidth: 440, margin: "0 auto 36px" }}>
          RAYA adapte chaque session au profil cognitif réel de l&apos;élève — en solo, en groupe, en
          temps réel. Pas un chatbot. Un tuteur.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              background: T.ink,
              color: "white",
              borderRadius: 99,
              padding: "13px 26px",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>▶</span> Essayer gratuitement
          </Link>
          <Link
            href="/survey"
            style={{
              background: "rgba(255,255,255,0.8)",
              color: T.ink,
              border: `1px solid ${T.border}`,
              borderRadius: 99,
              padding: "13px 22px",
              fontSize: 13,
              fontWeight: 500,
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Participer au survey <span style={{ fontSize: 11 }}>→</span>
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 28 }}>
          <div style={{ display: "flex" }}>
            {["#6366f1", "#f97316", "#22c55e", "#ec4899", "#14b8a6"].map((c, i) => (
              <div
                key={c}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: c,
                  border: "2px solid white",
                  marginLeft: i > 0 ? -8 : 0,
                  fontSize: 9,
                  fontWeight: 700,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {["A", "J", "L", "P", "M"][i]}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11, color: T.inkSub }}>
            <strong style={{ color: T.ink }}>Les premiers élèves</strong> sont déjà sur RAYA
          </span>
        </div>
      </div>
    </section>
  );
}

function FeatureStrip() {
  const features = [
    { icon: "🧠", label: "Cognitive Kernel", desc: "Maîtrise par concept, pas par note globale" },
    { icon: "👥", label: "Study Rooms", desc: "Des élèves + RAYA en temps réel" },
    { icon: "🛠", label: "Tools Studio", desc: "Quiz, résumés, flashcards depuis un fichier" },
    { icon: "📊", label: "Dashboard école", desc: "Alertes prioritaires sans saisie manuelle" },
  ];
  return (
    <section
      style={{
        background: "white",
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: "24px 24px",
      }}
    >
      <div className="pub-grid-4" style={{ maxWidth: 900, margin: "0 auto" }}>
        {features.map((f) => (
          <div key={f.label} style={{ padding: "16px 24px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: T.inkSub, lineHeight: 1.45 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "L'élève ouvre RAYA",
      desc: "RAYA sait où il en est. Pas besoin de se présenter — elle reprend là où la dernière session s'est arrêtée.",
      color: T.teal,
    },
    {
      n: "02",
      title: "RAYA pose des questions",
      desc: "Elle ne donne pas la réponse. Elle guide par la méthode Socratique, adapte le niveau en temps réel, détecte les blocages.",
      color: T.violet,
    },
    {
      n: "03",
      title: "Le Kernel met à jour",
      desc: "Après chaque session, le Cognitive Kernel recalcule la maîtrise par concept. Le profil évolue silencieusement.",
      color: T.orange,
    },
    {
      n: "04",
      title: "Le prof voit tout",
      desc: "Le lendemain matin, le dashboard affiche : qui bloque, sur quoi, depuis combien de temps. Sans que le prof ait rien saisi.",
      color: T.teal,
    },
  ];

  return (
    <section style={{ padding: "80px 24px", background: `linear-gradient(180deg, white 0%, ${T.skyBg} 100%)` }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.teal,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Comment ça marche
          </p>
          <h2
            style={{
              fontSize: "clamp(1.8rem,3.5vw,2.6rem)",
              fontWeight: 900,
              color: T.ink,
              letterSpacing: "-0.03em",
              margin: "0 0 14px",
            }}
          >
            Un cycle qui s&apos;améliore{" "}
            <em style={{ fontFamily: serif, fontStyle: "italic" }}>à chaque session.</em>
          </h2>
          <p style={{ fontSize: 13, color: T.inkSub, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
            Chaque interaction élève enrichit le profil. Chaque profil améliore la session suivante.
          </p>
        </div>

        <div className="pub-grid-2">
          {steps.map((s) => (
            <div
              key={s.n}
              style={{
                background: "white",
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: "24px 28px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: s.color,
                  background: s.color + "18",
                  borderRadius: 8,
                  padding: "6px 10px",
                  flexShrink: 0,
                  letterSpacing: "0.04em",
                }}
              >
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: T.inkSub, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Differentiators() {
  const items = [
    { label: "ChatGPT / Claude", verdict: "Répond mais ne se souvient pas. Repart de zéro à chaque session.", bad: true },
    { label: "Khan Academy", verdict: "Parcours fixe. Si tu sors du script, tu es seul.", bad: true },
    { label: "NotebookLM", verdict: "Analyse des docs mais ne te challenge pas, ne mesure pas.", bad: true },
    { label: "RAYA", verdict: "Se souvient. S'adapte. Mesure. Et apprend de toi.", bad: false },
  ];
  return (
    <section style={{ padding: "72px 24px", background: "white" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2
            style={{
              fontSize: "clamp(1.6rem,3vw,2.4rem)",
              fontWeight: 900,
              color: T.ink,
              letterSpacing: "-0.03em",
              margin: "0 0 12px",
            }}
          >
            Pourquoi pas <em style={{ fontFamily: serif, fontStyle: "italic" }}>les autres ?</em>
          </h2>
          <p style={{ fontSize: 13, color: T.inkSub }}>
            La différence n&apos;est pas dans l&apos;IA. Elle est dans la mémoire.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => (
            <div
              key={it.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: it.bad ? "white" : T.tealLight,
                border: `1px solid ${it.bad ? T.border : T.tealBorder}`,
                borderRadius: 12,
                padding: "14px 18px",
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{it.bad ? "✗" : "✓"}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: it.bad ? T.inkSub : T.teal }}>{it.label}</span>
                <span style={{ fontSize: 12, color: T.inkMuted, marginLeft: 10 }}>—</span>
                <span style={{ fontSize: 12, color: it.bad ? T.inkMuted : T.teal, marginLeft: 6 }}>{it.verdict}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Élève",
      price: "Gratuit",
      period: "pour toujours",
      desc: "Pour commencer seul avec RAYA.",
      features: ["Sessions solo avec RAYA", "Study Rooms", "Tools (quiz, résumés, flashcards)", "Profil cognitif personnel"],
      cta: "Créer un compte",
      href: "/login",
      featured: false,
    },
    {
      name: "Classe",
      price: "$29",
      period: "/mois",
      desc: "Pour un prof et ses élèves.",
      features: [
        "Dashboard prof complet",
        "Rooms illimitées",
        "Alertes prioritaires",
        "Tous les formats Tools",
        "Connexion Google Classroom",
        "Rapports hebdomadaires",
      ],
      cta: "Démarrer l'essai",
      href: "/login",
      featured: true,
    },
    {
      name: "École",
      price: "Sur devis",
      period: "",
      desc: "Pour un établissement entier.",
      features: [
        "Multi-classes, multi-profs",
        "Insights & simulations par classe",
        "LMS intégration complète",
        "RAYA for Schools",
        "Rapports par matière / classe / école",
        "Support dédié",
      ],
      cta: "Parler à l'équipe",
      href: "/contact",
      featured: false,
    },
  ];

  return (
    <section id="tarifs" style={{ padding: "80px 24px", background: `linear-gradient(180deg, ${T.skyBg} 0%, #c8dde9 100%)` }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            style={{
              fontSize: "clamp(1.8rem,3.5vw,2.6rem)",
              fontWeight: 900,
              color: T.ink,
              letterSpacing: "-0.03em",
              margin: "0 0 10px",
            }}
          >
            Tarifs <em style={{ fontFamily: serif, fontStyle: "italic" }}>simples.</em>
          </h2>
          <p style={{ fontSize: 13, color: T.inkSub }}>Aucune surprise. L&apos;essai est vraiment gratuit.</p>
        </div>

        <div className="pub-grid-3">
          {plans.map((p) => (
            <div
              key={p.name}
              style={{
                background: p.featured ? T.ink : "white",
                border: `1px solid ${p.featured ? T.ink : T.border}`,
                borderRadius: 18,
                padding: "28px 24px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {p.featured && (
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: T.teal,
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: 99,
                    letterSpacing: "0.04em",
                  }}
                >
                  RECOMMANDÉ
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: p.featured ? "rgba(255,255,255,0.5)" : T.inkMuted,
                    marginBottom: 6,
                    letterSpacing: "0.06em",
                  }}
                >
                  {p.name.toUpperCase()}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span
                    style={{
                      fontSize: p.price === "Sur devis" ? 28 : 34,
                      fontWeight: 900,
                      color: p.featured ? "white" : T.ink,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {p.price}
                  </span>
                  {p.period && (
                    <span style={{ fontSize: 12, color: p.featured ? "rgba(255,255,255,0.4)" : T.inkMuted }}>
                      {p.period}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: p.featured ? "rgba(255,255,255,0.55)" : T.inkSub,
                    marginTop: 6,
                    lineHeight: 1.4,
                  }}
                >
                  {p.desc}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24, flex: 1 }}>
                {p.features.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span
                      style={{ color: p.featured ? T.teal : "#22c55e", fontSize: 13, flexShrink: 0, marginTop: 1 }}
                    >
                      ✓
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: p.featured ? "rgba(255,255,255,0.75)" : T.inkSub,
                        lineHeight: 1.4,
                      }}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href={p.href}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "center",
                  border: `1px solid ${p.featured ? "transparent" : T.border}`,
                  background: p.featured ? "white" : "transparent",
                  color: T.ink,
                  boxSizing: "border-box",
                  display: "block",
                }}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("account_state")
      .eq("id", user.id)
      .single();
    // Force first-run onboarding before anything else.
    if (profile && profile.account_state === "onboarding_pending") {
      redirect("/onboarding");
    }
  }

  return (
    <div style={{ fontFamily: sans, color: T.ink, minHeight: "100vh", background: "white" }}>
      <PublicNav signedIn={!!user} active="Produit" />
      <Hero />
      <FeatureStrip />
      <HowItWorks />
      <Differentiators />
      <Pricing />
      <PublicFooter />
    </div>
  );
}
