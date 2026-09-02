import { registry } from "./registry.js";

// Convert one stored block instance into its registered custom element.
/**
 * Creates the visual custom element for one block instance.
 * @param {Object} block The stored block instance.
 * @returns {HTMLElement} The block element or a visible missing-type fallback.
 */
export function createBlockEl(block)
{
    const definition = registry.get(block.type);
    if (!definition)
    {
        const missing = document.createElement("div");
        missing.textContent = `Missing block: ${block.type}`;
        return missing;
    }

    const element = document.createElement(registry.elementName(block.type));
    for (const prop of definition.props)
    {
        const value = block.props?.[prop.key] ?? prop.value;
        // Custom-element props cross the DOM boundary as attributes.
        element.setAttribute(prop.key, String(value));
    }
    return element;
}

// The frame owns placement; the block component owns visual content.
/**
 * Applies logical block geometry to its positioned frame.
 * @param {HTMLElement} frame The frame to update.
 * @param {Object} block The block geometry and stacking data.
 * @returns {void}
 */
export function styleFrame(frame, block)
{
    frame.style.left = block.x + "px";
    frame.style.top = block.y + "px";
    frame.style.width = block.w + "px";
    frame.style.height = block.h + "px";
    frame.style.zIndex = String(block.z || 0);
    frame.style.transform = block.rotate ? `rotate(${block.rotate}deg)` : "";
}

/**
 * Creates a positioned frame containing one rendered block.
 * @param {Object} block The stored block instance.
 * @returns {HTMLDivElement} The complete frame element.
 */
export function createFrame(block)
{
    const frame = document.createElement("div");
    frame.className = "frame";
    // The editor uses this stable id to reconnect DOM and document data.
    frame.dataset.id = block.id;
    styleFrame(frame, block);
    frame.appendChild(createBlockEl(block));
    return frame;
}

/**
 * Replaces a slide surface with blocks rendered in stacking order.
 * @param {HTMLElement} slidePage The fixed-size slide surface.
 * @param {Object} slideData The slide document to render.
 * @param {string} theme The active deck theme key.
 * @returns {void}
 */
export function renderSlide(slidePage, slideData, theme)
{
    slidePage.dataset.theme = theme;
    slidePage.style.background = slideData.background || "";
    slidePage.replaceChildren();
    // Append low z values first so higher layers paint later and appear above.
    for (const block of [...slideData.blocks].sort((a, b) => a.z - b.z))
        slidePage.appendChild(createFrame(block));
}
