import { LoadState, Title } from "./state";
import { parseToc } from "./processor/utils";
export { isTrackedUrl } from "./urls";

/**
 * Extract the book metadata JSON embedded in a Libby reader document
 *
 * @param rsp Document body
 */
export function extractBookJson(rsp: string): any {
  // find the line with "window.bData" and match json string within
  const regex = /window\.bData\s*=\s*({.*});/g;
  const match = regex.exec(rsp);
  if (!match) {
    return null;
  }
  const json = match[1];
  return JSON.parse(json);
}

/**
 * Parse the loan expiration out of a sync response body
 *
 * @param state Load state to populate
 * @param body Response body
 */
export function parseSync(state: LoadState, body: string): void {
  const syncState = JSON.parse(body);
  for (const i in syncState.loans) {
    if (syncState.loans[i].id === state.id) {
      state.expires = new Date(syncState.loans[i].expires);
    }
  }
}

/**
 * Parse the cover location out of a media response body
 *
 * @param state Load state to populate
 * @param body Response body
 */
export function parseMedia(state: LoadState, body: string): void {
  const bookMedia = JSON.parse(body);
  if (bookMedia.covers["cover300Wide"]) {
    state.cover_href = bookMedia.covers["cover300Wide"].href;
  } else if (bookMedia.covers["cover150Wide"]) {
    state.cover_href = bookMedia.covers["cover150Wide"].href;
  } else if (bookMedia.covers["cover510Wide"]) {
    state.cover_href = bookMedia.covers["cover510Wide"].href;
  }
}

/**
 * Parse title, creators, and table of contents out of a reader document
 *
 * @param state Load state to populate
 * @param url Url the document was loaded from
 * @param body Document body
 */
export function parseTitle(state: LoadState, url: string, body: string): void {
  const responseJson = extractBookJson(body);
  const title = responseJson.title;
  state.title = new Title(title.main, title.subtitle, title.collection ?? "");

  const authors = [];
  const narrators = [];
  for (const i in responseJson.creator) {
    const creator = responseJson.creator[i];
    if (creator.role === "author") {
      authors.push(creator.name);
    } else if (creator.role === "narrator") {
      narrators.push(creator.name);
    }
  }

  state.authors = authors;
  state.narrators = narrators;

  if (responseJson.short) {
    state.description = responseJson.description.short;
  } else if (responseJson.description.full) {
    state.description = responseJson.description.full;
  }

  const requestUrl = new URL(url);
  const spine = new Map();
  for (const i in responseJson.spine) {
    spine.set(
      responseJson.spine[i]["-odread-original-path"],
      `${requestUrl.protocol}//${requestUrl.host}/${responseJson.spine[i].path}`
    );
  }

  state.chapters = parseToc(spine, responseJson.nav.toc);
}

/**
 * Route a captured response body to the matching parser
 *
 * @param state Load state to populate
 * @param url Url the body was loaded from
 * @param body Response body
 * @returns true if the body was handled
 */
export function handleBody(state: LoadState, url: string, body: string): boolean {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith("/sync")) {
    parseSync(state, body);
  } else if (parsed.pathname.endsWith(`/media/${state.id}`)) {
    parseMedia(state, body);
  } else if (parsed.host.startsWith("dewey-") && parsed.pathname === "/") {
    // the /?m= req
    parseTitle(state, url, body);
  } else {
    return false;
  }
  return true;
}
