import { isTrackedUrl } from "../urls";
import { BODY_MESSAGE } from "./protocol";

/**
 * Page (MAIN world) content script used by the Microsoft Edge build.
 *
 * Chromium based browsers have no equivalent of Firefox's
 * `webRequest.filterResponseData`, so response bodies are captured by wrapping
 * `fetch` and `XMLHttpRequest` in the page itself. Captured bodies are posted
 * to the isolated world bridge which forwards them to the service worker.
 */
function postBody(url: string, body: string): void {
  if (!url || !body) {
    return;
  }
  window.postMessage({ source: BODY_MESSAGE, url: new URL(url, window.location.href).href, body }, "*");
}

function wrapFetch(): void {
  const originalFetch = window.fetch;
  window.fetch = async function (...args: any[]): Promise<Response> {
    // @ts-ignore variadic passthrough to the original implementation
    const response = await originalFetch.apply(this, args);
    try {
      const input = args[0];
      const url = response.url || (typeof input === "string" ? input : input?.url);
      if (url && isTrackedUrl(url)) {
        response
          .clone()
          .text()
          .then((body) => postBody(url, body))
          .catch(() => undefined);
      }
    } catch (e) {
      // never break the page because of the extension
    }
    return response;
  };
}

function wrapXhr(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  // @ts-ignore variadic passthrough to the original implementation
  XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
    // @ts-ignore stash the url so it can be read when the request completes
    this.__libbyUrl = url;
    this.addEventListener("load", () => {
      try {
        if (isTrackedUrl(url) && typeof this.responseText === "string") {
          postBody(url, this.responseText);
        }
      } catch (e) {
        // responseText throws for non text response types, ignore
      }
    });
    // @ts-ignore variadic passthrough to the original implementation
    return originalOpen.call(this, method, url, ...rest);
  };
}

/**
 * The Libby reader document embeds its metadata in `window.bData` instead of
 * exposing it over an interceptable request, so read it directly.
 */
function reportBookData(attempt = 0): void {
  // @ts-ignore page global set by the Libby reader
  const bData = window.bData;
  if (bData) {
    postBody(window.location.href, `window.bData = ${JSON.stringify(bData)};`);
  } else if (attempt < 60) {
    setTimeout(() => reportBookData(attempt + 1), 500);
  }
}

wrapFetch();
wrapXhr();
reportBookData();
