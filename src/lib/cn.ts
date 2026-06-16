/** Minimal classnames joiner (clsx-lite) used by the UI primitives. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
