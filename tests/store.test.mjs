import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function setup(savedDeck)
{
    const storage = new Map();
    if (savedDeck) storage.set("escena.studio.v1", savedDeck);
    const events = [];
    const context = vm.createContext({
        structuredClone, crypto, console,
        emit: (name, detail) => events.push({ name, ...detail }),
        localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    });
    const modules = new Map();
    // Only the browser boundary is fake. Tests run the real store, starter deck,
    // registry, and existing block definitions without downloading the CDN.
    async function load(file)
    {
        if (modules.has(file)) return modules.get(file);
        const source = file === "ladrillosjs" ? "export const $emit = globalThis.emit;" : await readFile(file, "utf8");
        const module = new vm.SourceTextModule(source, {
            context, identifier: file,
            initializeImportMeta: (meta) => { meta.url = pathToFileURL(file).href; },
        });
        modules.set(file, module);
        await module.link((specifier, parent) => load(specifier === "ladrillosjs" ? specifier : resolve(dirname(parent.identifier), specifier)));
        return module;
    }
    context.URL = URL;
    const definitions = await load(resolve(root, "blocks/index.js"));
    await definitions.evaluate();
    const module = await load(resolve(root, "app/store.js"));
    await module.evaluate();
    modules.get(resolve(root, "app/registry.js")).namespace.registry.defineMany(definitions.namespace.BUILT_IN_BLOCKS);
    const { store, validateDeck } = module.namespace;
    store.load();
    return { store, validateDeck, storage, events, context };
}

test("first-time users start with one blank slide and no history", async () =>
{
    const { store } = await setup();
    assert.equal(store.title(), "Untitled presentation");
    assert.equal(store.slideCount(), 1);
    assert.equal(store.slide().blocks.length, 0);
    assert.equal(store.slide().notes, "");
    assert.equal(store.canUndo(), false);
    assert.equal(store.canRedo(), false);
});

test("new heading and text blocks start empty", async () =>
{
    const { store } = await setup();
    for (const type of ["heading", "text"])
    {
        const block = store.addBlock(type);
        assert.equal(block.props.text, "");
        assert.equal(store.selectedId(), block.id);
    }
});

test("slide layouts, ordering and deletion are undoable", async () =>
{
    const { store } = await setup();
    store.addSlide("columns");
    assert.equal(store.slide().blocks.length, 3);
    store.undo();
    assert.equal(store.slideCount(), 1);
    store.redo();
    assert.equal(store.slideCount(), 2);
    const active = store.slide().id;
    store.moveSlide(1, 0);
    assert.equal(store.slide().id, active);
    assert.equal(store.currentIndex(), 0);
    store.duplicateSlide();
    const ids = store.slides().flatMap((slide) => [slide.id, ...slide.blocks.map((block) => block.id)]);
    assert.equal(new Set(ids).size, ids.length);
    store.deleteSlide();
    store.deleteSlide();
    assert.equal(store.deleteSlide(), false);
    assert.equal(store.slideCount(), 1);
});

test("typing coalesces, navigation does not enter history, new edits discard redo", async () =>
{
    const { store } = await setup();
    const added = store.addBlock("heading");
    const saved = await setup(JSON.stringify(store.deck()));
    const block = saved.store.block(added.id);
    const editingStore = saved.store;
    const original = block.props.text;
    editingStore.select(block.id);
    assert.equal(editingStore.canUndo(), false);
    editingStore.setBlockProp(block.id, "text", "Hello");
    editingStore.setBlockProp(block.id, "text", "Hello again");
    editingStore.undo();
    assert.equal(editingStore.block(block.id).props.text, original);
    editingStore.redo();
    assert.equal(editingStore.block(block.id).props.text, "Hello again");
    editingStore.undo();
    editingStore.setTitle("A new title");
    assert.equal(editingStore.canRedo(), false);
});

