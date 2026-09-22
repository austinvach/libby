# Libby Downloader

Libby Downloader is a browser extension for Firefox and Microsoft Edge that allows for download and
transfer of audiobooks from the Libby website for transfer to devices that are now unsupported
(e.g. the Sansa Clip).

## Installation

### Firefox
Install Libby Downloader from the [Firefox Extension Store](https://addons.mozilla.org/en-US/firefox/extensions/).

 **Note: Minimum supported Firefox version is 102 ESR**

### Microsoft Edge
Edge uses a separate Manifest V3 build which is not published to the Edge Add-ons store, so it has to
be built and loaded as an unpacked extension:

1. `npm install`
2. `npm run build:edge` (output is written to `dist-edge/`)
3. Open `edge://extensions` and enable **Developer mode**
4. Click **Load unpacked** and select the `dist-edge` directory

Edge will ask you to approve the permissions the extension needs: reading and changing data on
`libbyapp.com` and `overdrive.com`, access to your downloads, access to browser tabs, and storage.

 **Note: Minimum supported Edge version is 116** (required for `world: "MAIN"` content scripts and
 offscreen documents)

## Disclaimer
Books downloaded by this tool are still due on their due date. This tool is **not** intended to help you "keep" your
borrowed books. The due date can be found in the filename and MP3 tags.

## Use
Navigate to a borrowed audiobook on [Libby](https://libbyapp.com) and open the extension.


<img src="ready.png" width="500" alt="Ready Screenshot"/>

Click the download button to begin downloading your audiobook.

<img src="complete.png" width="500" alt="Complete Screenshot"/>

Once finished, there will be a zip file in your downloads folder containing the processed mp3.

<img src="download.png" width="500" alt="Download Screenshot"/>

## Development

| Command | Description |
| --- | --- |
| `npm run build` | Production Firefox (Manifest V2) build into `dist/` |
| `npm start` | Watch build for Firefox |
| `npm run build:edge` | Production Edge (Manifest V3) build into `dist-edge/` |
| `npm run start:edge` | Watch build for Edge |
| `npm run package` | Build and zip the Firefox extension |
| `npm run package:edge` | Build and zip the Edge extension |
| `npm test` | Run the unit tests |
| `npm run lint` | Run eslint |

Both builds share the popup, state handling, and audiobook processing code. The differences are:

| | Firefox (`dist/`) | Edge (`dist-edge/`) |
| --- | --- | --- |
| Manifest | V2 (`static/manifest.json`) | V3 (`edge/manifest.json`) |
| Background | Persistent background page (`src/background.ts`) | Service worker (`src/background.edge.ts`) |
| Metadata capture | `webRequest.filterResponseData` | Content scripts (`src/content/`) that wrap `fetch`/`XMLHttpRequest` in the page and read `window.bData` |
| Download/processing | Background page | Offscreen document (`src/offscreen.ts`) |

Chromium based browsers have no equivalent of Firefox's `webRequest.filterResponseData`, and a
service worker can neither decode audio nor create the object url used to save the archive, which is
why the Edge build adds the content scripts and the offscreen document. The
`browser`/`chrome` namespace difference is handled by the shim in `src/browser.ts`.

### Edge caveats
* The extension is only loadable as an unpacked extension (or a self-signed package) since it isn't
  published to the Edge Add-ons store.
* Edge keeps the extension service worker alive only while it is doing work; leave the tab with the
  loan open until the download finishes.
* Edge does not support SVG icons, so the Edge build uses the PNG icon.

## Technical Details 
Like Overdrive, Libby hosts Audiobooks in multiple part files, and chapters can span multiple parts. The output
zip file contains a single mp3 created by merging all the parts and a cue file with the chapter boundaries 
in relation to this merged file (instead of their individual part file as Libby stores them).

### MP3 Tags
The MP3 is created with the following ID3v2 tags
* title: Audiobook Title `<title>: <subtitle> (<series>)`
* album: Audiobook Title `<title>: <subtitle> (<series>)`
* artist: Comma separated list of authors
* composer: Comma separated list of narrators
* image: Cover from Libby
* validUntil: Due date
* chapters: Embedded chapter locations

### Chapters 
If your device doesn't support embedded chapters via ID3v2 tags you can:

#### Split by Chapter
The mp3 can be split into a file per chapter by various tools which understand the accompanying cue file
or https://github.com/yermak/AudioBookConverter. 

#### Convert to M4B
The mp3 can be converted into an m4b file by using a tool like ffmpeg or https://github.com/yermak/AudioBookConverter
which do understand embedded chapter information.