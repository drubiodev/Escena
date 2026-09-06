import
{
    configure,
    registerComponents,
} from "ladrillosjs";
import { BUILT_IN_BLOCKS } from "../blocks/index.js";
import { mount as mountCanvas } from "./canvas.js";
import { mount as mountInspector } from "./inspector.js";
import { registry } from "./registry.js";
import { store } from "./store.js";
import { installCommands } from "./commands.js";
import * as editor from "./editor.js";
import { installShortcuts } from "./shortcuts.js";
import { presentation } from "./presentation.js";

const APP_COMPONENTS = [
    { name: "block-palette", path: "./components/block-palette.html" },
    { name: "slide-editor", path: "./components/slide-editor.html" },
    { name: "property-inspector", path: "./components/property-inspector.html" },
    { name: "slide-navigator", path: "./components/slide-navigator.html" },
    { name: "editor-toolbar", path: "./components/editor-toolbar.html" },
    { name: "presentation-view", path: "./components/presentation-view.html" },
].map((definition) => ({ ...definition, useShadowDOM: false }));


/** Registers block components and mounts the interactive editor. */
export async function boot()
{
    configure({ cacheSize: 32 });

    // Teach the registry about blocks before restoring a deck. Import validation
    // uses those definitions to tell real block props from unknown data.
    registry.defineMany(BUILT_IN_BLOCKS);
    store.load();

    // Ladrillos component scripts use this bridge to reach the app's modules.
    // The HTML owns the UI; these small controllers own the browser behavior.
    window.Escena = {
        ...(window.Escena || {}),
        store,
        registry,
        editor,
        presentation,
        canvas: { mount: mountCanvas },
        inspector: { mount: mountInspector },
    };


    // Register everything before wiring commands so the first click has a home.
    await registerComponents([
        ...APP_COMPONENTS,
        ...registry.componentDefs(),
    ]);

    installCommands();
    editor.installEditor();
    installShortcuts();
}
