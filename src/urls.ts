/**
 * Url matching shared by the background page and the content scripts.
 *
 * Kept free of other imports so the page world content script used by the
 * Microsoft Edge build stays small.
 */

/**
 * Check whether a url is one the extension needs the response body of
 *
 * @param url Request url
 */
export function isTrackedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname.endsWith("/sync") ||
      parsed.pathname.includes("/media/") ||
      (parsed.host.startsWith("dewey-") && parsed.pathname === "/")
    );
  } catch (e) {
    return false;
  }
}
