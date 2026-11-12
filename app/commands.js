import { $listen } from "ladrillosjs";

import { store } from "./store.js";
import { notify } from "./editor.js";
import { presentation, openOverview } from "./presentation.js";
import { saveDeck, openDeck, confirmNewDeck, exportHTML } from "./files.js";

export function installCommands()
{
    const chooser = document.getElementById("open-file");
    chooser.addEventListener("change", async () =>
    {
        try { await openDeck(chooser.files[0]); }
        catch (error) { notify(`Could not open deck: ${error.message}`); }
        finally { chooser.value = ""; }
    });

    // Hovering or focusing Present is a strong hint; mount the opening slides now.
    const warmPresent = (event) =>
    {
        const name = event.target.closest?.("[data-command]")?.dataset.command;
        if (name === "present" || name === "present:first") presentation.warm(name === "present:first");
    };
    document.addEventListener("pointerover", warmPresent);
    document.addEventListener("focusin", warmPresent);

    // Buttons and shortcuts speak the same small command language. Keep the
    // routing here so components don't need to know how files or playback work.
    $listen("escena:command", async (command) =>
    {
        try
        {
            switch (command?.name)
            {
                case "file:new": confirmNewDeck(); break;
                case "file:open": chooser.click(); break;
                case "file:save": saveDeck(); break;
                case "file:html": await exportHTML(); break;
                case "present": presentation.open(); break;
                case "present:first": presentation.open(true); break;
                case "phone": presentation.phone(); break;
                case "overview": openOverview(); break;
                case "undo": store.undo(); break;
                case "redo": store.redo(); break;
                case "slide:add": store.addSlide(command.value || "blank"); break;
                case "duplicate": store.selected() ? store.duplicateBlock() : store.duplicateSlide(); break;
                case "delete": store.selected() ? store.deleteBlock() : store.deleteSlide(); break;
                case "notes":
                    {
                        const panel = document.getElementById("notes-panel");
                        panel.hidden = !panel.hidden;
                        document.querySelector(".workspace").classList.toggle("has-notes", !panel.hidden);
                        document.querySelector('[data-command="notes"]').setAttribute("aria-expanded", String(!panel.hidden));
                        if (!panel.hidden) document.getElementById("speaker-notes").focus();
                        break;
                    }
                case "design": document.body.classList.toggle("design-open"); break;
                case "block:add": store.addBlock(command.type); break;
                default: break;
            }
        }
        catch (error) { notify(error.message || "That action could not be completed."); }
    });
}
