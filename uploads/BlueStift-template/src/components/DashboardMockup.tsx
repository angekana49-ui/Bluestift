import type { SiteConfig } from "./LandingPage";

const dashTabs = [
  { label: "Aperçu", active: true },
  { label: "Sessions", active: false },
  { label: "Élèves", active: false },
  { label: "Kernel", active: false },
  { label: "Flux", active: false },
];

const barData = [
  { month: "Jan", messenger: 6000, sales: 4000, revenue: 2000 },
  { month: "Fév", messenger: 7500, sales: 5500, revenue: 3000 },
  { month: "Mar", messenger: 5000, sales: 6000, revenue: 4000 },
  { month: "Avr", messenger: 8000, sales: 5000, revenue: 3500 },
  { month: "Mai", messenger: 9000, sales: 7000, revenue: 5000 },
  { month: "Juin", messenger: 11000, sales: 9000, revenue: 7000 },
  { month: "Juil", messenger: 8500, sales: 10000, revenue: 6000 },
  { month: "Août", messenger: 10000, sales: 8000, revenue: 5500 },
];
const maxVal = 12000;

export default function DashboardMockup({ config }: { config: SiteConfig }) {
  const { stats } = config;

  const statCards = [
    { label: "Sessions aujourd'hui", value: stats.sessionsToday, trend: stats.sessionsTrend, tone: "emerald", shineDelay: "0s" },
    { label: "Élèves bloqués", value: stats.studentsBlocked, trend: stats.blockedTrend, tone: "slate", shineDelay: "1.2s" },
    { label: "Maîtrise moyenne", value: stats.avgMastery, trend: stats.masteryTrend, tone: "slate", shineDelay: "2.4s" },
    { label: "Élèves actifs", value: stats.activeStudents, trend: stats.activeTrend, tone: "emerald", shineDelay: "3.6s" },
  ];

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_40px_100px_rgba(15,23,42,0.18)] sm:rounded-[34px] text-left">
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200/80 bg-white/80 px-3 py-3 sm:px-4">
        <div className="flex min-w-max items-center gap-1.5">
          {dashTabs.map((tab) => (
            <span
              key={tab.label}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-medium whitespace-nowrap sm:px-3.5 sm:text-[11px] ${
                tab.active ? "bg-slate-950 text-white" : "text-slate-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tab.active ? "bg-white/75" : "bg-slate-300"}`} />
              {tab.label}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-400">
            Rechercher élèves, classes...
          </span>
          <span className="h-8 w-8 rounded-full border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 flex items-center justify-center">
            EM
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.75fr_1fr] lg:p-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5 min-w-0">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-slate-950">Aperçu pédagogique</h2>
              <p className="mt-1 text-xs text-slate-500">Signaux en temps réel sur toutes les classes suivies.</p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-medium text-slate-600">7 jours</span>
              <span className="rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-medium text-white">Partager</span>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2.5">
            {statCards.map((s) => (
              <div key={s.label} className="relative overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50/80 p-3.5">
                <div className="bluestift-shine" style={{ animationDelay: s.shineDelay }} />
                <p className="relative text-[10px] text-slate-500">{s.label}</p>
                <p className="relative mt-1 text-[20px] font-semibold tracking-tight text-slate-950">{s.value}</p>
                <p className={`relative mt-1 text-[9px] ${s.tone === "emerald" ? "text-emerald-500" : "text-slate-400"}`}>{s.trend}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-tight text-slate-950">Sessions vs maîtrise</p>
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { label: "Sessions", color: "#4f46e5" },
                  { label: "Quiz", color: "#f97316" },
                  { label: "Maîtrise", color: "#22c55e" },
                ].map((i) => (
                  <div key={i.label} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: i.color }} />
                    <span className="text-[10px] text-slate-400">{i.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex h-32 items-end gap-1.5 sm:h-36">
              {barData.map((d) => {
                const active = d.month === "Jun";
                return (
                  <div key={d.month} className="flex flex-1 flex-col items-center gap-1 h-full">
                    <div className="flex h-[116px] w-full items-end gap-1">
                      <div
                        className="flex-1 rounded-t-md"
                        style={{
                          height: `${(d.messenger / maxVal) * 100}%`,
                          background: active ? "linear-gradient(180deg,#8b5cf6,#4f46e5)" : "linear-gradient(180deg,#e7e9ff,#dfe3fb)",
                        }}
                      />
                      <div
                        className="flex-1 rounded-t-md"
                        style={{
                          height: `${(d.sales / maxVal) * 100}%`,
                          background: active ? "linear-gradient(180deg,#fb923c,#f97316)" : "linear-gradient(180deg,#ffe7d4,#fde4cf)",
                        }}
                      />
                      <div
                        className="flex-1 rounded-t-md"
                        style={{
                          height: `${(d.revenue / maxVal) * 100}%`,
                          background: active ? "linear-gradient(180deg,#4ade80,#22c55e)" : "linear-gradient(180deg,#e0f8ea,#d8f3e3)",
                        }}
                      />
                    </div>
                    <span className="text-[8px] text-slate-300">{d.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[9px] font-medium text-white">
                Juin 2026 <span className="opacity-60">—</span> <span className="text-orange-300">Maîtrise en hausse</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 animate-float-sm">
            <div className="bluestift-shine" style={{ animationDuration: "6.5s" }} />
            <div className="rounded-[16px] bg-slate-50 p-3">
              <p className="text-[11px] leading-5 text-slate-500">Tu bloques encore sur les fractions ?</p>
              <p className="mt-1 text-[11px] font-medium text-slate-950">Essayons autrement.</p>
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-semibold text-white animate-pulse-soft">
                AI
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-950">Suggestions de RAYA</p>
                <p className="text-[11px] text-slate-500">Propose une explication adaptée en quelques secondes.</p>
              </div>
            </div>
            <div className="mt-3.5 rounded-[16px] border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-950">Génération en cours...</span>
                <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-emerald-400" />
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[68%] rounded-full bg-slate-950" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 animate-float-sm" style={{ animationDelay: "0.6s" }}>
            <div className="bluestift-shine" style={{ animationDuration: "7s", animationDelay: "1.5s" }} />
            <div className="mb-3.5 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-950">Maîtrise du Kernel</p>
              <span className="text-[10px] text-slate-400">Mis à jour à l'instant</span>
            </div>
            <svg viewBox="0 0 160 96" className="w-full h-auto block">
              <defs>
                <linearGradient id="gaugeFill" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="55%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              <path d="M 20 84 A 60 60 0 0 1 140 84" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
              <path d="M 20 84 A 60 60 0 0 1 140 84" fill="none" stroke="url(#gaugeFill)" strokeWidth="12" strokeLinecap="round" strokeDasharray="188" strokeDashoffset="50" />
              <text x="80" y="64" textAnchor="middle" fontSize="24" fontWeight="700" fill="#0f172a">1 204</text>
              <text x="80" y="79" textAnchor="middle" fontSize="8" fill="#94a3b8">élèves suivis</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
