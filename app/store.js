import { $emit } from "ladrillosjs";
import { STORE_CHANGE } from "./events.js";
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
function commit(change, reason)
{
    // The closure performs one document mutation; false means it was a no-op.
    const result = change();
    if (result === false) return false;
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
        emit(STORE_CHANGE.SLIDE);
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
        emit(STORE_CHANGE.SELECT);
    },

    setMode(value)
    {
        if (mode === value) return;
        mode = value;
        emit(STORE_CHANGE.MODE);
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

        commit(() =>
        {
            slide.blocks.push(block);
            selectedId = block.id;
        }, "block:add");

        return block;
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
        }, "block:prop");
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

};
