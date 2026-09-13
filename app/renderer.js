import { registry } from "./registry.js";

// Convert one stored block instance into its registered custom element.
/**
 * Creates the visual custom element for one block instance.
 * @param {Object} block The stored block instance.
 * @returns {HTMLElement} The block element or a visible missing-type fallback.
 */
export function createBlockEl(block, { preview = false, thumbnail = false } = {})
{
    const definition = registry.get(block.type);
    if (!definition)
    {
        const missing = document.createElement("div");
        missing.textContent = `Missing block: ${block.type}`;
        return missing;
    }

    if (thumbnail && definition.renderThumbnail === false)
    {
        const placeholder = document.createElement("div");
        placeholder.className = "runtime-thumbnail";
        placeholder.innerHTML = "<strong>&lt;/&gt;</strong><span>Ladrillos component</span>";
        return placeholder;
    }

    const element = document.createElement(registry.elementName(block.type));
    for (const prop of definition.props)
    {
        let value = block.props?.[prop.key] ?? prop.value;
        // A thumbnail is a preview, not another running presentation. Keep
        // media quiet without changing the props saved in the user's deck.
        if (preview && prop.key === "autoplay") value = "off";
        if (preview && prop.key === "muted") value = "on";
        if (prop.key === definition.editable && value === "")
        {
            element.toggleAttribute("data-empty", true);
            element.setAttribute(prop.key, " ");
            continue;
        }
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
export function createFrame(block, options)
{
    const frame = document.createElement("div");
    frame.className = "frame";
    // The editor uses this stable id to reconnect DOM and document data.
    frame.dataset.id = block.id;
    styleFrame(frame, block);
    frame.appendChild(createBlockEl(block, options));
    return frame;
}

/**
 * Replaces a slide surface with blocks rendered in stacking order.
 * @param {HTMLElement} slidePage The fixed-size slide surface.
 * @param {Object} slideData The slide document to render.
 * @param {string} theme The active deck theme key.
 * @returns {void}
 */
export function renderSlide(slidePage, slideData, theme, options)
{
    slidePage.dataset.theme = theme;
    slidePage.style.background = slideData.background || "";
    slidePage.replaceChildren();
    // Append low z values first so higher layers paint later and appear above.
    for (const block of [...slideData.blocks].sort((a, b) => a.z - b.z))
        slidePage.appendChild(createFrame(block, options));
}

export function createSlideCache(slidePage, options)
{
    const slides = new Map();
    const setActive = (frame, active) =>
    {
        if (frame.dataset.active === String(active)) return;
        frame.dataset.active = String(active);
        frame.firstElementChild?.dispatchEvent(new CustomEvent("escena:activity", { detail: { active } }));
    };
    const remove = (id) =>
    {
        for (const frame of slides.get(id).values())
        {
            setActive(frame, false);
            frame.remove();
        }
        slides.delete(id);
    };
    return {
        show(slide, theme, active = true)
        {
            let frames = slides.get(slide.id);
            if (!frames) frames = new Map();
            slides.delete(slide.id);
            slides.set(slide.id, frames);
            slidePage.dataset.theme = theme;
            slidePage.style.background = slide.background || "";
            const visibleIds = new Set(slide.blocks.map((block) => block.id));
            for (const [id, frame] of frames)
            {
                if (visibleIds.has(id)) continue;
                setActive(frame, false);
                frame.remove();
                frames.delete(id);
            }
            for (const block of [...slide.blocks].sort((first, second) => first.z - second.z))
            {
                const signature = JSON.stringify([block.type, block.props || {}]);
                let frame = frames.get(block.id);
                if (!frame)
                {
                    frame = createFrame(block, options);
                    frame.dataset.signature = signature;
                    frames.set(block.id, frame);
                    frame.dataset.active = String(active);
                    slidePage.appendChild(frame);
                }
                else if (frame.dataset.signature !== signature)
                {
                    frame.replaceChildren(createBlockEl(block, options));
                    frame.dataset.signature = signature;
                }
                styleFrame(frame, block);
            }
            for (const [id, cachedFrames] of slides)
            {
                for (const frame of cachedFrames.values())
                {
                    frame.hidden = id !== slide.id;
                    frame.inert = id !== slide.id;
                    setActive(frame, id === slide.id && active);
                }
            }
            while (slides.size > 5) remove(slides.keys().next().value);
            return frames;
        },
        prune(currentSlides)
        {
            const ids = new Set(currentSlides.map((slide) => slide.id));
            for (const id of slides.keys()) if (!ids.has(id)) remove(id);
        },
        clear()
        {
            for (const id of slides.keys()) remove(id);
        },
    };
}
