import { extractBookJson, handleBody, isTrackedUrl } from "../src/handlers";
import { LoadState } from "../src/state";

describe("url matching", () => {
  test("tracked urls are the ones with book metadata", () => {
    expect(isTrackedUrl("https://sentry-read.svc.overdrive.com/chip/sync")).toBe(true);
    expect(isTrackedUrl("https://sentry-read.svc.overdrive.com/media/1234")).toBe(true);
    expect(isTrackedUrl("https://dewey-1234.dewey.overdrive.com/?m=abcd")).toBe(true);
    expect(isTrackedUrl("https://libbyapp.com/open/loan/1234")).toBe(false);
    expect(isTrackedUrl("not a url at all")).toBe(false);
  });
});

describe("response body handling", () => {
  test("book json is extracted from the reader document", () => {
    const body = `<html><script>window.bData = {"title": {"main": "Book"}};</script></html>`;
    expect(extractBookJson(body).title.main).toBe("Book");
    expect(extractBookJson("<html></html>")).toBeNull();
  });

  test("sync body sets the loan expiration", () => {
    const state = new LoadState();
    state.id = "1234";
    const body = JSON.stringify({
      loans: [
        { id: "5678", expires: "2024-01-01T00:00:00.000Z" },
        { id: "1234", expires: "2024-06-01T00:00:00.000Z" }
      ]
    });
    expect(handleBody(state, "https://sentry-read.svc.overdrive.com/chip/sync", body)).toBe(true);
    expect(state.expires).toStrictEqual(new Date("2024-06-01T00:00:00.000Z"));
  });

  test("media body sets the cover location", () => {
    const state = new LoadState();
    state.id = "1234";
    const body = JSON.stringify({
      covers: { cover300Wide: { href: "https://covers/300" } }
    });
    expect(handleBody(state, "https://sentry-read.svc.overdrive.com/media/1234", body)).toBe(true);
    expect(state.cover_href).toBe("https://covers/300");
  });

  test("reader document sets title, creators and chapters", () => {
    const state = new LoadState();
    state.id = "1234";
    const bData = {
      title: { main: "Book", subtitle: "Subtitle", collection: "Series" },
      creator: [
        { role: "author", name: "Author" },
        { role: "narrator", name: "Narrator" }
      ],
      description: { full: "Description" },
      spine: [{ "-odread-original-path": "Part01.mp3", path: "path/Part01.mp3" }],
      nav: { toc: [{ title: "Chapter 1", path: "Part01.mp3#0" }] }
    };
    const body = `window.bData = ${JSON.stringify(bData)};`;
    const handled = handleBody(state, "https://dewey-1234.dewey.overdrive.com/?m=abcd", body);

    expect(handled).toBe(true);
    expect(state.title.title).toBe("Book");
    expect(state.authors).toStrictEqual(["Author"]);
    expect(state.narrators).toStrictEqual(["Narrator"]);
    expect(state.chapters[0].title).toBe("Chapter 1");
    expect(state.chapters[0].paths).toStrictEqual([
      "https://dewey-1234.dewey.overdrive.com/path/Part01.mp3"
    ]);
    expect(state.loaded()).toBe(false);
  });

  test("unrelated bodies are ignored", () => {
    const state = new LoadState();
    state.id = "1234";
    expect(handleBody(state, "https://libbyapp.com/open/loan/1234", "{}")).toBe(false);
  });
});
