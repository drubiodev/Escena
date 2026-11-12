# Escena

A no-build presentation editor powered by LadrillosJS. The browser loads native
ES modules and HTML components directly. There is no backend, bundler, or install
step for the app.

## Run It

Run the VS Code task **serve Escena**, or from this folder:

```sh
node scripts/serve.mjs
```

Open http://localhost:5500. The server has no dependencies; set `PORT` to change
the port. Any other static server works too, except the phone remote then needs its
network address typed in by hand (see Phone Remote). Use an HTTP server rather than
opening the editor as a `file:` URL: component templates are fetched at runtime.
LadrillosJS and Lucide are pinned CDN imports, so the editor needs an internet
connection on first load.

## Editor

- Slides: add blank, title, section, or two-column layouts; duplicate, delete,
	reorder by dragging, and jump through the slide sorter.
- Insert: heading, paragraph, image, QR, video, live Ladrillos components, and
	code snippets.
- Canvas: drag, resize, rotate, snap to slide or sibling edges, align, restack,
	duplicate, delete, and zoom. Double-click text to edit it in place.
- Design: slide names and backgrounds, four deck-wide themes, block properties,
	and a layer list for selecting overlapping blocks.
- Notes: speaker notes are saved with each slide.
- History: undo/redo keeps up to 80 edits in memory; rapid typing is grouped.

On a small screen the slide strip moves below the canvas. The sliders button
opens the design panel. The inspector provides numeric geometry controls when
precise pointer editing is awkward.

## Files And Saving

The current deck autosaves to `escena.studio.v1` in localStorage. This is one draft
per browser origin, not cloud storage or a multi-document library. History does
not survive a reload. Browser quotas vary, especially with embedded images; the
header reports save failures while the in-memory deck remains downloadable.

The File menu provides:

- **Download deck:** editable `.escena.json`, including notes and image data URLs.
- **Open presentation:** validates JSON before replacing the current deck. Undo
	restores the previous document. Files are limited to 20 MB, 500 slides, and
	500 blocks per slide; unknown block types are rejected.
- **Export playable HTML:** a standalone visual snapshot with keyboard navigation
	and fullscreen. It preserves shadow styles and converts QR canvases to images.
	Text, QR codes, and embedded images work without the editor; linked images and
	videos still require their original URLs. Videos use native player controls.
	Custom block scripts are not carried into snapshots.

This is a PowerPoint-style editor, not a `.pptx` importer or exporter. Files from
the reference app work only when they use registered Escena block types; unsupported
types produce a clear error rather than disappearing silently.

## Code Snippets

Choose **Insert > Code snippet** to display code without executing it. Select a
language in Properties; both the Monaco editor and slide highlighting follow
that selection. The block includes a filename header, optional line numbers,
dark/light themes, adjustable font size, and a shadow toggle. Long snippets
scroll rather than shrinking the text or changing its whitespace.

Highlight.js loads from a pinned CDN on first use. If it cannot load, the snippet
remains readable as plain text. Use the Ladrillos component block instead when
you want to run a component, not display its source.

## Ladrillos Components

The Ladrillos block runs component HTML, styles, and scripts with LadrillosJS
2.1.3. Component names are generated internally. Plain `<script>` variables,
expressions, event handlers, `$bind`, and directives use the real framework.
Select a Ladrillos block and click **Interact** at the top-right of the canvas
to use its inputs, buttons, and other controls. Click **Done** to return to
moving and resizing it. Selecting another block also ends interaction mode.
The inspector offers outer-frame border and shadow toggles, corner radius,
background color, and content inset. The default 10% inset reserves room
for rotation and animation; set it to 0 for edge-to-edge content. These options
do not override backgrounds, borders, or shadows authored inside your component.
Module scripts can import from `ladrillosjs` or an absolute, CORS-enabled URL.
Relative imports need a hosted URL; this editor does not provide a multi-file
component filesystem.

