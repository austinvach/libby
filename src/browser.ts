/**
 * Cross browser WebExtension API access.
 *
 * Firefox exposes the promise based `browser` namespace, while Chromium based
 * browsers (Microsoft Edge) expose `chrome`, which is also promise based under
 * Manifest V3. Both are used through this single alias so that the same code
 * can be bundled for either browser.
 */
function resolve(): any {
  // @ts-ignore one of the two namespaces is provided by the browser
  return globalThis.browser ?? globalThis.chrome;
}

/**
 * Lazily resolved WebExtension API namespace
 */
export const api: any = new Proxy(
  {},
  {
    get(target: object, property: string) {
      const impl = resolve();
      return impl == undefined ? undefined : impl[property];
    }
  }
);

/**
 * Message commands used to proxy privileged API calls from contexts that
 * don't have direct access to them (e.g. the Edge offscreen document).
 */
export const STORAGE_GET = "storage-get";
export const STORAGE_SET = "storage-set";
export const DOWNLOAD = "download";

/**
 * Send a runtime message, ignoring "no receiver" style errors
 *
 * @param message Message to send
 */
export function sendMessage(message: any): Promise<any> {
  return Promise.resolve(api.runtime.sendMessage(message)).catch((error: Error) => {
    // no listener is registered in the receiving context, which is expected
    // for broadcast style messages
    if (!`${error}`.includes("Receiving end does not exist")) {
      console.error(error);
    }
    return undefined;
  });
}

function hasStorage(): boolean {
  const impl = resolve();
  return impl != undefined && impl.storage != undefined && impl.storage.local != undefined;
}

function hasDownloads(): boolean {
  const impl = resolve();
  return impl != undefined && impl.downloads != undefined;
}

/**
 * Read a key from local extension storage
 *
 * @param key Storage key
 */
export async function storageGet(key: string): Promise<any> {
  if (hasStorage()) {
    return api.storage.local.get(key);
  }
  return api.runtime.sendMessage({ cmd: STORAGE_GET, args: { key } });
}

/**
 * Write items to local extension storage
 *
 * @param items Items to store
 */
export async function storageSet(items: object): Promise<void> {
  if (hasStorage()) {
    await api.storage.local.set(items);
    return;
  }
  await api.runtime.sendMessage({ cmd: STORAGE_SET, args: { items } });
}

/**
 * Download a file
 *
 * @param options Download options (filename and url)
 */
export async function download(options: { filename: string; url: string }): Promise<void> {
  if (hasDownloads()) {
    await api.downloads.download(options);
    return;
  }
  await api.runtime.sendMessage({ cmd: DOWNLOAD, args: options });
}
