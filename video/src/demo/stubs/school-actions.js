/**
 * "@/app/school/actions" stand-in for the Remotion bundle.
 *
 * The real module is server actions (next/cache, supabase server, cookies) —
 * nothing a browser bundle can evaluate. The video renders school screens
 * with demo data and never switches schools, so the action is an inert async.
 */
export async function setActiveSchool() {}
