import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

async function setup()
{
    const calls = [];
    let handler;
    const context = vm.createContext({
        window: { addEventListener: (_type, listener) => { handler = listener; } },
        document: { querySelector: () => null },
        emit: (_name, detail) => calls.push(detail.name),
        store: {
            mode: () => "edit",
            selected: () => ({ id: "block", x: 0, y: 0 }),
            copyBlock: () => calls.push("copy"),
            pasteBlock: () => calls.push("paste"),
            deleteBlock: () => calls.push("delete"),
            moveBlock: () => calls.push("move"),
        },
    });
    const module = new vm.SourceTextModule(await readFile(new URL("../app/shortcuts.js", import.meta.url), "utf8"), { context });
    await module.link((specifier) => new vm.SourceTextModule(
        specifier === "ladrillosjs" ? "export const $emit = globalThis.emit;" : "export const store = globalThis.store;",
        { context }
    ));
    await module.evaluate();
    module.namespace.installShortcuts();
    return { calls, dispatch: (event) => handler(event) };
}

function keyEvent(key, options = {})
{
    return {
        key, metaKey: false, ctrlKey: false, defaultPrevented: false,
        composedPath: () => [],
        preventDefault() { this.defaultPrevented = true; },
        ...options,
    };
}

test("Monaco input surfaces keep clipboard, history, and editing keys", async () =>
{
    const { calls, dispatch } = await setup();
    const monaco = { matches: (selector) => selector.split(", ").includes(".monaco-editor") };
    for (const modifier of ["metaKey", "ctrlKey"])
    {
        for (const key of ["v", "c", "x", "z", "d", "s", "ArrowLeft", "Backspace"])
        {
            const event = keyEvent(key, { [modifier]: true, composedPath: () => [{}, monaco] });
            dispatch(event);
            assert.equal(event.defaultPrevented, false, key);
        }
    }
    assert.deepEqual(calls, []);
});

test("handled events are ignored while canvas block paste still works", async () =>
{
    const { calls, dispatch } = await setup();
    dispatch(keyEvent("v", { metaKey: true, defaultPrevented: true }));
    assert.deepEqual(calls, []);
    const event = keyEvent("v", { metaKey: true });
    dispatch(event);
    assert.deepEqual(calls, ["paste"]);
    assert.equal(event.defaultPrevented, true);
});