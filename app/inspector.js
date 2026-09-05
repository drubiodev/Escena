import { $listen } from "ladrillosjs";
import { registry } from "./registry.js";
import { store } from "./store.js";

/**
 * Creates the native form control requested by a prop definition.
 * @param {Object} field Normalized property definition.
 * @returns {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement}
 */
function controlFor(field)
{
    if (field.type === "textarea" || field.type === "lines")
    {
        const textarea = document.createElement("textarea");
        textarea.rows = field.type === "lines" ? 5 : 4;
        return textarea;
    }

    if (field.type === "select" || field.type === "toggle")
    {
        const select = document.createElement("select");
        const options = field.type === "toggle"
            ? ["on", "off"]
            : field.options;
        for (const value of options)
        {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        }
        return select;
    }

    const input = document.createElement("input");
    input.type = ["color", "number", "range"].includes(field.type)
        ? field.type
        : "text";
    if (field.min != null) input.min = field.min;
    if (field.max != null) input.max = field.max;
    if (field.step != null) input.step = field.step;
    return input;
}

/** Reads a small image as a persistable data URL. */
function readImage(file)
{
    return new Promise((resolve, reject) =>
    {
        if (file.size > 1_500_000)
        {
            reject(new Error("Choose an image smaller than 1.5 MB"));
            return;
        }

        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result));
        reader.addEventListener("error", () => reject(reader.error));
        reader.readAsDataURL(file);
    });
}

/** Rebuilds the property form for one block definition. */
function buildFields(definition, fields)
{
    fields.replaceChildren();

    for (const field of definition.props)
    {
        const row = document.createElement("label");
        row.className = "inspector-row";
        row.append(document.createTextNode(field.label));

        const control = controlFor(field);
        control.dataset.key = field.key;
        const eventName = control.tagName === "SELECT" || control.type === "color"
            ? "change"
            : "input";
        control.addEventListener(eventName, () =>
        {
            const selected = store.selected();
            if (selected)
                store.setBlockProp(selected.id, field.key, control.value);
        });
        row.appendChild(control);

        if (field.type === "image")
        {
            const chooser = document.createElement("input");
            chooser.type = "file";
            chooser.accept = "image/*";
            chooser.addEventListener("change", async () =>
            {
                const file = chooser.files[0];
                const selected = store.selected();
                if (!file || !selected) return;

                try
                {
                    const dataUrl = await readImage(file);
                    store.setBlockProp(selected.id, field.key, dataUrl);
                }
                catch (error)
                {
                    window.alert(error.message);
                }
            });
            row.appendChild(chooser);
        }

        fields.appendChild(row);
    }
}
/** Mounts schema fields, common actions, and repaint behavior. */
export function mount($host, $refs)
{
    const { empty, blockPane, fields } = $refs;
    let renderedType = null;

    $host.addEventListener("input", (event) =>
    {
        const key = event.target.dataset.geo;
        const block = store.selected();
        if (!key || !block) return;

        const value = Math.round(Number(event.target.value));
        if (!Number.isFinite(value)) return;
        const minimum = key === "w" || key === "h" ? 32 : value;
        store.moveBlock(block.id, { [key]: Math.max(minimum, value) });
    });

    $host.addEventListener("click", (event) =>
    {
        const button = event.target.closest("button");
        if (!button) return;

        if (button.dataset.align) store.align(button.dataset.align);
        if (button.dataset.restack) store.restack(button.dataset.restack);
        if (button.dataset.action === "duplicate") store.duplicateBlock();
        if (button.dataset.action === "delete") store.deleteBlock();
    });

    /** Writes current values without changing the focused input's caret. */
    function paint()
    {
        const block = store.selected();
        if (!block) return;

        for (const control of fields.querySelectorAll("[data-key]"))
        {
            if (control === document.activeElement) continue;
            control.value = block.props[control.dataset.key] ?? "";
        }
        for (const control of blockPane.querySelectorAll("[data-geo]"))
        {
            if (control === document.activeElement) continue;
            control.value = Math.round(block[control.dataset.geo]);
        }
    }

    /** Rebuilds the schema form only when the selected block type changes. */
    function refresh()
    {
        const block = store.selected();
        empty.hidden = Boolean(block);
        blockPane.hidden = !block;
        if (!block) return;

        if (renderedType !== block.type)
        {
            renderedType = block.type;
            buildFields(registry.get(block.type), fields);
        }
        paint();
    }

    $listen("escena:change", ({ reason }) =>
    {
        if (["saved", "mode", "timer"].includes(reason)) return;
        if (["block:prop", "block:geometry", "block:restack"].includes(reason))
            paint();
        else
            refresh();
    });

    refresh();
}

