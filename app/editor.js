import { $listen, $emit } from "ladrillosjs";
import { store } from "./store.js";
import { renderSlide } from "./renderer.js";
import { paintIcons } from "./icons.js";

let toastTimer;
export function notify(message)
{
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
}

export function thumbnail(slide, theme)
{
    const thumb = document.createElement("div");
    thumb.className = "slide-thumbnail";
    const surface = document.createElement("div");
    surface.className = "slide-page thumbnail-surface";
    surface.inert = true;
    renderSlide(surface, slide, theme, { preview: true, thumbnail: true });
    thumb.append(surface);
    return thumb;
}

export function mountNavigator(host, refs)
{
    const cards = new Map();
    let draggedIndex = null;
    const observer = new ResizeObserver(() => fit());
    observer.observe(refs.list);
    function fit()
    {
        for (const thumb of refs.list.querySelectorAll(".slide-thumbnail"))
            thumb.firstElementChild.style.transform = `scale(${thumb.clientWidth / 1280})`;
    }
    function refresh()
    {
        refs.count.textContent = String(store.slideCount()).padStart(2, "0");
        const visible = new Set(store.slides().map((slide) => slide.id));
        for (const [id, card] of cards)
        {
            if (!visible.has(id)) { card.button.remove(); cards.delete(id); }
        }
        store.slides().forEach((slide, index) =>
        {
            let card = cards.get(slide.id);
            if (!card)
            {
                const button = document.createElement("button");
                button.className = "slide-card";
                button.draggable = true;
                const number = document.createElement("span");
                number.className = "slide-number";
                const name = document.createElement("span");
                name.className = "slide-name";
                button.append(number, thumbnail(slide, store.theme()), name);
                const position = () => Number(button.dataset.index);
                button.addEventListener("click", () => store.goTo(position()));
                button.addEventListener("dragstart", (event) => { draggedIndex = position(); event.dataTransfer.setData("text/plain", String(position())); event.dataTransfer.effectAllowed = "move"; });
                button.addEventListener("dragover", (event) => { if (draggedIndex !== null) { event.preventDefault(); button.classList.add("drag-over"); } });
                button.addEventListener("dragleave", () => button.classList.remove("drag-over"));
                button.addEventListener("drop", (event) => { event.preventDefault(); if (draggedIndex !== null) store.moveSlide(draggedIndex, position()); draggedIndex = null; button.classList.remove("drag-over"); });
                button.addEventListener("dragend", () => { draggedIndex = null; refs.list.querySelectorAll(".drag-over").forEach((node) => node.classList.remove("drag-over")); });
                button.addEventListener("keydown", (event) =>
                {
                    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
                    event.preventDefault();
                    const target = position() + (event.key === "ArrowUp" ? -1 : 1);
                    store.moveSlide(position(), target);
                    refs.list.querySelector('[aria-current="true"]')?.focus();
                });
                card = { button, number, name, signature: "" };
                cards.set(slide.id, card);
            }
            card.button.dataset.index = index;
            card.button.setAttribute("aria-label", `Slide ${index + 1}: ${slide.name}`);
            card.button.setAttribute("aria-current", String(index === store.currentIndex()));
            card.number.textContent = String(index + 1).padStart(2, "0");
            card.name.textContent = slide.name;
            // Notes and selection don't change the miniature slide. Keeping its
            // DOM alive also avoids refetching images every time the user types.
            const signature = JSON.stringify([slide.blocks, slide.background, store.theme()]);
            if (signature !== card.signature)
            {
                renderSlide(card.button.querySelector(".thumbnail-surface"), slide, store.theme(), { preview: true, thumbnail: true });
                card.signature = signature;
            }
            if (refs.list.children[index] !== card.button) refs.list.insertBefore(card.button, refs.list.children[index] || null);
        });
        fit();
    }
    $listen("escena:change", ({ reason }) => { if (!["select", "mode", "slide:prop", "title"].includes(reason)) refresh(); });
    $listen("escena:change", ({ reason }) => { if (reason === "slide:prop") refresh(); });
    refresh();
    paintIcons(host);
}

export function mountToolbar(host)
{
    paintIcons(host);
    const refresh = () =>
    {
        host.querySelector('[data-command="undo"]').disabled = !store.canUndo();
        host.querySelector('[data-command="redo"]').disabled = !store.canRedo();
        host.querySelector('[data-command="delete"]').disabled = !store.selected() && store.slideCount() === 1;
    };
    $listen("escena:change", refresh);
    refresh();
}

