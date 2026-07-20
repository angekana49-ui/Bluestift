import Image from "next/image";
import Link from "next/link";
import type { SiteConfig } from "./LandingPage";

const columns: { label: string; links: [string, string][] }[] = [
  {
    label: "Produit",
    links: [
      ["RAYA", "/"],
      ["Study Rooms", "/"],
      ["Tools Studio", "/"],
      ["Écoles", "/contact"],
    ],
  },
  {
    label: "Projet",
    links: [
      ["Research", "/research"],
      ["Survey", "/survey"],
      ["Contribuer", "/research?tab=collaborations"],
    ],
  },
  {
    label: "Ressources",
    links: [
      ["Contact", "/contact"],
      ["Feedback", "/feedback"],
      ["Se connecter", "/"],
    ],
  },
];

export default function Footer({ config }: { config: Pick<SiteConfig, "brand"> }) {
  return (
    <footer className="bluestift-footer pt-14 pb-8 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 grid gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="mb-4 flex items-center gap-2.5">
              <Image src="/bluestift-mark.png" alt={config.brand.name} width={44} height={44} className="rounded-full object-cover" />
              <span className="font-display text-sm font-extrabold">
                <span style={{ color: "#173d8a" }}>Blue</span>
                <span style={{ color: "#2f7fe0" }}>Stift</span>
              </span>
            </div>
            <p className="max-w-[240px] text-[11px] leading-relaxed text-solid">{config.brand.description}</p>
          </div>

          {columns.map((col) => (
            <div key={col.label}>
              <p className="mb-3 text-[11px] font-semibold text-primary">{col.label}</p>
              <div className="flex flex-col gap-2">
                {col.links.map(([label, href]) => (
                  <Link key={label} href={href} className="text-[11px] text-solid">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--footer-border)" }}>
          <p className="text-[10px] text-solid">© 2026 {config.brand.name}. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-solid">hello@thebluestift.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
