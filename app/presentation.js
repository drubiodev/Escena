import { $listen } from "ladrillosjs";
import { store } from "./store.js";
import { renderSlide } from "./renderer.js";
import { paintIcons } from "./icons.js";
import { thumbnail, notify } from "./editor.js";

let host;
let refs;
let startedAt = 0;
let timer;
let black = false;
let returnFocus;
let presenterWindow;
const session = crypto.randomUUID();
const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`escena-presenter:${session}`) : null;

export function formatTime(seconds)
{
    return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

// The editor owns the deck. The second window gets snapshots and sends back
// a small set of navigation commands, never document mutations.
function publish()
{
    channel?.postMessage({ type: "state", deck: store.deck(), index: store.currentIndex(), startedAt, black, presenting: store.mode() === "present" });
}

channel?.addEventListener("message", ({ data }) =>
{
    if (data?.type === "hello") publish();
    if (data?.type === "command" && store.mode() === "present")
    {
        if (["prev", "next", "blackout", "close", "resetTimer"].includes(data.name)) presentation[data.name]();
    }
});

function fit()
{
    if (!refs) return;
    const scale = Math.min(refs.stageWrap.clientWidth / 1280, refs.stageWrap.clientHeight / 720);
    refs.surface.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function draw()
{
    if (!refs || store.mode() !== "present") return;
    renderSlide(refs.surface, store.slide(), store.theme());
    refs.stageWrap.style.backgroundColor = getComputedStyle(refs.surface).backgroundColor;
    refs.counter.textContent = `${store.currentIndex() + 1} / ${store.slideCount()}`;
    host.querySelector('[data-present="prev"]').disabled = store.currentIndex() === 0;
    host.querySelector('[data-present="next"]').disabled = store.currentIndex() === store.slideCount() - 1;
    fit();
}

export const presentation = {
    mount(element, references)
    {
        host = element;
        refs = references;
        paintIcons(host);
        new ResizeObserver(fit).observe(refs.stageWrap);
        host.addEventListener("click", (event) =>
        {
            const command = event.target.closest("[data-present]")?.dataset.present;
            if (command === "overview") openOverview();
            else if (command && typeof this[command] === "function") this[command]();
        });
        refs.stageWrap.addEventListener("click", (event) =>
        {
            const interactive = event.composedPath().some((node) => node.matches?.("button, input, a, video, audio"));
            if (!interactive) this.next();
        });
        let touchStart = null;
        refs.stageWrap.addEventListener("touchstart", (event) => { touchStart = event.touches[0].clientX; }, { passive: true });
        refs.stageWrap.addEventListener("touchend", (event) =>
        {
            const distance = event.changedTouches[0].clientX - touchStart;
            if (touchStart !== null && Math.abs(distance) > 60) distance < 0 ? this.next() : this.prev();
            touchStart = null;
        }, { passive: true });
    },
    open(fromStart = false)
    {
        if (!host) return;
        returnFocus = document.activeElement;
        if (fromStart) store.goTo(0);
        black = false;
        host.classList.remove("is-black");
        host.hidden = false;
        document.querySelector(".slideshow-app").inert = true;
        startedAt = Date.now();
        store.setMode("present");
        host.querySelector(".presentation-shell").focus();
        clearInterval(timer);
        timer = setInterval(() => { refs.timer.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000)); }, 1000);
        refs.timer.textContent = "00:00";
        draw();
        publish();
    },
    close()
    {
        if (!host) return;
        host.hidden = true;
        refs.surface.replaceChildren();
        clearInterval(timer);
        document.querySelector(".slideshow-app").inert = false;
        store.setMode("edit");
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        returnFocus?.focus();
        publish();
    },
    prev() { store.prevSlide(); },
    next() { store.nextSlide(); },
    blackout()
    {
        black = !black;
        host.classList.toggle("is-black", black);
        host.querySelector('[data-present="blackout"]').setAttribute("aria-pressed", String(black));
        publish();
    },
    resetTimer() { startedAt = Date.now(); publish(); },
    fullscreen()
    {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        else host.requestFullscreen?.().catch(() => notify("Fullscreen is unavailable in this browser."));
    },
    presenter()
    {
        if (!channel) return notify("Presenter windows require BroadcastChannel support.");
        if (presenterWindow && !presenterWindow.closed) { presenterWindow.focus(); return; }
        // Static hosts may redirect .html URLs and discard query strings. The
        // fragment stays in the browser and survives those clean-URL redirects.
        presenterWindow = window.open(`./presenter.html#session=${encodeURIComponent(session)}`, `escena-presenter-${session}`, "popup,width=1200,height=800");
        if (!presenterWindow) notify("Allow popups to open the presenter window.");
    },
};

$listen("escena:change", ({ reason }) =>
{
    // A timer tick or selection change should not restart a playing video.
    if (!["select", "title"].includes(reason)) draw();
    if (store.mode() === "present") publish();
});

window.addEventListener("keydown", (event) =>
{
    if (store.mode() !== "present" || document.querySelector("dialog[open]")) return;
    const key = event.key.toLowerCase();
    const mediaControl = event.composedPath().some((node) => node.matches?.("video, audio, input, textarea, select"));
    if (mediaControl && key !== "escape") return;
    if (["arrowright", "arrowdown", "pagedown", " "].includes(key)) { event.preventDefault(); presentation.next(); }
    if (["arrowleft", "arrowup", "pageup"].includes(key)) { event.preventDefault(); presentation.prev(); }
    if (key === "escape") presentation.close();
    if (key === "b" || key === ".") presentation.blackout();
    if (key === "f") presentation.fullscreen();
    if (key === "home") { event.preventDefault(); store.goTo(0); }
    if (key === "end") { event.preventDefault(); store.goTo(store.slideCount() - 1); }
    if (key === "g") openOverview();
    if (key === "tab")
    {
        const buttons = [...host.querySelectorAll("button:not(:disabled)")];
        const position = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(position + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
});

export function openOverview()
{
    if (document.querySelector("dialog[open]")) return;
    const dialog = document.createElement("dialog");
    dialog.className = "overview-dialog";
    dialog.setAttribute("aria-label", "Slide sorter");
    dialog.innerHTML = '<header><h2>All slides</h2><button class="icon-button" aria-label="Close slide sorter" title="Close"><span data-icon="X"></span></button></header><div class="overview-grid"></div>';
    const grid = dialog.querySelector(".overview-grid");
    store.slides().forEach((slide, index) =>
    {
        const button = document.createElement("button");
        button.className = "overview-card";
        button.setAttribute("aria-current", String(index === store.currentIndex()));
        const caption = document.createElement("span");
        caption.textContent = `${index + 1}. ${slide.name}`;
        button.append(thumbnail(slide, store.theme()), caption);
        button.addEventListener("click", () => { store.goTo(index); dialog.close(); });
        grid.append(button);
    });
    const observer = new ResizeObserver(() =>
    {
        for (const thumb of grid.querySelectorAll(".slide-thumbnail")) thumb.firstElementChild.style.transform = `scale(${thumb.clientWidth / 1280})`;
    });
    dialog.addEventListener("close", () => { observer.disconnect(); dialog.remove(); });
    dialog.querySelector("header button").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    (document.fullscreenElement || document.body).append(dialog);
    paintIcons(dialog);
    dialog.showModal();
    observer.observe(grid);
}