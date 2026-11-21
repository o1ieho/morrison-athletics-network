// Where to send someone after staff sign-in. The "next" value comes from the
// URL, so anyone can craft a login link: only same-site paths are allowed.

const BASE = "https://x.invalid";

/**
 * Returns `next` as a same-site path ("/operator/abc?x=1"), or `fallback`.
 * Rejects absolute URLs, protocol-relative "//host", backslashes (browsers
 * read "/\host" as "//host"), encoded backslashes, and control characters.
 */
export function safeNext(next: string | null | undefined, fallback = "/operator"): string {
  if (!next || !next.startsWith("/")) return fallback;
  // A literal or percent-encoded backslash, or any control/whitespace character.
  if (/[\\\s\x00-\x1f\x7f]|%5c/i.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
