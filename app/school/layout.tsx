import type { Metadata } from "next";

/**
 * Schools' own tab title.
 *
 * Every signed-in route except /chat falls through to the root layout's default
 * title, which is the bare product name — so `schools.thebluestift.com` opened a
 * tab reading "Bluestift" while `raya.` read "Raya", and the one origin whose
 * whole purpose is the staff-facing product was the one that didn't say so.
 *
 * `absolute` opts out of the root's "%s · Bluestift" template: the name of this
 * product IS "Bluestift Schools" (the same string `sendBrandedEmail` puts in the
 * From line for the schools brand), not a page called "Schools" inside
 * something else.
 *
 * Deliberately NOT here, unlike app/chat/layout.tsx: `manifest`, `icons` and
 * `appleWebApp`. Raya overrides those because it is a second installable app —
 * its own mark, its own launch screens. Schools is not: lib/manifest.ts states
 * the split as "a student installs Raya; a school installs Bluestift", and
 * lib/launch-screens.ts names the Bluestift bird as Schools' artwork. Giving
 * this route a third install identity on the same icons would contradict both,
 * and test/pwa-manifest.test.ts pins that two apps never share an icon set.
 * A tab title is about the surface you are looking at; an install identity is
 * about the app you installed. They are allowed to differ.
 *
 * This layout exists only to carry that title; it renders its children
 * untouched.
 */
export const metadata: Metadata = {
  title: { absolute: "Bluestift Schools" },
};

export default function SchoolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
