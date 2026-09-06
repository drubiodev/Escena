import { registerComponents } from "ladrillosjs";
import { BUILT_IN_BLOCKS } from "../blocks/index.js";
import { registry } from "./registry.js";
import { renderSlide } from "./renderer.js";
import { paintIcons } from "./icons.js";

export async function bootPresenter()
{
    // This window is only a remote control. It never loads or saves a local deck.
    const session = new URLSearchParams(location.hash.slice(1)).get("session");
    if (!session || typeof BroadcastChannel !== "function") throw new Error("Open presenter view from an active Escena presentation.");
    registry.defineMany(BUILT_IN_BLOCKS);
    await registerComponents(registry.componentDefs());
    paintIcons();
    const channel = new BroadcastChannel(`escena-presenter:${session}`);
    let state = null;
    let lastSignature = "";
    let lastSeen = Date.now();
    const current = document.getElementById("current-slide");
    const next = document.getElementById("next-slide");
    function fit()
    {
        for (const surface of [current, next]) surface.style.transform = `translate(-50%, -50%) scale(${surface.parentElement.clientWidth / 1280})`;
    }
    const observer = new ResizeObserver(fit);
    observer.observe(current.parentElement);
    observer.observe(next.parentElement);
    channel.addEventListener("message", ({ data }) =>
    {
        if (data?.type !== "state" || !data.deck?.slides) return;
        state = data;
        lastSeen = Date.now();
        const slide = state.deck.slides[state.index];
        const following = state.deck.slides[state.index + 1];
        const signature = JSON.stringify([state.deck, state.index, state.presenting]);
        if (lastSignature !== signature)
        {
            lastSignature = signature;
            renderSlide(current, slide, state.deck.theme, { preview: true });
            if (following) renderSlide(next, following, state.deck.theme, { preview: true });
            else next.replaceChildren();
            document.getElementById("next-label").textContent = following?.name || "End of presentation";
            document.getElementById("presenter-notes").textContent = slide.notes || "No notes for this slide.";
            fit();
        }
        document.getElementById("presenter-status").textContent = !state.presenting ? "Presentation ended" : state.black ? "Screen is blacked out" : state.deck.title;
        document.getElementById("presenter-counter").textContent = `${state.index + 1} / ${state.deck.slides.length}`;
        document.querySelector('[data-remote="prev"]').disabled = !state.presenting || state.index === 0;
        document.querySelector('[data-remote="next"]').disabled = !state.presenting || !following;
    });
    function send(name) { channel.postMessage({ type: "command", name }); }
    document.addEventListener("click", (event) => { const name = event.target.closest("[data-remote]")?.dataset.remote; if (name) send(name); });
    window.addEventListener("keydown", (event) =>
    {
        if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); send("next"); }
        if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); send("prev"); }
        if (event.key.toLowerCase() === "b") send("blackout");
    });
    // Heartbeats recover from a late-loading window and let us report a closed editor.
    const heartbeat = setInterval(() =>
    {
        channel.postMessage({ type: "hello" });
        if (Date.now() - lastSeen > 6000) document.getElementById("presenter-status").textContent = "Editor disconnected";
        if (!state?.presenting) return;
        const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
        document.getElementById("presenter-clock").textContent = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
    }, 1000);
    window.addEventListener("pagehide", () => { clearInterval(heartbeat); channel.close(); observer.disconnect(); });
    channel.postMessage({ type: "hello" });
}