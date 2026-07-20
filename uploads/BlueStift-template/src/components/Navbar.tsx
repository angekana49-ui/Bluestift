import Image from "next/image";
import Link from "next/link";
import type { SiteConfig } from "./LandingPage";
import NavbarControls from "./NavbarControls";

// Shared site pills. Every page passes its own `active` label so the
// current section highlights, and an optional `section` renders next to
// the logo (e.g. "· Research").
export const NAV_LINKS = [
  { label: "Produit", href: "/" },
  { label: "Research", href: "/research" },
  { label: "Survey", href: "/survey" },
  { label: "Tarifs", href: "/#pricing" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar({
  config,
  active,
  section,
}: {
  config: Pick<SiteConfig, "brand">;
  active?: string;
  section?: string;
}) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 pt-3">
      <div className="bluestift-nav mx-auto flex max-w-6xl items-center justify-between rounded-full border px-2 py-2 shadow-[0_14px_50px_rgba(15,23,42,0.08)] sm:px-3">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/bluestift-mark.png"
            alt={config.brand.name}
            width={46}
            height={30}
            className="rounded-full object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <span className="block text-sm font-extrabold tracking-tight leading-tight font-display">
              <span style={{ color: "#173d8a" }}>Blue</span>
              <span style={{ color: "#2f7fe0" }}>Stift</span>
              {section && <span className="ml-1 font-normal text-solid opacity-60">· {section}</span>}
            </span>
            <span className="block text-[10px] leading-tight text-solid">{config.brand.tagline}</span>
          </div>
        </Link>

        <NavbarControls links={NAV_LINKS} active={active} />

        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="text-solid text-xs px-3 py-2 bg-transparent border-none cursor-pointer">
            Se connecter
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)] transition-colors hover:bg-slate-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Essai gratuit
          </button>
        </div>
      </div>
    </nav>
  );
}
