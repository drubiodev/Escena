/** @type {import("../types.js").BlockDefinition} */
export default {
    type: "text",
    label: "Paragraph",
    category: "Text",
    // Resolve from this block folder, independent of the page that imports it.
    path: new URL("./index.html", import.meta.url).href,
    size: { w: 720, h: 180 },
    editable: "text",
    props: [
        { key: "text", label: "Text", type: "textarea", value: "Markup, behaviour and styles.\nOne file. That's the whole idea." },
        { key: "size", label: "Size", type: "range", value: "28", min: 12, max: 72, step: 1 },
        { key: "align", label: "Align", type: "select", value: "left", options: ["left", "center", "right"] },
        { key: "tone", label: "Tone", type: "select", value: "default", options: ["default", "accent", "muted"] },
        { key: "color", label: "Text color", type: "color", value: "" },
    ],
};
