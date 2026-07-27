/**
 * The block manifest.
 *
 * One entry per block type. Everything else in the app is derived from this
 * file: component registration, the palette, the props a fresh block starts
 * with, the inspector form, and (later) the dispatcher that renders a block
 * without the canvas knowing its type.
 *
 * Adding a block type = one .html file in this folder + one entry here.
 *
 * Hard constraint: every `props[].key` must exist as a top-level `let` in the
 * component, or LadrillosJS never puts it in `observedAttributes` and the
 * attribute is silently ignored. Keys must also be lowercase and single-word,
 * because HTML lowercases attribute names.
 */

/** Resolve against THIS file, so the manifest can be imported from anywhere. */
const url = (path) => new URL(path, import.meta.url).href;

export const BLOCKS = [
    {
        type: "heading",
        tag: "e-heading",
        path: url("./heading.html"),
        label: "Heading",
        icon: "H",
        category: "Text",
        description: "The one thing the slide is about.",
        size: { w: 960, h: 190 },
        // Which prop double-click editing writes to.
        editable: "text",
        props: [
            { key: "text", label: "Text", type: "textarea", value: "Heading" },
            { key: "size", label: "Size", type: "range", value: 76, min: 24, max: 160, step: 2 },
            { key: "align", label: "Align", type: "select", value: "left", options: ["left", "center", "right"] },
            { key: "tone", label: "Tone", type: "select", value: "default", options: ["default", "accent", "muted"] },
        ],
    },
    {
        type: "text",
        tag: "e-text",
        path: url("./text.html"),
        label: "Paragraph",
        icon: "¶",
        category: "Text",
        size: { w: 720, h: 180 },
        editable: "text",
        props: [
            { key: "text", label: "Text", type: "textarea", value: "Some text." },
            { key: "size", label: "Size", type: "range", value: 32, min: 12, max: 72, step: 1 },
            { key: "weight", label: "Weight", type: "select", value: 400, options: [400, 600, 800] },
            { key: "align", label: "Align", type: "select", value: "left", options: ["left", "center", "right"] },
            { key: "tone", label: "Tone", type: "select", value: "default", options: ["default", "accent", "muted"] },
        ],
    },
];

export const BLOCK_MAP = new Map(BLOCKS.map((block) => [block.type, block]));

/** The props a freshly inserted block of `type` starts with. */
export function defaults(type)
{
    const def = BLOCK_MAP.get(type);
    if (!def) return {};
    return Object.fromEntries(def.props.map((p) => [p.key, p.value]));
}

/**
 * A whole block object, ready to push into a slide.
 *
 * `patch` overrides geometry and/or individual props; anything it omits comes
 * from the manifest, so a caller never has to restate a full prop set.
 */
export function createBlock(type, patch = {})
{
    const def = BLOCK_MAP.get(type);
    if (!def) throw new Error(`[Escena] unknown block type "${type}"`);

    const { props, ...geometry } = patch;

    return {
        id: crypto.randomUUID(),
        type,
        x: 160,
        y: 160,
        w: def.size.w,
        h: def.size.h,
        ...geometry,
        props: { ...defaults(type), ...props },
    };
}
