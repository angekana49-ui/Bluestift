import type { Metadata } from "next";
import { Inter, Inter_Tight, Caveat, Instrument_Serif } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "900"],
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter-tight",
  weight: ["700", "800", "900"],
});

const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-caveat",
  weight: ["600", "700"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["italic"],
});

export const metadata: Metadata = {
  title: "BlueStift — RAYA, le tuteur IA qui se souvient de chaque élève",
  description:
    "RAYA adapte chaque session au profil cognitif réel de l'élève — en solo, en groupe, en temps réel. Pas un chatbot. Un tuteur.",
  keywords: ["tuteur IA", "education", "K-12", "cognitive kernel", "RAYA", "BlueStift"],
  openGraph: {
    title: "BlueStift — RAYA, le tuteur IA qui se souvient de chaque élève",
    description: "Le tuteur IA qui se souvient de chaque élève.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="day"
      className={`${inter.variable} ${interTight.variable} ${caveat.variable} ${instrumentSerif.variable}`}
    >
      <body className={inter.className}>{children}</body>
    </html>
  );
}