Each preview runs in an isolated iframe. `localStorage` and `sessionStorage`
provide in-memory storage for that preview only, reset when its source is rebuilt.
Components cannot access the editor's document, saved decks, or origin storage.
Other origin-restricted browser APIs remain subject to the iframe sandbox.
Framework and script errors appear inside the preview. CDN loading requires a
network connection.

### Slide Runtime Cache

The editor, presentation player, and each presenter preview retain up to five
recently visited slides per surface. Returning to a cached slide preserves its
component state without rerunning its scripts. Changing a block's type or props
rebuilds that block; moving or resizing it, changing notes, and changing the slide
background or deck theme do not. Older slides are evicted as needed, deleted
slides are removed, and ending a presentation clears its player and presenter
caches. Editor and presentation runtimes remain separate.

Hidden slides are inert. Playing videos pause while hidden and resume on return.
Embedded Ladrillos media and running animations also pause. Custom background
work, such as timers or network requests, is not automatically suspended:
components can read `window.escenaActive` initially and listen on `window` for
`escena:activity`, whose `event.detail.active` indicates whether to resume or
pause their work. The editor's components become inactive during presentation.

## Presenting

Present starts at the selected slide and goes fullscreen (Escape or the fullscreen
button leaves it). The player includes previous/next, an
overview, blackout, fullscreen, and an elapsed timer. Open the presenter window
for the current slide, next slide, and notes on a second screen. Allow popups when
prompted. Presenter controls use a session-specific BroadcastChannel; separate
editors cannot accidentally navigate each other's presentations.

### Phone Remote

Use the phone button in the toolbar or player to turn your phone into a light
remote: it shows the current slide's notes, the next slide's title, and the
timer, with Previous, Next, and Blackout buttons. It never receives the deck.
While nothing is presenting, a **Start presentation** button begins the show from
the current slide. Browsers only allow fullscreen from a click or key press on the
computer, so a phone-started show is not fullscreen; press F on the computer.
Tap **Edit notes** to change the current slide's notes from the phone; edits are
saved to that slide on the computer a moment after you stop typing (and appear in
its notes box and undo history). The Previous/Next buttons are hidden while editing.

Pairing is serverless. Escena shows a QR code; scan it with the phone camera,
then hold the code the phone displays up to the computer's webcam (or paste it).
The devices then talk directly over a WebRTC data channel, so they must share a
network (the same Wi-Fi, or your phone's hotspot; some venue Wi-Fi isolates
devices). There is no STUN/TURN server.

When Escena is served by `scripts/serve.mjs` (the **serve Escena** task), the dialog
fills in this computer's network address automatically. With another server on
`localhost`, enter the address yourself (for example `http://192.168.1.20:5500`) so
the phone can load `remote.html`. QR encoding and decoding load pinned CDN libraries
(`qrcode-generator`, `jsqr`), and the phone needs internet access for the former.

### Loading Speed

Slides that have been shown stay mounted for the rest of the session, so going
back to a slide, or presenting again, never reloads its Ladrillos components. The
neighbouring slides are mounted offscreen when the browser is idle, and hovering
Present warms the opening slides. A component's state therefore survives between
presentations until the page is reloaded. Unused block types register when idle.

`index.html` preloads the LadrillosJS and Lucide entry modules. The browser follows
their imports, so upgrading LadrillosJS only means changing the version in the import
map and in the matching `modulepreload` link.

## Keyboard

| Action | Shortcut |
| --- | --- |
| Undo / redo | Command/Ctrl Z / Command/Ctrl Shift Z |
| Download / open | Command/Ctrl S / Command/Ctrl O |
| Duplicate selection or slide | Command/Ctrl D |
| New blank slide | Command/Ctrl M |
| Copy / cut / paste block | Command/Ctrl C / X / V |
| Nudge selected block | Arrow keys; Shift for 10 px |
| Navigate slides with nothing selected | Arrow keys |
| Reorder a focused thumbnail | Alt + Up / Down |
| Delete selected block | Delete / Backspace |
| Free dragging without snapping | Hold Alt / Option |
| Cancel inline edit or drag | Escape |
| Finish inline edit | Command/Ctrl Enter or click outside |
| Present from start / current slide | F5 / Shift F5 |
| Next / previous during presentation | Arrows, Page Down / Up, Space |
| First / last during presentation | Home / End |
| Blackout / fullscreen / overview | B / F / G |
| Exit presentation | Escape |

