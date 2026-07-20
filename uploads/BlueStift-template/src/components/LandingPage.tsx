import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import DifferentiatorsSection from "./DifferentiatorsSection";
import InboxSection from "./InboxSection";
import PricingSection from "./PricingSection";
import Footer from "./Footer";
import Reveal from "./Reveal";

export interface SiteConfig {
  brand: {
    name: string;
    tagline: string;
    description: string;
  };
  hero: {
    headline: string;
    subheadline: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  features: {
    sectionHeadline: string;
    sectionSub: string;
    items: {
      icon: string;
      title: string;
      description: string;
      stats?: { label: string; value: string; color: string }[];
    }[];
  };
  differentiators: {
    sectionHeadline: string;
    sectionSub: string;
    items: { label: string; verdict: string; bad: boolean }[];
  };
  inbox: {
    headline: string;
    highlightedWord: string;
    description: string;
    bullets: { title: string; description: string }[];
    threads: {
      initials: string;
      name: string;
      preview: string;
      status?: string;
      statusColor?: "blue" | "gray" | "orange" | "yellow" | "";
    }[];
  };
  pricing: {
    headline: string;
    highlightedWord: string;
    subheadline: string;
    plans: {
      name: string;
      price?: string;
      period?: string;
      description: string;
      features: string[];
      cta: string;
      recommended?: boolean;
      custom?: boolean;
    }[];
  };
  stats: {
    sessionsToday: string;
    sessionsTrend: string;
    studentsBlocked: string;
    blockedTrend: string;
    avgMastery: string;
    masteryTrend: string;
    activeStudents: string;
    activeTrend: string;
  };
}

export const defaultConfig: SiteConfig = {
  brand: {
    name: "BlueStift",
    tagline: "RAYA · Tuteur IA K-12",
    description:
      "BlueStift construit RAYA, le tuteur IA qui se souvient de chaque élève — pour les classes du Cameroun aux États-Unis.",
  },
  hero: {
    headline: "Le tuteur IA qui se souvient de chaque élève.",
    subheadline:
      "RAYA adapte chaque session au profil cognitif réel de l'élève — en solo, en groupe, en temps réel. Pas un chatbot. Un tuteur.",
    ctaPrimary: "Essayer gratuitement",
    ctaSecondary: "Voir comment ça marche",
  },
  features: {
    sectionHeadline: "Construit pour les élèves qui ont besoin de plus qu'un chatbot.",
    sectionSub:
      "Trois surfaces qui travaillent ensemble. Aucune ne demande à être gérée. La plateforme, c'est l'absence de dashboard à surveiller.",
    items: [
      {
        icon: "K",
        title: "Cognitive Kernel",
        description:
          "La maîtrise se mesure par concept, pas par note globale. Le profil de chaque élève évolue silencieusement après chaque session.",
        stats: [
          { label: "Maths", value: "78%", color: "#22c55e" },
          { label: "Français", value: "64%", color: "#4f46e5" },
          { label: "Sciences", value: "91%", color: "#22c55e" },
        ],
      },
      {
        icon: "S",
        title: "Study Rooms",
        description:
          "Des élèves et RAYA en temps réel, pour réviser ensemble ou débloquer un exercice à plusieurs.",
        stats: [
          { label: "Rooms actives", value: "12", color: "#4f46e5" },
          { label: "Élèves", value: "340", color: "#4f46e5" },
          { label: "Cette semaine", value: "+18%", color: "#22c55e" },
        ],
      },
      {
        icon: "T",
        title: "Tools Studio",
        description: "Quiz, résumés et flashcards générés depuis un simple fichier ou une leçon.",
        stats: [
          { label: "Quiz créés", value: "1 204", color: "#173d8a" },
          { label: "Résumés", value: "860", color: "#173d8a" },
          { label: "Flashcards", value: "3 400", color: "#173d8a" },
        ],
      },
    ],
  },
  differentiators: {
    sectionHeadline: "Pourquoi pas les autres ?",
    sectionSub: "La différence n'est pas dans l'IA. Elle est dans la mémoire.",
    items: [
      { label: "ChatGPT / Claude", verdict: "Répond mais ne se souvient pas. Repart de zéro à chaque session.", bad: true },
      { label: "Khan Academy", verdict: "Parcours fixe. Si tu sors du script, tu es seul.", bad: true },
      { label: "NotebookLM", verdict: "Analyse des documents mais ne te challenge pas, ne mesure pas.", bad: true },
      { label: "RAYA", verdict: "Se souvient. S'adapte. Mesure. Et apprend de toi.", bad: false },
    ],
  },
  inbox: {
    headline: "RAYA ne repart jamais de",
    highlightedWord: "zéro.",
    description:
      "Chaque session enrichit le profil cognitif de l'élève. Le lendemain, RAYA sait exactement où reprendre — et le prof voit tout, sans rien saisir.",
    bullets: [
      {
        title: "Elle pose des questions, pas des réponses",
        description: "La méthode Socratique guide l'élève et détecte les blocages en temps réel.",
      },
      {
        title: "Le Kernel apprend en continu",
        description: "Après chaque session, la maîtrise par concept est recalculée silencieusement.",
      },
      {
        title: "Le prof voit tout le lendemain matin",
        description: "Qui bloque, sur quoi, depuis combien de temps — sans saisie manuelle.",
      },
    ],
    threads: [
      { initials: "MR", name: "Maya · 3ème", preview: "A débloqué les fractions après 3 sessions guidées par le Kernel.", status: "Maîtrisé", statusColor: "blue" },
      { initials: "JT", name: "Jonas · Tle", preview: "Bloque encore sur les limites de fonctions, 4ème session sur le sujet.", status: "À surveiller", statusColor: "orange" },
      { initials: "AO", name: "Aiko · 5ème", preview: "Session Study Room terminée avec deux camarades de classe.", status: "", statusColor: "" },
      { initials: "RC", name: "Refik · 4ème", preview: "Quiz généré automatiquement depuis son cours de SVT.", status: "Terminé", statusColor: "gray" },
      { initials: "EC", name: "Elena · 2nde", preview: "RAYA a détecté un décrochage sur la trigonométrie ce matin.", status: "Nouveau", statusColor: "yellow" },
    ],
  },
  pricing: {
    headline: "Des tarifs",
    highlightedWord: "qui restent simples.",
    subheadline: "Un plan par taille d'équipe. L'essai est vraiment gratuit, quatorze jours, sans carte.",
    plans: [
      {
        name: "Élève",
        price: "Gratuit",
        period: "pour toujours",
        description: "Pour commencer seul avec RAYA.",
        features: ["Sessions solo avec RAYA", "Study Rooms", "Tools (quiz, résumés, flashcards)", "Profil cognitif personnel", "Support par email"],
        cta: "Créer un compte",
      },
      {
        name: "Classe",
        price: "$29",
        period: "/mois",
        description: "Pour un prof et ses élèves.",
        features: [
          "Dashboard prof complet",
          "Rooms illimitées",
          "Alertes prioritaires",
          "Tous les formats Tools",
          "Connexion Google Classroom",
          "Rapports hebdomadaires",
        ],
        cta: "Démarrer l'essai",
        recommended: true,
      },
      {
        name: "École",
        description: "Pour un établissement entier.",
        features: [
          "Multi-classes, multi-profs",
          "Insights et simulations par classe",
          "Intégration LMS complète",
          "RAYA for Schools",
          "Rapports par matière, classe, école",
          "Support dédié",
        ],
        cta: "Parler à l'équipe",
        custom: true,
      },
    ],
  },
  stats: {
    sessionsToday: "482",
    sessionsTrend: "+21% vs le mois dernier",
    studentsBlocked: "6",
    blockedTrend: "-2 depuis ce matin",
    avgMastery: "83%",
    masteryTrend: "+12 points ce mois",
    activeStudents: "1 204",
    activeTrend: "+340 cette semaine",
  },
};

export default function LandingPage({ config = defaultConfig }: { config?: SiteConfig }) {
  return (
    <div className="bluestift-root min-h-screen bg-transparent font-sans">
      <Navbar config={config} active="Produit" />
      <Reveal>
        <HeroSection config={config} />
      </Reveal>
      <Reveal delay={80}>
        <FeaturesSection config={config} />
      </Reveal>
      <Reveal delay={120}>
        <DifferentiatorsSection config={config} />
      </Reveal>
      <Reveal delay={160}>
        <InboxSection config={config} />
      </Reveal>
      <Reveal delay={200}>
        <PricingSection config={config} />
      </Reveal>
      <Reveal delay={240}>
        <Footer config={config} />
      </Reveal>
    </div>
  );
}
