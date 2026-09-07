/** @type {Map<string, Object>} */
const definitions = new Map();

/** Subscribers notified when a definition enters the catalog. */
const definitionListeners = new Set();

const PROP_TYPES = [
    "text",
    "textarea",
    "select",
    "color",
    "number",
    "range",
    "toggle",
    "lines",
    "image",
    "code",
];


/** Block catalog shared by rendering and editor UI. */
export const registry = {
    /**
     * Validates, normalizes, and stores one block definition.
     * @param {Object} definition The block manifest to register.
     * @returns {Object} The normalized definition stored by the registry.
     * @throws {Error} When type or component path is missing.
     */
    define(definition)
    {
        if (!definition?.type || !definition?.path)
            throw new Error("A block needs type and path");

        // Normalize once so every consumer receives a complete definition.
        const props = (definition.props || []).map((prop) => ({
            label: prop.key,
            type: "text",
            value: "",
            options: [],
            ...prop,
        }));

        for (const prop of props)
        {
            if (prop.type === "input") prop.type = "text";
            if (PROP_TYPES.includes(prop.type)) continue;
            console.warn(
                `Block "${definition.type}" property "${prop.key}" uses ` +
                `unknown control "${prop.type}"; using text instead.`
            );
            prop.type = "text";
        }

        const normalized = {
            label: definition.type,
            icon: definition.icon || "",
            category: "Blocks",
            size: { w: 480, h: 200 },
            ...definition,
            props,
        };

        definitions.set(normalized.type, normalized);
        definitionListeners.forEach((listener) => listener(normalized));
        return normalized;
    },
    /**
     * Registers several block definitions in order.
     * @param {Object[]} items The manifests to register.
     * @returns {Object[]} Their normalized definitions.
     */
    defineMany(items) { return items.map((item) => this.define(item)); },
    /**
     * Looks up one registered block type.
     * @param {string} type The block type key.
     * @returns {Object|null} Its definition, or null when unknown.
     */
    get(type) { return definitions.get(type) || null; },
    /** @returns {Object[]} All definitions in registration order. */
    all() { return [...definitions.values()]; },
    // Apply one custom-element naming rule everywhere.
    /**
     * Converts a block type into its custom-element tag name.
     * @param {string} type The block type key.
     * @returns {string} A valid custom-element name.
     */
    elementName(type) { return `${type}-block`; },
    /**
     * Builds fresh default props for a block instance.
     * @param {string} type The registered block type.
     * @returns {Object.<string, *>} A new key/value prop object.
     */
    defaults(type)
    {
        // Return a fresh prop object for each new block instance.
        const values = {};
        for (const prop of this.get(type)?.props || []) values[prop.key] = prop.value;
        return values;
    },
    /**
     * Adapts the catalog to LadrillosJS component definitions.
     * @returns {Object[]} Component registration records.
     */
    componentDefs()
    {
        // Adapt block definitions to LadrillosJS's registration contract.
        return this.all().map((definition) => ({
            name: this.elementName(definition.type),
            path: definition.path,
            useShadowDOM: definition.useShadowDOM !== false,
        }));
    },
    /**
 * Reports whether a block type is registered.
 * @param {string} type Block type key.
 * @returns {boolean} Whether the type exists.
 */
    has(type)
    {
        return definitions.has(type);
    },

    /**
     * Groups definitions for the palette without changing registration order.
     * @returns {{name: string, items: Object[]}[]} Ordered category groups.
     */
    byCategory()
    {
        const groups = new Map();
        for (const definition of this.all())
        {
            if (!groups.has(definition.category))
                groups.set(definition.category, []);
            groups.get(definition.category).push(definition);
        }

        return [...groups.entries()].map(([name, items]) => ({ name, items }));
    },

    /**
     * Subscribes to definitions added after startup.
     * @param {(definition: Object) => void} listener Definition callback.
     * @returns {() => void} Function that removes the callback.
     */
    onDefine(listener)
    {
        definitionListeners.add(listener);
        return () => definitionListeners.delete(listener);
    },
};

/**
 * Logical slide dimensions used for scaling and centering.
 * @type {number}
 */
export const SLIDE_WIDTH = 1280;
/** Logical slide dimensions used for scaling and centering.
 * @type {number}
 */
export const SLIDE_HEIGHT = 720;