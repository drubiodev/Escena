import { $listen } from "ladrillosjs";
import { registry } from "./registry.js";
import { store } from "./store.js";
import { paintIcons } from "./icons.js";

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

    if (field.type === "toggle")
    {
        const input = document.createElement("input");
        input.type = "checkbox";
        return input;
    }

    if (field.type === "select")
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

    // default
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
        row.classList.toggle("is-toggle", field.type === "toggle");
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
                store.setBlockProp(selected.id, field.key, control.type === "checkbox" ? (control.checked ? "on" : "off") : control.value);
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
    paintIcons($host);

    $host.addEventListener("input", (event) =>
    {
        if (event.target.dataset.slide) store.setSlideProp(event.target.dataset.slide, event.target.value);
    });

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

        if (button.dataset.themeChoice) store.setTheme(button.dataset.themeChoice);
        if (button.hasAttribute("data-reset-background")) store.setSlideProp("background", "");
        if (button.dataset.slideMove) store.moveSlide(store.currentIndex(), store.currentIndex() + Number(button.dataset.slideMove));

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
            if (control.type === "checkbox") control.checked = block.props[control.dataset.key] === "on";
            else control.value = block.props[control.dataset.key] ?? "";
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
        for (const control of empty.querySelectorAll("[data-slide]"))
        {
            if (document.activeElement === control) continue;
            const backgrounds = { default: "#f8f4ee", paper: "#ffffff", midnight: "#171c23", forest: "#163e36" };
            control.value = store.slide()[control.dataset.slide] || (control.type === "color" ? backgrounds[store.theme()] : "");
        }
        for (const choice of empty.querySelectorAll("[data-theme-choice]")) choice.setAttribute("aria-pressed", String(choice.dataset.themeChoice === store.theme()));
        empty.querySelector('[data-slide-move="-1"]').disabled = store.currentIndex() === 0;
        empty.querySelector('[data-slide-move="1"]').disabled = store.currentIndex() === store.slideCount() - 1;
        $refs.layers.replaceChildren(...[...store.slide().blocks].sort((left, right) => right.z - left.z).map((item) =>
        {
            const button = document.createElement("button");
            button.className = "layer-row";
            button.setAttribute("aria-pressed", String(item.id === store.selectedId()));
            const type = document.createElement("span");
            type.textContent = registry.get(item.type)?.label || item.type;
            const label = document.createElement("span");
            label.textContent = item.props.text || item.props.alt || item.type;
            button.append(type, label);
            button.addEventListener("click", () => store.select(item.id));
            return button;
        }));
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
        if (["block:prop", "block:geometry"].includes(reason))
            paint();
        else
            refresh();
    });

    refresh();
}

