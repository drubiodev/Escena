# Escena

A no-build presentation editor powered by LadrillosJS. The browser loads native
ES modules and HTML components directly. There is no backend, bundler, or install
step for the app.

## Run It

Run the VS Code task **serve Escena**, or from this folder:

```sh
npx serve
```

Open http://localhost:5500. Use an HTTP server rather than opening the editor as
a `file:` URL: component templates are fetched at runtime. LadrillosJS and Lucide
are pinned CDN imports, so the editor needs an internet connection on first load.

## Editor

- Slides: add blank, title, section, or two-column layouts; duplicate, delete,
	reorder by dragging, and jump through the slide sorter.
- Insert: the original heading, paragraph, image, QR, and video blocks. No new
	block types are included in this update.
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

## Presenting

Present starts at the selected slide. The player includes previous/next, an
overview, blackout, fullscreen, and an elapsed timer. Open the presenter window
for the current slide, next slide, and notes on a second screen. Allow popups when
prompted. Presenter controls use a session-specific BroadcastChannel; separate
editors cannot accidentally navigate each other's presentations.

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

[app/files.js](app/files.js) handles local files and playable snapshots. The HTML
export copies Ladrillos' adopted stylesheets into declarative shadow roots so
the result keeps its appearance without needing the editor runtime.

The original [blocks/index.js](blocks/index.js) catalog and all block files remain
unchanged. Add future blocks there using the existing folder-and-definition
pattern; the registry, palette, inspector, and renderer pick them up together.
