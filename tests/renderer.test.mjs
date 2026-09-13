import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

class Element
{
    children = [];
    dataset = {};
    style = {};
    hidden = false;
    inert = false;
    events = [];
    get firstElementChild() { return this.children[0]; }
    dispatchEvent(event) { this.events.push(event); }
    setAttribute() {}
    appendChild(child)
    {
        child.parent = this;
        this.children.push(child);
    }
    replaceChildren(...children)
    {
        for (const child of [...this.children]) child.remove();
        for (const child of children) this.appendChild(child);
    }
    remove()
    {
        if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
        this.parent = null;
    }
}

async function setup()
{
    const context = vm.createContext({ CustomEvent, document: { createElement: () => new Element() } });
    const registry = new vm.SourceTextModule(await readFile(new URL("../app/registry.js", import.meta.url), "utf8"), { context });
    await registry.link(() => {});
    await registry.evaluate();
    registry.namespace.registry.define({ type: "test", path: "test.html", props: [{ key: "text", value: "" }] });
    const renderer = new vm.SourceTextModule(await readFile(new URL("../app/renderer.js", import.meta.url), "utf8"), { context });
    await renderer.link(() => registry);
    await renderer.evaluate();
    const surface = new Element();
    return { surface, cache: renderer.namespace.createSlideCache(surface) };
}

const slide = (id) => ({ id, blocks: [{ id: `${id}-block`, type: "test", x: 0, y: 0, w: 100, h: 100, z: 0, props: { text: id } }] });

test("returning to a slide preserves mounted block instances", async () =>
{
    const { cache, surface } = await setup();
    const first = slide("first");
    const frame = cache.show(first, "paper").get("first-block");
    const component = frame.children[0];
    cache.show(slide("second"), "paper");
    assert.equal(frame.parent, surface);
    assert.equal(frame.hidden, true);
    assert.equal(frame.inert, true);
    assert.equal(component.events.at(-1).detail.active, false);
    assert.equal(cache.show(first, "paper").get("first-block"), frame);
    assert.equal(frame.children[0], component);
    assert.equal(frame.hidden, false);
    assert.equal(frame.inert, false);
    assert.equal(component.events.at(-1).detail.active, true);
});

test("inactive editor surfaces pause their current blocks and clear stops them", async () =>
{
    const { cache } = await setup();
    const first = slide("first");
    const frame = cache.show(first, "paper").get("first-block");
    const component = frame.firstElementChild;
    cache.show(first, "paper", false);
    assert.equal(frame.hidden, false);
    assert.equal(frame.dataset.active, "false");
    assert.equal(component.events.at(-1).detail.active, false);
    const eventCount = component.events.length;
    cache.show(first, "paper", false);
    assert.equal(component.events.length, eventCount);
    cache.show(first, "paper");
    assert.equal(component.events.at(-1).detail.active, true);
    cache.clear();
    assert.equal(component.events.at(-1).detail.active, false);
});

test("only changed block content is reinitialized", async () =>
{
    const { cache, surface } = await setup();
    const first = slide("first");
    first.blocks.push(slide("other").blocks[0]);
    const frames = cache.show(first, "paper");
    const frame = frames.get("first-block");
    const component = frame.children[0];
    const other = frames.get("other-block").children[0];
    first.blocks[0].x = 50;
    first.notes = "Changed notes";
    first.background = "red";
    cache.show(first, "midnight");
    assert.equal(frame.children[0], component);
    assert.equal(frame.style.left, "50px");
    assert.equal(surface.dataset.theme, "midnight");
    assert.equal(surface.style.background, "red");
    first.blocks[0].props.text = "Changed";
    cache.show(first, "midnight");
    assert.notEqual(frame.children[0], component);
    assert.equal(frames.get("other-block").children[0], other);
    first.blocks.shift();
    cache.show(first, "midnight");
    assert.equal(frame.parent, null);
});

test("cache evicts least recently visited slides and clears deleted decks", async () =>
{
    const { cache, surface } = await setup();
    const first = slide("first");
    const frame = cache.show(first, "paper").get("first-block");
    for (let index = 0; index < 4; index++) cache.show(slide(String(index)), "paper");
    cache.show(first, "paper");
    cache.show(slide("last"), "paper");
    assert.equal(surface.children.length, 5);
    assert.equal(frame.parent, surface);
    cache.prune([first]);
    assert.equal(surface.children.length, 1);
    cache.clear();
    assert.equal(surface.children.length, 0);
});