/** @type {import("../types.js").BlockDefinition} */
export default {
    type: "shape",
    label: "Shapes",
    category: "Shapes",
    // Resolve from this block folder, independent of the page that imports it.
    path: new URL("./index.html", import.meta.url).href,
    size: { w: 720, h: 180 },
    props: [
        { key: "shapeType", label: "Shape", type: "select", value: "square", options: ["square", "circle", "triangle"] },
        { key: "color", label: "Shape color", type: "color", value: "#eee" },
        { key: "shadow", label: "Shadow", type: "toggle", value: "off" },
    ],
};
