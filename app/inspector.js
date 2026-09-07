import { $listen } from "ladrillosjs";
import { registry } from "./registry.js";
import { store } from "./store.js";
import { paintIcons } from "./icons.js";

const MONACO_CDN = "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1";
let monacoPromise;

/** Loads Monaco only when a code field is first selected. */
function loadMonaco()
{
    if (window.monaco) return Promise.resolve(window.monaco);
    if (monacoPromise) return monacoPromise;

    self.MonacoEnvironment = {
        getWorker(_workerId, label)
        {
            const root = `${MONACO_CDN}/esm/vs`;
            let path = "editor/editor.worker.js";
            if (label === "json") path = "language/json/json.worker.js";
            else if (["css", "scss", "less"].includes(label)) path = "language/css/css.worker.js";
            else if (["html", "handlebars", "razor"].includes(label)) path = "language/html/html.worker.js";
            else if (["typescript", "javascript"].includes(label)) path = "language/typescript/ts.worker.js";
            const source = ("im" + "port") + " " + JSON.stringify(`${root}/${path}`) + ";";
            const url = URL.createObjectURL(new Blob([source], { type: "application/javascript" }));
            return new Worker(url, { type: "module" });
        },
    };

    const styles = new Promise((resolve) =>
    {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.dataset.name = "vs/editor/editor.main";
        link.href = `${MONACO_CDN}/min/vs/editor/editor.main.css`;
        link.addEventListener("load", resolve, { once: true });
        link.addEventListener("error", resolve, { once: true });
        document.head.appendChild(link);
    });
    const api = new Promise((resolve, reject) =>
    {
        const loader = document.createElement("script");
        loader.src = `${MONACO_CDN}/min/vs/loader.js`;
        loader.addEventListener("load", () =>
        {
            window.require.config({ paths: { vs: `${MONACO_CDN}/min/vs` } });
            window.require(["vs/editor/editor.main"], () => resolve(window.monaco), reject);
        }, { once: true });
        loader.addEventListener("error", reject, { once: true });
        document.head.appendChild(loader);
    });

    monacoPromise = Promise.all([api, styles]).then(([monaco]) => monaco);
    return monacoPromise;
}

/** Creates a value-compatible control that upgrades to Monaco asynchronously. */
function codeControl()
{
    const host = document.createElement("div");
    host.className = "inspector-code-editor";
    host.setAttribute("role", "group");
    let value = "";
    let editor = null;
    let changeSubscription = null;
    let tagSubscription = null;

    Object.defineProperty(host, "value", {
        get: () => editor?.getValue() ?? value,
        set: (next) =>
        {
            value = String(next ?? "");
            if (editor && editor.getValue() !== value) editor.setValue(value);
        },
    });

    Promise.all([loadMonaco(), import("./code-editing.js")]).then(([monaco, { installTagClosing }]) =>
    {
        if (!host.isConnected) return;
        editor = monaco.editor.create(host, {
            value,
            language: "html",
            theme: "vs-dark",
            automaticLayout: true,
            autoIndent: "full",
            tabSize: 4,
            insertSpaces: true,
            fontSize: 12,
            lineHeight: 19,
            minimap: { enabled: false },
            folding: false,
            glyphMargin: false,
            lineNumbersMinChars: 3,
            overviewRulerLanes: 0,
            padding: { top: 8, bottom: 8 },
            scrollBeyondLastLine: false,
            stickyScroll: { enabled: false },
            wordWrap: "on",
        });
        editor.getContribution("editor.contrib.formatOnPaste");
        editor.updateOptions({ formatOnPaste: true });
        tagSubscription = installTagClosing(monaco, editor);
        changeSubscription = editor.onDidChangeModelContent(() =>
        {
            value = editor.getValue();
            host.dispatchEvent(new Event("input", { bubbles: true }));
        });
    }).catch(() =>
    {
        host.textContent = "Code editor could not load. Check your connection and reselect the block.";
        host.classList.add("is-error");
    });

    host.dispose = () =>
    {
        tagSubscription?.dispose();
        changeSubscription?.dispose();
        editor?.dispose();
    };
    return host;
}

/**
 * Creates the native form control requested by a prop definition.
 * @param {Object} field Normalized property definition.
 * @returns {HTMLElement}
 */
function controlFor(field)
{
    if (field.type === "code") return codeControl();

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
    for (const control of fields.querySelectorAll("[data-key]")) control.dispose?.();
    fields.replaceChildren();

    for (const field of definition.props)
    {
        const row = document.createElement(field.type === "code" ? "div" : "label");
        row.className = "inspector-row";
        row.classList.toggle("is-toggle", field.type === "toggle");
        row.append(document.createTextNode(field.label));

        const control = controlFor(field);
        control.dataset.key = field.key;
        control.setAttribute("aria-label", field.label);
        const eventName = control.tagName === "SELECT" || control.type === "color"
            ? "change"
            : "input";
        control.addEventListener(eventName, () =>
        {
            const selected = store.selected();
            if (!selected) return;
            const value = control.type === "checkbox" ? (control.checked ? "on" : "off") : control.value;
            if (field.type !== "code")
            {
                store.setBlockProp(selected.id, field.key, value);
                return;
            }

            clearTimeout(control.commitTimer);
            const blockId = selected.id;
            control.commitTimer = setTimeout(() =>
            {
                if (store.block(blockId)) store.setBlockProp(blockId, field.key, value);
            }, 300);
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
            if (control === document.activeElement || control.contains(document.activeElement)) continue;
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

