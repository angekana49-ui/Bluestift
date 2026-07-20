import Link from "next/link";

/**
 * Preview harness index. Throwaway routes to build the app screens in isolation
 * with mock data — no auth, no backend. NOT linked from the app; delete the
 * whole `app/(preview)` group before shipping if you want.
 */
export default function PreviewIndex() {
  const screens = [
    ["RAYA (student app)", "/preview/raya"],
    ["Schools (admin/teacher app)", "/preview/school"],
    ["Onboarding (join via code)", "/preview/onboarding"],
    ["Rooms screen (contract stub)", "/preview/rooms"],
  ];
  return (
    <main style={{ padding: 32, maxWidth: 640, margin: "0 auto" }}>
      <h1>Preview harness</h1>
      <p style={{ opacity: 0.6 }}>Écrans app rendus avec des mocks, sans backend.</p>
      <ul>
        {screens.map(([label, href]) => (
          <li key={href}>
            <Link href={href}>{label}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
