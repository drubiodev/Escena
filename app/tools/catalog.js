import { registry } from "../registry.js";

export function blockSchema(blockType)
{
    const definition = registry.get(blockType);
    if (!definition) throw new Error(`Unknown block type: ${blockType}. Use list_block_types.`);

    const properties = Object.fromEntries(definition.props.map((field) =>
    {
        const numeric = ["number", "range"].includes(field.type);
        const schema = {
            type: numeric ? "number" : "string",
            description: field.description || field.label,
            default: numeric ? Number(field.value) : field.value,
        };
        if (field.type === "select") schema.enum = [...field.options];
        if (field.type === "toggle") schema.enum = ["on", "off"];
        if (numeric)
        {
            if (field.min != null) schema.minimum = Number(field.min);
            if (field.max != null) schema.maximum = Number(field.max);
        }
        return [field.key, schema];
    }));
    return { type: "object", properties, additionalProperties: false };
}

export const listBlockTypesTool = {
    name: "list_block_types",
    description: "List the currently registered block types and default sizes in logical slide pixels. Use get_block_schema for configurable properties.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async execute(input = {})
    {
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length)
            throw new Error("list_block_types accepts an empty object.");
        return registry.all().map((definition) => ({
            type: definition.type,
            label: definition.label,
            category: definition.category,
            description: definition.description || definition.label,
            size: { ...definition.size },
        }));
    },
};

export const getBlockSchemaTool = {
    name: "get_block_schema",
    description: "Get the current property schema and defaults for a block type. Pass these properties to add_block. Numeric properties use numbers; toggles use on/off strings. Omitted properties use their defaults.",
    inputSchema: {
        type: "object",
        properties: { blockType: { type: "string", description: "A type returned by list_block_types." } },
        required: ["blockType"],
        additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async execute(input)
    {
        if (!input || typeof input !== "object" || Array.isArray(input) ||
            Object.keys(input).some((key) => key !== "blockType") || typeof input.blockType !== "string")
            throw new Error("Provide a blockType string.");
        return { blockType: input.blockType, propsSchema: blockSchema(input.blockType) };
    },
};