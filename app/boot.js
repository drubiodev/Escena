import
{
    configure,
    registerComponents,
} from "https://cdn.jsdelivr.net/npm/ladrillosjs@2.1.3/dist/index.js";

import { BUILT_IN_BLOCKS } from "../blocks/index.js";
import
{
    registry,
    SLIDE_HEIGHT,
    SLIDE_WIDTH,
} from "./registry.js";
import { renderSlide } from "./renderer.js";
import { STARTER_DECK } from "./starter-deck.js";

/**
 * Scales and centers the logical slide inside the available workspace.
 * @param {HTMLElement} slideZoom Wrapper that receives the scale transform.
 * @param {HTMLElement} editorWorkspace Available editor viewport.
 * @returns {void}
 */
function fitSlide(slideZoom, editorWorkspace)
{
    const scale = Math.min(
        editorWorkspace.clientWidth / SLIDE_WIDTH,
        editorWorkspace.clientHeight / SLIDE_HEIGHT
    );

    slideZoom.style.transform = `scale(${scale})`;
    slideZoom.style.left =
        (editorWorkspace.clientWidth - SLIDE_WIDTH * scale) / 2 + "px";
    slideZoom.style.top =
        (editorWorkspace.clientHeight - SLIDE_HEIGHT * scale) / 2 + "px";
}

/**
 * Registers block definitions and renders the first data-driven slide.
 * @returns {Promise<void>} Resolves after components are ready and mounted.
 */
export async function boot()
{
    configure({ cacheSize: 10 });

    // Definitions must exist before the registry can produce component records.
    registry.defineMany(BUILT_IN_BLOCKS);
    await registerComponents(registry.componentDefs());

    const slidePage = document.querySelector(".slide-page");
    const slideZoom = document.querySelector(".slide-zoom");
    const editorWorkspace = document.querySelector(".editor-workspace");

    renderSlide(slidePage, STARTER_DECK.slides[0], STARTER_DECK.theme);

    const resize = () => fitSlide(slideZoom, editorWorkspace);
    window.addEventListener("resize", resize);
    resize();
}