## How The Pieces Fit

Start in [app/boot.js](app/boot.js). It registers the block catalog, restores the
deck, exposes the `window.Escena` bridge, and registers Ladrillos components.

The normal editing loop is:

```text
HTML component or keyboard shortcut
	-> escena:command
	-> commands.js routes the action
	-> store.js updates the document, history, and local draft
	-> escena:change
	-> canvas, inspector, thumbnails, and shell refresh
```

[app/store.js](app/store.js) owns the document. All document changes pass through
`commit()`. Navigation, selection, and presentation mode are tab state, not deck
content. Import validation constructs a complete replacement before committing.

[app/renderer.js](app/renderer.js) creates frames and registered block elements.
The same renderer serves the canvas, thumbnails, presenter, player, and exports.
Preview rendering suppresses media autoplay without changing saved block props.

[app/canvas.js](app/canvas.js) previews pointer moves directly in the DOM, then
commits once on release. This is why one drag produces one undo entry. Geometry
is always stored in 1280 x 720 slide coordinates, independent of viewport zoom.

[app/editor.js](app/editor.js) handles the shell and thumbnail list.
[app/inspector.js](app/inspector.js) builds property controls from block schemas.
Both keep focused inputs and unchanged previews alive during edits.

[app/presentation.js](app/presentation.js) owns playback. The separate
[app/presenter.js](app/presenter.js) is only a remote control: it receives snapshots
and sends navigation commands, never saves or edits the deck.
[app/remote-link.js](app/remote-link.js) is the WebRTC pairing and messaging layer
behind the phone remote ([remote.html](remote.html), [app/phone-dialog.js](app/phone-dialog.js)).

[app/files.js](app/files.js) handles local files and playable snapshots. The HTML
export copies Ladrillos' adopted stylesheets into declarative shadow roots so
the result keeps its appearance without needing the editor runtime.

## Creating Blocks

See the [block development guide](blocks/README.md) for a complete quote-block
example, catalog registration, inspector property types, inline editing,
styling, persistence, runtime limits, and a testing checklist.

## Search And Sharing

The editor entry page includes a descriptive title, search description, Open
Graph and Twitter sharing text, and Schema.org `WebApplication` JSON-LD. The
session-only presenter page uses `noindex`; this is not an access control.
Structured data describes existing features and does not guarantee rich results.

Before a public launch:

- Confirm the production HTTPS URL, then add an absolute canonical URL,
	`og:url`, and the application's structured-data `url`. Do not use localhost
	or guess a domain. Redirect alternate public URLs to the canonical version.
- Publish a product screenshot using a sample deck, not private slide content,
	and add absolute `og:image` and `twitter:image` URLs with descriptive image
	alt text. Use `summary_large_image` once the image is available.
- Add a sitemap of canonical public pages and reference it from `robots.txt`.
	Exclude the presenter page from the sitemap, but allow crawlers to fetch its
	`noindex` directive. Verify the site in Google Search Console and Bing
	Webmaster Tools, then submit the sitemap.
- Build useful, public comparison pages for people evaluating Google Slides
	and Microsoft PowerPoint alternatives. Explain Escena's code demos, local
	drafts and HTML exports honestly, including the lack of cloud collaboration
	and `.pptx` import/export. Keep the editor as the homepage experience.
- Validate deployed structured data and social previews, and measure real-user
	Core Web Vitals. Metadata alone will not establish competitive rankings;
	useful indexed content and reputable inbound links also matter.
