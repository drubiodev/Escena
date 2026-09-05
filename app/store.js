import { $emit } from "ladrillosjs";

import { STORE_CHANGE } from "./events.js";
import { STARTER_DECK } from "./starter-deck.js";

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
};
