import { BODY_MESSAGE } from "./protocol";
import { sendMessage } from "../browser";

/**
 * Isolated world content script used by the Microsoft Edge build.
 *
 * Relays response bodies captured by the page world interceptor to the
 * background service worker, which has no way of reading them itself.
 */
window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) {
    return;
  }
  const data = event.data;
  if (!data || data.source !== BODY_MESSAGE) {
    return;
  }
  sendMessage({
    cmd: "body",
    args: { url: data.url, body: data.body }
  });
});
