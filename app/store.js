import { $emit } from "ladrillosjs";
import { STARTER_DECK } from "./starter-deck.js";
import
{
    registry,
    SLIDE_HEIGHT,
    SLIDE_WIDTH,
} from "./registry.js";


// The deck is saved; navigation, selection, and mode belong only to this tab.
let deck = structuredClone(STARTER_DECK);
let currentIndex = 0;
let selectedId = null;
let mode = "edit";
const STORAGE_KEY = "escena.studio.v1";
// History belongs to this editing session, not the saved file. Keeping the
// cursor and selection in each entry makes undo land where the edit happened.
const past = [];
const future = [];
let saveState = "Local draft";
let lastEdit = { key: null, at: 0 };
let clipboard = null;
let pendingFit = null;

function snapshot()
{
    return structuredClone({ deck, currentIndex, selectedId });
}

function persist()
{
    // Saving is best-effort: a full browser quota must not stop someone editing
    // or downloading their deck. The header makes failures visible instead.
    try
    {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
        saveState = "Saved on this device";
    }
    catch { saveState = "Storage full or unavailable"; }
}

function restore(state)
{
    ({ deck, currentIndex, selectedId } = structuredClone(state));
    persist();
    emit("history");
}

export function validateDeck(raw)
{
    // Build a fresh document first. A malformed import must never half-replace
    // the current one, and every block ID needs to be unique across all slides.
    if (!raw || !Array.isArray(raw.slides) || !raw.slides.length || raw.slides.length > 500)
        throw new Error("A deck must contain between 1 and 500 slides.");
    const ids = new Set();
    const identify = (value, prefix) =>
    {
        const id = typeof value === "string" && value && !ids.has(value) ? value : prefix + crypto.randomUUID();
        ids.add(id);
        return id;
    };
    return {
        id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
        title: typeof raw.title === "string" ? raw.title.slice(0, 200) : "Untitled presentation",
        theme: ["default", "paper", "midnight", "forest"].includes(raw.theme) ? raw.theme : "default",
        slides: raw.slides.map((slide) =>
        {
            if (!slide || !Array.isArray(slide.blocks) || slide.blocks.length > 500)
                throw new Error("Each slide must have a valid blocks array (maximum 500).");
            return {
                id: identify(slide.id, "s"),
                name: typeof slide.name === "string" ? slide.name : "Untitled slide",
                notes: typeof slide.notes === "string" ? slide.notes : "",
                background: typeof slide.background === "string" && /^#[0-9a-f]{6}$/i.test(slide.background) ? slide.background : "",
                blocks: slide.blocks.map((block, index) =>
                {
                    if (!block || !registry.has(block.type)) throw new Error(`Unsupported block type: ${block?.type}`);
                    const geometry = {};
                    for (const key of ["x", "y", "w", "h", "rotate"])
                    {
                        const value = Number(block[key] ?? (key === "rotate" ? 0 : NaN));
                        if (!Number.isFinite(value) || Math.abs(value) > 20000 || (["w", "h"].includes(key) && value < 1))
                            throw new Error("Invalid block geometry.");
                        geometry[key] = value;
                    }
                    const props = registry.defaults(block.type);
                    for (const prop of registry.get(block.type).props)
                    {
                        const value = block.props?.[prop.key];
                        if (["string", "number", "boolean"].includes(typeof value)) props[prop.key] = value;
                    }
                    return { id: identify(block.id, "b"), type: block.type, ...geometry, z: Number.isFinite(block.z) ? block.z : index, props };
                }),
            };
        }),
    };
}

/** Notifies every view that shared state changed. */
function emit(reason)
{
    $emit("escena:change", { reason });
}

/**
 * Applies one document mutation and emits its semantic change reason.
 * @param {() => (boolean|void)} change Mutation callback; false means no change.
 * @param {string} reason Event reason used by views to filter repaint work.
 * @returns {boolean} Whether the mutation changed the document.
 */
function commit(change, reason, key = null)
{
    const before = snapshot();
    // The closure performs one document mutation; false means it was a no-op.
    const result = change();
    if (result === false) return false;
    if (JSON.stringify(before.deck) === JSON.stringify(deck)) return false;
    const now = Date.now();
    // Group a burst of typing into one undo step, but keep separate drags and
    // commands separate. Any new edit starts a fresh branch of the history.
    if (!key || lastEdit.key !== key || now - lastEdit.at > 700)
    {
        past.push(before);
        if (past.length > 80) past.shift();
    }
    lastEdit = { key, at: now };
    future.length = 0;
    persist();
    // Views use the reason to choose the smallest necessary repaint.
    emit(reason);
    return true;
}

