import { $emit } from "ladrillosjs";
import { store } from "./store.js";

export function installShortcuts()
{
    window.addEventListener("keydown", (event) =>
    {
        if (event.defaultPrevented || store.mode() !== "edit" || document.querySelector("dialog[open]")) return;
        // Look through shadow roots too: a heading being edited should receive
        // ordinary typing and native text shortcuts, not slide-level commands.
        const editing = event.composedPath().some((target) => target.matches?.("input, textarea, select, .monaco-editor") || target.isContentEditable);
        if (editing) return;
        const modifier = event.metaKey || event.ctrlKey;
        const key = event.key.toLowerCase();
        const command = (name) => { event.preventDefault(); $emit("escena:command", { name }); };
        if (modifier)
        {
            if (key === "z") return command(event.shiftKey ? "redo" : "undo");
            if (key === "y") return command("redo");
            if (key === "s") return command("file:save");
            if (key === "o") return command("file:open");
            if (key === "d") return command("duplicate");
            if (key === "m") return command("slide:add");
            if (key === "c" && store.selected()) { event.preventDefault(); store.copyBlock(); }
            if (key === "x" && store.selected()) { event.preventDefault(); store.copyBlock(); store.deleteBlock(); }
            if (key === "v") { event.preventDefault(); store.pasteBlock(); }
            return;
        }
        if (key === "f5") return command(event.shiftKey ? "present" : "present:first");
        if (key === "escape") { store.select(null); document.body.classList.remove("design-open"); return; }
        if (["delete", "backspace"].includes(key) && store.selected()) return command("delete");
        if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key))
        {
            const block = store.selected();
            event.preventDefault();
            if (!block)
            {
                if (["arrowleft", "arrowup"].includes(key)) store.prevSlide();
                else store.nextSlide();
                return;
            }
            const step = event.shiftKey ? 10 : 1;
            const axis = ["arrowleft", "arrowright"].includes(key) ? "x" : "y";
            const direction = ["arrowleft", "arrowup"].includes(key) ? -1 : 1;
            store.moveBlock(block.id, { [axis]: block[axis] + step * direction });
        }
    });
}