function installInspectorResize()
{
    const layout = document.querySelector(".editor-layout");
    const sidebar = document.querySelector(".inspector-sidebar");
    const handle = document.getElementById("inspector-resize-handle");
    const maxWidth = () => Math.max(240, Math.min(720, layout.clientWidth / 2));
    const sync = () =>
    {
        handle.setAttribute("aria-valuemin", "240");
        handle.setAttribute("aria-valuemax", String(Math.floor(maxWidth())));
        handle.setAttribute("aria-valuenow", String(Math.round(sidebar.getBoundingClientRect().width)));
    };
    const setWidth = (width) =>
    {
        layout.style.setProperty("--inspector-width", `${Math.round(Math.min(maxWidth(), Math.max(240, width)))}px`);
        sync();
    };
    handle.addEventListener("pointerdown", (event) =>
    {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        handle.focus();
        const startX = event.clientX;
        const startWidth = sidebar.getBoundingClientRect().width;
        handle.setPointerCapture(event.pointerId);
        document.body.classList.add("resizing-inspector");
        const move = (moveEvent) => setWidth(startWidth + startX - moveEvent.clientX);
        const finish = () =>
        {
            document.body.classList.remove("resizing-inspector");
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", finish);
            handle.removeEventListener("pointercancel", finish);
            handle.removeEventListener("lostpointercapture", finish);
            if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", finish);
        handle.addEventListener("pointercancel", finish);
        handle.addEventListener("lostpointercapture", finish);
    });
    handle.addEventListener("keydown", (event) =>
    {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const amount = event.shiftKey ? 40 : 10;
        const width = sidebar.getBoundingClientRect().width;
        if (event.key === "Home") setWidth(240);
        else if (event.key === "End") setWidth(maxWidth());
        else setWidth(width + (event.key === "ArrowLeft" ? amount : -amount));
    });
    handle.addEventListener("dblclick", () =>
    {
        layout.style.removeProperty("--inspector-width");
        sync();
    });
    new ResizeObserver(sync).observe(sidebar);
    sync();
}

export function installEditor()
{
    // These are the shell controls that sit outside a component. Everything
    // still reads the same store and sends the same commands as component UI.
    paintIcons();
    installInspectorResize();
    const title = document.getElementById("document-title");
    const notes = document.getElementById("speaker-notes");
    const workspace = document.querySelector(".workspace");
    const notesHandle = document.getElementById("notes-resize-handle");
    const setNotesHeight = (height) =>
    {
        const maxHeight = Math.max(96, workspace.clientHeight - 160);
        const nextHeight = Math.round(Math.min(maxHeight, Math.max(96, height)));
        workspace.style.setProperty("--notes-height", `${nextHeight}px`);
        notesHandle.setAttribute("aria-valuenow", String(nextHeight));
    };
    notesHandle.addEventListener("pointerdown", (event) =>
    {
        const startY = event.clientY;
        const startHeight = document.getElementById("notes-panel").getBoundingClientRect().height;
        notesHandle.setPointerCapture(event.pointerId);
        document.body.classList.add("resizing-notes");
        const move = (moveEvent) => setNotesHeight(startHeight + startY - moveEvent.clientY);
        const finish = () =>
        {
            document.body.classList.remove("resizing-notes");
            notesHandle.removeEventListener("pointermove", move);
            notesHandle.removeEventListener("pointerup", finish);
            notesHandle.removeEventListener("pointercancel", finish);
        };
        notesHandle.addEventListener("pointermove", move);
        notesHandle.addEventListener("pointerup", finish);
        notesHandle.addEventListener("pointercancel", finish);
    });
    notesHandle.addEventListener("keydown", (event) =>
    {
        if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const amount = event.shiftKey ? 40 : 10;
        const currentHeight = document.getElementById("notes-panel").getBoundingClientRect().height;
        setNotesHeight(currentHeight + (event.key === "ArrowUp" ? amount : -amount));
    });
    title.addEventListener("input", () => store.setTitle(title.value));
    notes.addEventListener("input", () => store.setSlideProp("notes", notes.value));
    function refresh()
    {
        if (document.activeElement !== title) title.value = store.title();
        if (document.activeElement !== notes) notes.value = store.slide().notes;
        document.getElementById("save-state").textContent = store.saveState();
        document.getElementById("slide-counter").textContent = `Slide ${store.currentIndex() + 1} of ${store.slideCount()}`;
        document.title = store.title() === "Untitled presentation"
            ? "Escena | Online Presentation Maker for Slides and Code Demos"
            : `${store.title()} - Escena Presentation Maker`;
    }
    document.addEventListener("click", (event) =>
    {
        const tab = event.target.closest("[data-panel]");
        if (tab)
        {
            for (const button of document.querySelectorAll("[data-panel]")) button.setAttribute("aria-selected", String(button === tab));
            document.getElementById("slides-panel").hidden = tab.dataset.panel !== "slides";
            document.getElementById("insert-panel").hidden = tab.dataset.panel !== "insert";
        }
        const button = event.target.closest("[data-command]");
        if (button)
        {
            button.closest("details")?.removeAttribute("open");
            $emit("escena:command", { name: button.dataset.command, value: button.dataset.value });
        }
        for (const details of document.querySelectorAll("details[open]")) if (!details.contains(event.target)) details.open = false;
    });
    document.querySelector(".sidebar-tabs").addEventListener("keydown", (event) =>
    {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const other = document.querySelector('[role="tab"][aria-selected="false"]');
        other.click();
        other.focus();
    });
    $listen("escena:change", refresh);
    refresh();
}