test("copy and paste work across slides without sharing props", async () =>
{
    const { store } = await setup();
    const source = store.addBlock("heading");
    store.select(source.id);
    store.copyBlock();
    store.addSlide();
    store.pasteBlock();
    const copy = store.selected();
    assert.notEqual(copy.id, source.id);
    store.setBlockProp(copy.id, "text", "Different text");
    assert.notEqual(source.props.text, copy.props.text);
    store.undo();
    store.undo();
    assert.equal(store.slide().blocks.length, 0);
});

test("new block fitting stays within its original undo step", async () =>
{
    const { store } = await setup();
    const block = store.addBlock("heading", 100, 100);
    assert.equal(store.fitNewBlock(block.id, { w: 240, h: 80 }), true);
    assert.deepEqual(
        { x: block.x, y: block.y, w: block.w, h: block.h },
        { x: 0, y: 60, w: 240, h: 80 }
    );
    store.undo();
    assert.equal(store.block(block.id), null);
    store.redo();
    assert.deepEqual(
        { x: store.block(block.id).x, y: store.block(block.id).y, w: store.block(block.id).w, h: store.block(block.id).h },
        { x: 0, y: 60, w: 240, h: 80 }
    );
});

test("image aspect fitting stays with the source edit", async () =>
{
    const { store } = await setup();
    const block = store.addBlock("image");
    store.setBlockProp(block.id, "src", "data:image/example");
    assert.equal(store.fitBlockToAspect(block.id, 3 / 2), true);
    assert.deepEqual(
        { x: block.x, y: block.y, w: block.w, h: block.h },
        { x: 280, y: 120, w: 720, h: 480 }
    );
    store.undo();
    assert.equal(store.block(block.id).props.src, "");
    assert.deepEqual(
        { x: store.block(block.id).x, y: store.block(block.id).y, w: store.block(block.id).w, h: store.block(block.id).h },
        { x: 280, y: 270, w: 720, h: 180 }
    );
    store.redo();
    assert.deepEqual(
        { src: store.block(block.id).props.src, w: store.block(block.id).w, h: store.block(block.id).h },
        { src: "data:image/example", w: 720, h: 480 }
    );
    store.fitBlockToAspect(block.id, 30);
    assert.deepEqual(
        { w: store.block(block.id).w, h: store.block(block.id).h },
        { w: 960, h: 32 }
    );
});

test("invalid imports are atomic and duplicate IDs are repaired", async () =>
{
    const { store, validateDeck } = await setup();
    store.addBlock("heading");
    const before = JSON.stringify(store.deck());
    for (const raw of [null, {}, { slides: [] }, { slides: [{ blocks: [{ type: "unknown" }] }] }])
        assert.throws(() => store.importDeck(raw));
    assert.equal(JSON.stringify(store.deck()), before);
    const invalid = structuredClone(store.deck());
    invalid.slides[0].blocks[0].w = -1;
    assert.throws(() => validateDeck(invalid));
    const duplicates = structuredClone(store.deck());
    duplicates.slides.push(structuredClone(duplicates.slides[0]));
    const fixed = validateDeck(duplicates);
    const ids = fixed.slides.flatMap((slide) => [slide.id, ...slide.blocks.map((block) => block.id)]);
    assert.equal(ids.length, new Set(ids).size);
});

test("saved decks reload, corrupt storage falls back, failed saves are visible", async () =>
{
    const { store, storage, context } = await setup();
    store.setTitle("Saved presentation");
    store.setTheme("forest");
    const heading = store.addBlock("heading");
    store.setBlockProp(heading.id, "text", "My saved heading");
    const text = store.addBlock("text");
    store.setBlockProp(text.id, "text", "My saved paragraph");
    const restored = await setup(storage.get("escena.studio.v1"));
    assert.equal(restored.store.title(), "Saved presentation");
    assert.equal(restored.store.theme(), "forest");
    assert.equal(restored.store.block(heading.id).props.text, "My saved heading");
    assert.equal(restored.store.block(text.id).props.text, "My saved paragraph");
    const corrupt = await setup("not json");
    assert.equal(corrupt.store.slideCount(), 1);
    assert.equal(corrupt.store.slide().blocks.length, 0);
    assert.match(corrupt.store.saveState(), /Could not restore/);
    context.localStorage.setItem = () => { throw new Error("Quota exceeded"); };
    store.setTitle("Still editable");
    assert.equal(store.title(), "Still editable");
    assert.match(store.saveState(), /unavailable/);
});

