/**
 * "next/navigation" stand-in for the Remotion bundle.
 *
 * A few app components import useRouter/usePathname for navigation that never
 * happens inside a video frame. The real module throws without an App Router;
 * this one hands out inert fakes so the components render.
 */
export function useRouter() {
  return {
    push() {},
    replace() {},
    back() {},
    forward() {},
    refresh() {},
    prefetch() {},
  };
}
export function usePathname() {
  return "/";
}
export function useSearchParams() {
  return new URLSearchParams();
}
export function useParams() {
  return {};
}
export function redirect() {
  throw new Error("redirect() is not available in the video bundle");
}
export function notFound() {
  throw new Error("notFound() is not available in the video bundle");
}
