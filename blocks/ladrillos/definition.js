const starterCode = `<article class="demo-card">
    <span class="eyebrow">LIVE COMPONENT</span>
    <h1>Hello from LadrillosJS</h1>
    <p>Edit this component in the inspector and watch it render.</p>
</article>

<style>
    :host {
        display: grid;
        min-height: 100%;
        place-items: center;
        font-family: system-ui, sans-serif;
    }

    .demo-card {
        max-width: 34rem;
        padding: 2.5rem;
        border: 1px solid #d8d2c8;
        border-radius: 8px;
        background: #fffdf8;
        box-shadow: 0 18px 48px rgb(38 31 24 / 16%);
    }

    .eyebrow {
        color: #d2500f;
        font: 700 0.75rem/1 ui-monospace, monospace;
    }

    h1 {
        margin: 0.75rem 0;
        color: #24211e;
        font-size: clamp(2rem, 7vw, 4.5rem);
        line-height: 0.95;
    }

    p {
        margin: 0;
        color: #6f675f;
        font-size: 1rem;
        line-height: 1.5;
    }
</style>`;

/** @type {import("../types.js").BlockDefinition} */
export default {
    type: "ladrillos",
    label: "Ladrillos component",
    category: "Code",
    path: new URL("./index.html", import.meta.url).href,
    size: { w: 800, h: 460 },
    renderThumbnail: false,
    props: [
        { key: "code", label: "Component source", type: "code", value: starterCode },
        { key: "background", label: "Preview background", type: "color", value: "#f4f0e8" },
        { key: "border", label: "Border", type: "toggle", value: "on" },
        { key: "shadow", label: "Shadow", type: "toggle", value: "on" },
        { key: "radius", label: "Corner radius", type: "range", value: "6", min: 0, max: 40, step: 1 },
        { key: "inset", label: "Content inset (%)", type: "range", value: "10", min: 0, max: 25, step: 1 },
    ],
};