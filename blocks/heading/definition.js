/** @type {import("../types.js").BlockDefinition} */
export default {
    type: "heading",
    label: "Heading",
    category: "Text",
    // Resolve from this block folder, independent of the page that imports it.
    path: new URL("./index.html", import.meta.url).href,
    size: { w: 960, h: 190 },
    editable: "text",
    props: [
        { key: "text", label: "Text", type: "input", value: "A heading" },
        { key: "size", label: "Size", type: "range", value: "76", min: 24, max: 160 },
    ],
};
