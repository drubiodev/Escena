/** @type {import("../types.js").BlockDefinition} */
export default {
    type: "qr",
    label: "QR Code",
    category: "Media",
    path: new URL("./index.html", import.meta.url).href,
    size: { w: 360, h: 360 },
    props: [
        { key: "content", label: "Content", type: "textarea", value: "https://example.com" },
        { key: "dark", label: "Foreground", type: "color", value: "#111111" },
        { key: "light", label: "Background", type: "color", value: "#ffffff" },
        { key: "margin", label: "Quiet zone", type: "number", value: "4", min: 0, max: 8, step: 1 },
        { key: "caption", label: "Caption", type: "text", value: "Scan to open" },
        { key: "accent", label: "Accent", type: "color", value: "#d2500f" },
        { key: "shadow", label: "Shadow", type: "toggle", value: "on" },
    ],
};