# Creating Blocks

Escena blocks are LadrillosJS HTML components with a small JavaScript definition.
The definition supplies the palette entry, default dimensions, saved properties,
and inspector controls. No build step or editor-specific form is needed.

This guide adds a quote block. Work from the Escena repository root and serve it
over HTTP using the **serve Escena** VS Code task. Reload after changing the catalog.

## 1. Create a Block Folder

Use the same two-file structure as [heading](heading/definition.js) and
[text](text/definition.js):

```text
blocks/
  quote/
    definition.js
    index.html
```

## 2. Define the Block

Put this in the new folder's definition file:

```js
export default {
    type: "quote",
    label: "Quote",
    category: "Text",
    icon: "Quote",
    path: new URL("./index.html", import.meta.url).href,
    size: { w: 800, h: 280 },
    editable: "text",
    props: [
        { key: "text", label: "Quote", type: "textarea", value: "Make something worth sharing." },
        { key: "author", label: "Author", type: "text", value: "Your name" },
        { key: "size", label: "Font size", type: "range", value: "40", min: 18, max: 80, step: 1 },
        { key: "color", label: "Text color", type: "color", value: "" },
    ],
};
```

| Field | Contract |
| --- | --- |
| `type` | Unique, stable lowercase key. Use letters and hyphens; Escena registers the element as `quote-block`. Saved decks reference this key. |
| `label`, `category` | Palette label and grouping. |
| `icon` | Optional Lucide icon name, such as `Quote` or `FileCode2`. |
| `path` | Component URL. Resolve it with `import.meta.url`, not the editor page's location. |
| `size` | Starting width and height in logical slide pixels. Slides are 1280 x 720; the canvas handles scaling and placement. |
| `editable` | Optional property updated by inline text editing. Pair it with one `data-editable` element in the template. |
| `props` | Inspector schema and defaults. Declare every property that must survive deck import. |

## 3. Write the Component

Put this in the new folder's HTML file:

```html
<figure class="quote" style="color:{color}">
    <blockquote data-editable style="font-size:{size}px">{text}</blockquote>
    <figcaption>{author}</figcaption>
</figure>

<style>
    :host {
        display: block;
        width: 100%;
        height: 100%;
    }

    * { box-sizing: border-box; }

    .quote {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 16px;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 24px 32px;
        border-left: 6px solid var(--s-accent);
        color: var(--s-fg);
        font-family: var(--s-font);
    }

    blockquote {
        margin: 0;
        line-height: 1.25;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }

    figcaption {
        color: var(--s-muted);
        font-size: 20px;
        overflow-wrap: anywhere;
    }

    :host([data-empty]) blockquote::before {
        content: "Enter quote";
        color: var(--s-muted);
    }

    :host([data-empty]) blockquote:focus::before {
        content: none;
    }
</style>
```

The renderer passes schema properties as attributes; Ladrillos makes them
available to template expressions such as `{text}`. This example needs no script.
Shadow DOM is enabled by default, so styles stay local while CSS custom
properties inherit from the slide. Use `--s-fg`, `--s-muted`, `--s-accent`, and
`--s-font` to follow the selected theme.

The empty `color` default leaves the stylesheet's theme color in effect until a
custom color is chosen. The author keeps the muted theme color independently.
Escena sets `data-empty` on the host when the inline-editable property is empty;
the pseudo-element displays a placeholder without saving it as content.

Let the host fill its frame. Do not position the block on the slide or apply
canvas zoom yourself. Test small frames and long text; choose deliberate wrapping,
overflow, or scrolling behavior when content exceeds the available space.

## 4. Add It to the Catalog

In [index.js](index.js), add the import and append `quote` to the existing array.
Keep all the other imports and entries:

```js
import quote from "./quote/definition.js";

export const BUILT_IN_BLOCKS = [heading, text, image, qr, video, ladrillos, code, quote];
```

On reload, [boot.js](../app/boot.js) registers the definitions before loading the
deck, then registers the HTML components. The palette, inspector, and renderer
use this same catalog. Choose **Insert > Quote** to try the new block.

## Inspector Controls

