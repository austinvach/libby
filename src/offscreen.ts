import { LoadState } from "./state";
import { mp3WithCUE } from "./processor/mp3-with-cue";
import { mp3Parts } from "./processor/mp3-parts";
import { api, sendMessage } from "./browser";

/**
 * Offscreen document used by the Microsoft Edge (Manifest V3) build to run the
 * download and processing work that a service worker can't perform, such as
 * decoding audio and creating object urls for the downloaded archive.
 */
api.runtime.onMessage.addListener((message: any) => {
  if (!message || message.cmd !== "process") {
    return false;
  }
  process(message.args).catch((error) => {
    console.log(error);
    sendMessage({ cmd: "process-failed", args: { error: `${error}` } });
  });
  return false;
});

/**
 * Restore a load state that was serialized over the messaging API.
 *
 * Only the `expires` date needs reviving, the nested title and chapter objects
 * are plain data and are used as such by the processors.
 *
 * @param serialized Serialized load state
 */
function reviveState(serialized: any): LoadState {
  const state = Object.assign(new LoadState(), serialized);
  state.expires = new Date(serialized.expires);
  return state;
}

async function process(args: { state: any; merge: boolean; decode: boolean }) {
  const state = reviveState(args.state);
  if (args.merge) {
    console.log("Merging files and parsing chapters");
    await mp3WithCUE(state, args.decode);
  } else {
    console.log("Downloading files directly");
    await mp3Parts(state);
  }
  await sendMessage({ cmd: "process-complete" });
}