test("Ladrillos blocks need no tag and preserve code from older decks", async () =>
{
    const { store, validateDeck } = await setup();
    const block = store.addBlock("ladrillos", 100, 100);
    assert.equal(Object.hasOwn(block.props, "tag"), false);
    const code = '<p>Hello {name} hello</p><script>let name = "daniel";</script>';
    store.setBlockProp(block.id, "code", code);
    const legacy = structuredClone(store.deck());
    legacy.slides[0].blocks.find((item) => item.id === block.id).props.tag = "test-component";
    const restored = validateDeck(legacy).slides[0].blocks.find((item) => item.id === block.id);
    assert.equal(restored.props.code, code);
    assert.equal(Object.hasOwn(restored.props, "tag"), false);
});

test("Ladrillos appearance options persist and older blocks receive defaults", async () =>
{
    const { store, validateDeck } = await setup();
    const block = store.addBlock("ladrillos", 100, 100);
    const appearance = { border: "off", shadow: "off", radius: "0", inset: "15" };
    for (const [key, value] of Object.entries(appearance)) store.setBlockProp(block.id, key, value);
    const saved = structuredClone(store.deck());
    const restored = validateDeck(saved).slides[0].blocks.find((item) => item.id === block.id);
    for (const [key, value] of Object.entries(appearance)) assert.equal(restored.props[key], value);

    const legacy = saved.slides[0].blocks.find((item) => item.id === block.id);
    legacy.props.transparent = "on";
    legacy.props.background = "#187b78";
    for (const key of Object.keys(appearance)) delete legacy.props[key];
    const upgraded = validateDeck(saved).slides[0].blocks.find((item) => item.id === block.id);
    assert.equal(upgraded.props.border, "on");
    assert.equal(upgraded.props.shadow, "on");
    assert.equal(Object.hasOwn(upgraded.props, "transparent"), false);
    assert.equal(upgraded.props.background, "#187b78");
    assert.equal(upgraded.props.radius, "6");
    assert.equal(upgraded.props.inset, "10");
});

test("code snippets preserve source and display options through save and import", async () =>
{
    const { store, validateDeck } = await setup();
    const block = store.addBlock("code", 100, 100);
    assert.equal(block.props.language, "javascript");
    const source = '<script>const value = "<&>";</script>\n<div>{notExecuted}</div>';
    const props = { code: source, language: "html", filename: "example.html", theme: "light", size: "30", lineNumbers: "off", header: "off", shadow: "off" };
    for (const [key, value] of Object.entries(props)) store.setBlockProp(block.id, key, value);
    const saved = JSON.stringify(store.deck());
    const imported = validateDeck(JSON.parse(saved)).slides[0].blocks.find((item) => item.id === block.id);
    for (const [key, value] of Object.entries(props)) assert.equal(imported.props[key], value);
    const restored = await setup(saved);
    assert.equal(restored.store.block(block.id).props.code, source);
    assert.equal(restored.store.block(block.id).props.language, "html");
});

test("new and imported decks can be undone", async () =>
{
    const { store } = await setup();
    const before = JSON.stringify(store.deck());
    store.newDeck();
    assert.equal(store.slide().blocks.length, 0);
    store.undo();
    assert.equal(JSON.stringify(store.deck()), before);
    const incoming = structuredClone(store.deck());
    incoming.title = "Imported";
    store.importDeck(incoming);
    assert.equal(store.title(), "Imported");
    store.undo();
    assert.equal(JSON.stringify(store.deck()), before);
});