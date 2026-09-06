/** @type {import("../types.js").BlockDefinition} */
export default {
    type: "image",
    label: "Image",
    category: "image",
    // Resolve from this block folder, independent of the page that imports it.
    path: new URL("./index.html", import.meta.url).href,
    size: { w: 720, h: 180 },
    props: [
        { key: "src", label: "Image Source", type: "image", value: "" },
        { key: "alt", label: "Alt Text", type: "input", value: "" },
        { key: "shadow", label: "Shadow", type: "toggle", value: "off" },
    ],
};