/**
 * Creates a short id for a new block.
 * @returns {string} A browser-local block id.
 */
function createBlockId()
{
    return "b" + Math.random().toString(36).slice(2, 9);
}

export const store = {
    load()
    {
        try
        {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) deck = validateDeck(JSON.parse(saved));
            saveState = saved ? "Saved on this device" : "Local draft";
        }
        catch { saveState = "Could not restore local draft"; }
        emit("load");
    },
    saveState: () => saveState,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    undo()
    {
        if (!past.length) return;
        future.push(snapshot());
        lastEdit.key = null;
        restore(past.pop());
    },
    redo()
    {
        if (!future.length) return;
        past.push(snapshot());
        lastEdit.key = null;
        restore(future.pop());
    },
    importDeck(raw)
    {
        const next = validateDeck(raw);
        commit(() => { deck = next; currentIndex = 0; selectedId = null; }, "load");
    },
    newDeck()
    {
        this.importDeck({ title: "Untitled presentation", theme: "default", slides: [{ name: "Opening", blocks: [] }] });
    },
    setTitle(value)
    {
        commit(() => { deck.title = value.slice(0, 200) || "Untitled presentation"; }, "title", "title");
    },
    setTheme(value)
    {
        if (!["default", "paper", "midnight", "forest"].includes(value)) return;
        commit(() => { deck.theme = value; }, "theme");
    },
    setSlideProp(key, value)
    {
        if (!["name", "notes", "background"].includes(key)) return;
        commit(() => { this.slide()[key] = value; }, "slide:prop", `${this.slide().id}:${key}`);
    },
    addSlide(layout = "blank")
    {
        // Layouts are just arrangements of the existing heading and text blocks.
        // They don't introduce another block type or a second rendering system.
        const slide = { id: "s" + crypto.randomUUID(), name: "Untitled slide", notes: "", background: "", blocks: [] };
        const add = (type, geometry, props) => slide.blocks.push({ id: createBlockId(), type, rotate: 0, z: slide.blocks.length, ...geometry, props: { ...registry.defaults(type), ...props } });
        if (layout !== "blank") add("heading", { x: 88, y: 80, w: 1104, h: 150 }, { text: "Your next big idea", size: "68" });
        if (layout === "title") add("text", { x: 92, y: 278, w: 920, h: 180 }, { text: "A few words to set the scene.", size: "30" });
        if (layout === "columns")
        {
            add("text", { x: 92, y: 280, w: 500, h: 320 }, { text: "The first perspective\n\nStart with what matters.", size: "28" });
            add("text", { x: 680, y: 280, w: 500, h: 320 }, { text: "The second perspective\n\nMake the connection.", size: "28" });
        }
        commit(() => { deck.slides.splice(currentIndex + 1, 0, slide); currentIndex++; selectedId = null; }, "slide:add");
    },
    duplicateSlide()
    {
        const slide = structuredClone(this.slide());
        slide.id = "s" + crypto.randomUUID();
        slide.name += " (copy)";
        slide.blocks.forEach((block) => { block.id = createBlockId(); });
        commit(() => { deck.slides.splice(currentIndex + 1, 0, slide); currentIndex++; selectedId = null; }, "slide:add");
    },
    deleteSlide()
    {
        if (deck.slides.length === 1) return false;
        return commit(() => { deck.slides.splice(currentIndex, 1); currentIndex = Math.min(currentIndex, deck.slides.length - 1); selectedId = null; }, "slide:delete");
    },
    moveSlide(from, to)
    {
        if (from === to || !deck.slides[from] || !deck.slides[to]) return;
        const active = this.slide().id;
        commit(() => { deck.slides.splice(to, 0, deck.slides.splice(from, 1)[0]); currentIndex = deck.slides.findIndex((slide) => slide.id === active); }, "slide:reorder");
    },
    copyBlock()
    {
        if (this.selected()) clipboard = structuredClone(this.selected());
    },
    pasteBlock()
    {
        if (!clipboard) return;
        const block = structuredClone(clipboard);
        block.id = createBlockId();
        block.x = Math.min(SLIDE_WIDTH - block.w, block.x + 24);
        block.y = Math.min(SLIDE_HEIGHT - block.h, block.y + 24);
        block.z = this.slide().blocks.reduce((highest, item) => Math.max(highest, item.z), -1) + 1;
        commit(() => { this.slide().blocks.push(block); selectedId = block.id; }, "block:add");
    },
    deck: () => deck,
    slides: () => deck.slides,
    slide: (index = currentIndex) => deck.slides[index] || null,
    slideCount: () => deck.slides.length,
    theme: () => deck.theme,
    title: () => deck.title,
    currentIndex: () => currentIndex,
    selectedId: () => selectedId,
    mode: () => mode,

    /** Finds a block across every slide in the deck. */
    block(id)
    {
        for (const slide of deck.slides)
        {
            const block = slide.blocks.find((item) => item.id === id);
            if (block) return block;
        }
        return null;
    },

    /** Returns the selected block on the current slide. */
    selected()
    {
        if (!selectedId) return null;
        return this.slide()?.blocks.find((block) => block.id === selectedId) || null;
    },

    goTo(index)
    {
        const next = Math.max(0, Math.min(deck.slides.length - 1, index));
        if (next === currentIndex) return;
        currentIndex = next;
        selectedId = null;
        emit("slide");
    },

    nextSlide()
    {
        this.goTo(currentIndex + 1);
    },

    prevSlide()
    {
        this.goTo(currentIndex - 1);
    },

    select(id)
    {
        if (selectedId === id) return;
        selectedId = id;
        emit("select");
    },

    setMode(value)
    {
        if (mode === value) return;
        mode = value;
        emit("mode");
    },

    /**
  * Adds and selects a block centered on the requested point.
  * @param {string} type Registered block type.
  * @param {number} [x] Desired horizontal center in slide coordinates.
  * @param {number} [y] Desired vertical center in slide coordinates.
  * @returns {object|null} The new block, or null for an unknown type.
  */
    addBlock(type, x, y)
    {
        const definition = registry.get(type);
        if (!definition) return null;

        const slide = this.slide();
        const width = definition.size.w;
        const height = definition.size.h;
        const left = x == null ? (SLIDE_WIDTH - width) / 2 : x - width / 2;
        const top = y == null ? (SLIDE_HEIGHT - height) / 2 : y - height / 2;

        const block = {
            id: createBlockId(),
            type,
            x: Math.round(Math.max(0, Math.min(SLIDE_WIDTH - width, left))),
            y: Math.round(Math.max(0, Math.min(SLIDE_HEIGHT - height, top))),
            w: width,
            h: height,
            z: slide.blocks.reduce((highest, item) => Math.max(highest, item.z), -1) + 1,
            rotate: 0,
            props: registry.defaults(type),
        };
        pendingFit = {
            id: block.id,
            centerX: x == null ? SLIDE_WIDTH / 2 : x,
            centerY: y == null ? SLIDE_HEIGHT / 2 : y,
        };

        commit(() =>
        {
            slide.blocks.push(block);
            selectedId = block.id;
        }, "block:create");

        return block;
    },

    /** Fits the currently selected new block without creating a second undo step. */
    fitNewBlock(id, size)
    {
        const block = this.selected();
        if (!block || block.id !== id || pendingFit?.id !== id) return false;

        const width = Math.round(Math.max(32, Math.min(SLIDE_WIDTH, Number(size.w))));
        const height = Math.round(Math.max(32, Math.min(SLIDE_HEIGHT, Number(size.h))));
        if (!Number.isFinite(width) || !Number.isFinite(height)) return false;

        const { centerX, centerY } = pendingFit;
        pendingFit = null;
        block.w = width;
        block.h = height;
        block.x = Math.round(Math.max(0, Math.min(SLIDE_WIDTH - width, centerX - width / 2)));
        block.y = Math.round(Math.max(0, Math.min(SLIDE_HEIGHT - height, centerY - height / 2)));
        persist();
        emit("block:geometry");
        return true;
    },

    /** Fits an image frame to its content without splitting a source change into two undo steps. */
    fitBlockToAspect(id, aspectRatio)
    {
        const block = this.block(id);
        const ratio = Number(aspectRatio);
        if (!block || !Number.isFinite(ratio) || ratio <= 0) return false;

        let width = block.w;
        let height = width / ratio;
        if (height > SLIDE_HEIGHT)
        {
            height = SLIDE_HEIGHT;
            width = height * ratio;
        }
        if (width > SLIDE_WIDTH)
        {
            width = SLIDE_WIDTH;
            height = width / ratio;
        }

        const minimumScale = Math.max(1, 32 / width, 32 / height);
        if (width * minimumScale <= SLIDE_WIDTH && height * minimumScale <= SLIDE_HEIGHT)
        {
            width *= minimumScale;
            height *= minimumScale;
        }
        else
        {
            const visibleScale = Math.max(1, 1 / width, 1 / height);
            if (width * visibleScale <= SLIDE_WIDTH && height * visibleScale <= SLIDE_HEIGHT)
            {
                width *= visibleScale;
                height *= visibleScale;
            }
        }

        width = Math.max(1, width);
        height = Math.max(1, height);
        const centerX = block.x + block.w / 2;
        const centerY = block.y + block.h / 2;
        block.w = width;
        block.h = height;
        block.x = Math.round(Math.max(0, Math.min(SLIDE_WIDTH - width, centerX - width / 2)));
        block.y = Math.round(Math.max(0, Math.min(SLIDE_HEIGHT - height, centerY - height / 2)));
        persist();
        emit("block:geometry");
        return true;
    },

    /** Applies a partial geometry update to one block. */
    moveBlock(id, geometry)
    {
        const block = this.block(id);
        if (!block) return false;
        return commit(() => Object.assign(block, geometry), "block:geometry");
    },

    /** Updates one editable property without replacing the block. */
    setBlockProp(id, key, value)
    {
        const block = this.block(id);
        if (!block) return false;
        return commit(() =>
        {
            block.props = { ...block.props, [key]: value };
        }, "block:prop", `${id}:${key}`);
    },

    /** Removes a block and clears its selection. */
    deleteBlock(id = selectedId)
    {
        const slide = this.slide();
        const blockIndex = slide.blocks.findIndex((block) => block.id === id);
        if (blockIndex < 0) return false;
        return commit(() =>
        {
            slide.blocks.splice(blockIndex, 1);
            if (selectedId === id) selectedId = null;
        }, "block:delete");
    },

    /** Duplicates a block with a small visible offset and a fresh id. */
    duplicateBlock(id = selectedId)
    {
        const original = this.block(id);
        if (!original) return null;

        const slide = this.slide();
        const copy = structuredClone(original);
        copy.id = createBlockId();
        copy.x = Math.min(SLIDE_WIDTH - copy.w, copy.x + 24);
        copy.y = Math.min(SLIDE_HEIGHT - copy.h, copy.y + 24);
        copy.z = slide.blocks.reduce((highest, item) => Math.max(highest, item.z), -1) + 1;

        commit(() =>
        {
            slide.blocks.push(copy);
            selectedId = copy.id;
        }, "block:add");

        return copy;
    },
    /** Aligns one block to a logical slide edge or center line. */
    align(where, id = selectedId)
    {
        const block = this.block(id);
        if (!block) return false;

        const geometry = {};
        if (where === "left") geometry.x = 0;
        if (where === "center") geometry.x = Math.round((SLIDE_WIDTH - block.w) / 2);
        if (where === "right") geometry.x = SLIDE_WIDTH - block.w;
        if (where === "top") geometry.y = 0;
        if (where === "middle") geometry.y = Math.round((SLIDE_HEIGHT - block.h) / 2);
        if (where === "bottom") geometry.y = SLIDE_HEIGHT - block.h;

        return commit(() => Object.assign(block, geometry), "block:geometry");
    },

    /** Moves one block within the current slide's paint order. */
    restack(direction, id = selectedId)
    {
        const block = this.block(id);
        if (!block) return false;

        const ordered = [...this.slide().blocks].sort((left, right) => left.z - right.z);
        const from = ordered.indexOf(block);
        let to = from;
        if (direction === "back") to = 0;
        if (direction === "backward") to = Math.max(0, from - 1);
        if (direction === "forward") to = Math.min(ordered.length - 1, from + 1);
        if (direction === "front") to = ordered.length - 1;
        if (to === from) return false;

        return commit(() =>
        {
            ordered.splice(from, 1);
            ordered.splice(to, 0, block);
            ordered.forEach((item, index) => { item.z = index; });
        }, "block:restack");
    }
};
