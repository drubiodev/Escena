/** @type {Map<string, Object>} */
const definitions = new Map();

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
        const normalized = {
            label: definition.type,
            category: "Blocks",
            size: { w: 480, h: 200 },
            props: [],
            ...definition,
        };
        definitions.set(normalized.type, normalized);
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
};