Every property has a `key`, `label`, `type`, and default `value`.

| Type | Behavior and extra fields |
| --- | --- |
| `text` | Single-line input. The older `input` spelling is also accepted. |
| `textarea` | Multiline text. |
| `lines` | Taller multiline input; its value is still a string, not an array. |
| `select` | Dropdown with string `options`, for example `["left", "center", "right"]`. |
| `color` | Native color picker; use a hex default, or an empty default with a CSS fallback. |
| `number` | Numeric input; optional `min`, `max`, and `step`. |
| `range` | Slider; set `min`, `max`, and optionally `step`. |
| `toggle` | Checkbox whose stored values are `"on"` and `"off"`, not booleans. |
| `image` | URL input plus an image-file chooser. Files up to 1.5 MB become data URLs. |
| `code` | Monaco editor. Defaults to HTML; set `languageKey` to a language-select property's key to synchronize its language. Changes commit after a 300 ms debounce. |

See [the registry](../app/registry.js) for normalization and
[the inspector](../app/inspector.js) for the implemented controls. Numeric inputs
also produce strings; convert and clamp values when using them in scripts.

## Scripts and Saved State

- Use lowercase property keys. HTML lowercases attributes, so a key such as
  `lineNumbers` reaches component script state as `linenumbers`.
- An empty attribute can appear as `true` in Ladrillos script state. When reading
  an optional string in a script, normalize it, for example
  `const source = code === true ? "" : String(code);`.
- For computed DOM or browser APIs, use a component script and `$ref` elements
  accessed through `$refs`. See [the QR component](qr/index.html) and
  [the code component](code/index.html) for working examples.
- Scripts may use `type="module"` and import nearby helpers. Keep helpers and
  assets in the block folder and test URL resolution through the HTTP server.
- Treat ordinary content as text. Use text bindings or `textContent`; do not
  inject user-supplied markup into `innerHTML` without appropriate sanitization.
- Keep persistent state in declared props and make document changes through the
  store. Component-local variables are not saved and can reset on rerender.
  Inspector and inline edits already use the store, including undo and autosave.
- Keep type and property keys stable. New property defaults are supplied during
  import, undeclared props are dropped, and unknown block types are rejected.
  Sharing a deck does not install its custom block code: recipients need an
  Escena version with that block registered.

## Rendering and Runtime Limits

The same block renders on the editing canvas, thumbnails, presentation view,
presenter, and HTML snapshot export. Keep rendering cheap and avoid unexpected
network requests, autoplay, or global side effects. Preview rendering forces
declared `autoplay` and `muted` properties to `"off"` and `"on"`, respectively.

Playable HTML exports preserve rendered markup and shadow styles, not custom
block scripts. A static quote works in a snapshot; do not expect custom event
handlers or reactive behavior to survive export. External assets still need
their URLs to remain accessible.

Registered block scripts run in the editor's context; they are trusted extension
code, not sandboxed plugins. The built-in [Ladrillos block](ladrillos/index.html)
is different: it runs user-authored components inside a sandboxed iframe. Its
canvas **Interact / Done** mode is specific to that block type, not automatically
enabled for every custom block. Prefer a static block for slide content; plan
explicit editor integration if a new block needs interactive controls.

## Verify Your Block

1. Insert it from the palette and exercise every inspector control.
2. Double-click its editable text, change it, and finish with Command/Ctrl+Enter.
   Check empty text, multiple lines, and long words.
3. Resize it, change slide themes, and inspect both desktop and mobile layouts.
4. Check undo/redo, duplication, autosave after reload, and deck download/import.
5. Check thumbnails, presentation, the presenter window, and playable HTML export.
   Test unavailable external assets if your block uses any.
6. Add focused defaults and persistence coverage to
   [the store tests](../tests/store.test.mjs), using the existing `setup()` helper.

Run the current regression tests from the repository root:

```sh
node --experimental-vm-modules --test tests/store.test.mjs tests/shortcuts.test.mjs
```

These Node tests cover store and shortcut behavior, not browser rendering.
Use a browser to verify the component itself and check its console for errors.