import
{
    configure,
    registerComponent,
    registerComponents,
} from "ladrillosjs";
import { BUILT_IN_BLOCKS } from "../blocks/index.js";
import { mount as mountCanvas } from "./canvas.js";
import { mount as mountInspector } from "./inspector.js";
import { registry } from "./registry.js";
import { store } from "./store.js";
import { installCommands } from "./commands.js";

const APP_COMPONENTS = [
    { name: "block-palette", path: "./components/block-palette.html" },
    { name: "slide-editor", path: "./components/slide-editor.html" },
    { name: "property-inspector", path: "./components/property-inspector.html" },
].map((definition) => ({ ...definition, useShadowDOM: false }));


/** Registers block components and mounts the interactive editor. */
export async function boot()
{
    configure({ cacheSize: 10 });

    registry.defineMany(BUILT_IN_BLOCKS);

    window.Escena = {
        ...(window.Escena || {}),
        store,
        registry,
        canvas: { mount: mountCanvas },
        inspector: { mount: mountInspector },
    };


    await registerComponents([
        ...APP_COMPONENTS,
        ...registry.componentDefs(),
    ]);

    installCommands();
}
