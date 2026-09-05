import
    {
        configure,
        registerComponent,
        registerComponents,
    } from "https://cdn.jsdelivr.net/npm/ladrillosjs@2.1.3/dist/index.js";

import { BUILT_IN_BLOCKS } from "../blocks/index.js";
import { mount as mountCanvas } from "./canvas.js";
import { registry } from "./registry.js";
import { store } from "./store.js";

/** Registers block components and mounts the interactive editor. */
export async function boot()
{
    configure({ cacheSize: 10 });

    // Definitions must exist before the registry can produce component records.
    registry.defineMany(BUILT_IN_BLOCKS);
    await registerComponents(registry.componentDefs());

    // The component script reads this bridge as soon as registration upgrades it.
    window.Escena = {
        ...(window.Escena || {}),
        store,
        canvas: { mount: mountCanvas },
    };

    await registerComponent(
        "slide-editor",
        "./components/slide-editor.html",
        false
    );
}
