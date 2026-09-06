/** @type {import("../types.js").BlockDefinition} */
export default {
    type: "video",
    label: "Video",
    category: "Media",
    path: new URL("./index.html", import.meta.url).href,
    size: { w: 760, h: 470 },
    props: [
        {
            key: "src",
            label: "Video URL",
            type: "text",
            value: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        },
        { key: "poster", label: "Poster URL", type: "text", value: "" },
        { key: "fit", label: "Fit", type: "select", value: "cover", options: ["cover", "contain"] },
        { key: "controls", label: "Controls", type: "toggle", value: "on" },
        { key: "autoplay", label: "Autoplay", type: "toggle", value: "off" },
        { key: "loop", label: "Loop", type: "toggle", value: "off" },
        { key: "muted", label: "Muted", type: "toggle", value: "on" },
        { key: "shadow", label: "Shadow", type: "toggle", value: "on" },
    ],
};