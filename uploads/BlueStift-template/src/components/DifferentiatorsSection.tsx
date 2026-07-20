import type { SiteConfig } from "./LandingPage";

// Comparison strip: what makes RAYA different from generic chatbots and
// fixed-path courseware. Reuses the same card / pill vocabulary as the rest
// of the page (rounded-2xl, slate borders, emerald "good" accent).
export default function DifferentiatorsSection({ config }: { config: SiteConfig }) {
  const { differentiators } = config;

  return (
    <section className="relative py-24 px-4 sm:px-6 bg-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2
            className="mx-auto max-w-2xl font-display font-black tracking-tight leading-[1.08] text-primary"
            style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.6rem)" }}
          >
            {differentiators.sectionHeadline.split(" ").slice(0, -1).join(" ")}{" "}
            <em className="font-accent not-italic italic">
              {differentiators.sectionHeadline.split(" ").slice(-1)}
            </em>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-solid">{differentiators.sectionSub}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          {differentiators.items.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3.5 rounded-2xl border px-5 py-4"
              style={{
                borderColor: item.bad ? "rgba(226,232,240,0.9)" : "rgba(34,197,94,0.35)",
                background: item.bad ? "white" : "rgba(34,197,94,0.06)",
              }}
            >
              <span
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{
                  background: item.bad ? "#f1f5f9" : "#22c55e",
                  color: item.bad ? "#94a3b8" : "white",
                }}
              >
                {item.bad ? "✕" : "✓"}
              </span>
              <div className="min-w-0 flex-1">
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: item.bad ? "#475569" : "#16a34a" }}
                >
                  {item.label}
                </span>
                <span className="ml-2 text-xs text-slate-400">—</span>
                <span className="ml-1.5 text-xs" style={{ color: item.bad ? "#94a3b8" : "#166534" }}>
                  {item.verdict}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
