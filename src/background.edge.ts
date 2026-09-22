import { Command, Task } from "./common";
import { addTask, LoadState, updateTask } from "./state";
import { handleBody } from "./handlers";
import { api, DOWNLOAD, sendMessage, STORAGE_GET, STORAGE_SET, storageSet } from "./browser";

/**
 * Background service worker for the Microsoft Edge (Manifest V3) build.
 *
 * Service workers can't create object urls or decode audio, so the actual
 * download and processing work happens in an offscreen document. This worker
 * collects the book metadata captured by the content scripts and drives the
 * offscreen document.
 */
const OFFSCREEN_DOCUMENT = "offscreen.html";

let stateTask: string;
let stateCheckCounter = 1;
let state: LoadState = new LoadState();
let running = false;
let merge = true;
let decode = false;

api.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (response?: any) => void) => {
  if (!message || !message.cmd) {
    return false;
  }
  switch (message.cmd) {
    case "start":
      start(message as Command).catch(handleError);
      return false;
    case "body":
      handleCapturedBody(message.args.url, message.args.body);
      return false;
    case "process-complete":
      state = new LoadState();
      running = false;
      closeOffscreenDocument().catch(console.error);
      return false;
    case "process-failed":
      handleError(new Error(message.args ? message.args.error : "Processing failed"));
      closeOffscreenDocument().catch(console.error);
      return false;
    case STORAGE_GET:
      api.storage.local.get(message.args.key).then(sendResponse, console.error);
      return true;
    case STORAGE_SET:
      api.storage.local.set(message.args.items).then(() => sendResponse({}), console.error);
      return true;
    case DOWNLOAD:
      api.downloads.download(message.args).then(() => sendResponse({}), console.error);
      return true;
    default:
      return false;
  }
});

/**
 * Handle the start command from the popup
 *
 * @param command Command
 */
async function start(command: Command) {
  stateCheckCounter = 1;
  running = false;
  // @ts-ignore
  merge = command.args["merge"];
  // @ts-ignore
  decode = command.args["decode"];
  state = new LoadState();
  // Clear active tasks
  await storageSet({ "tasks": [] });
  const reloadTask = await addTask(new Task("", "Reloading Tab", "Running"));
  const tabs = await api.tabs.query({ currentWindow: true, active: true });
  const tab = tabs[0];
  if (tab && tab.url) {
    const path = tab.url.split("/");
    state.id = path[path.length - 1];
  }
  console.log(`Reloading current tab for loan ${state.id}`);
  await api.tabs.reload(tab.id);
  await updateTask(reloadTask, "Completed");
  stateTask = await addTask(new Task("", "Waiting for State", "Waiting"));
}

/**
 * Handle a response body captured by the content scripts
 *
 * @param url Url the body was loaded from
 * @param body Response body
 */
function handleCapturedBody(url: string, body: string) {
  if (state.id == undefined || running) {
    return;
  }
  try {
    if (handleBody(state, url, body)) {
      runIfLoaded();
    }
  } catch (e) {
    handleError(e);
  }
}

/**
 * Check if state is loaded and hand processing off to the offscreen document
 * if the state is loaded and a download isn't running already.
 */
function runIfLoaded(): void {
  if (!state.loaded()) {
    stateCheckCounter += 1;
    updateTask(stateTask, `Check ${stateCheckCounter}`).catch(handleError);
    console.log(`Still waiting for state ${JSON.stringify(state)}`);
    return;
  }
  console.log(`State loaded ${JSON.stringify(state)}`);
  updateTask(stateTask, "Completed").catch(handleError);
  if (running) {
    console.log("Already running");
    return;
  }
  running = true;
  process().catch(handleError);
}

/**
 * Start the download/processing task in the offscreen document
 */
async function process() {
  await createOffscreenDocument();
  await sendMessage({
    cmd: "process",
    args: { state, merge, decode }
  });
}

/**
 * Create the offscreen document if it doesn't exist already
 */
async function createOffscreenDocument() {
  if (api.offscreen.hasDocument && (await api.offscreen.hasDocument())) {
    return;
  }
  try {
    await api.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT,
      reasons: ["BLOBS", "AUDIO_PLAYBACK"],
      justification: "Merge, tag, and download audiobook part files"
    });
  } catch (e) {
    // a document may have been created by a concurrent call
    if (!`${e}`.includes("Only a single offscreen")) {
      throw e;
    }
  }
}

async function closeOffscreenDocument() {
  if (api.offscreen.hasDocument && !(await api.offscreen.hasDocument())) {
    return;
  }
  await api.offscreen.closeDocument();
}

function handleError(error: Error) {
  state = new LoadState();
  running = false;
  console.log(`Error: ${error}`);
  addTask(new Task("Error", `${error}`, "Failed")).catch(console.error);
}
