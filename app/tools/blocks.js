import { store } from "../store.js";
import { blockSchema } from "./catalog.js";

export const addBlockTool = {
    name: "add_block",
    description: "Add and select a block in the center of the current slide in edit mode. Use list_block_types and get_block_schema to discover types and properties. Omitted properties use defaults. Insertion is one undoable edit and is saved locally. The ladrillos type runs component source in a sandboxed iframe; use it only when the user requests a live component.",
    inputSchema: {
        type: "object",
        properties: {
            blockType: { type: "string", description: "A type returned by list_block_types." },
            props: { type: "object", description: "Optional properties matching get_block_schema for this type." },
        },
        required: ["blockType"],
        additionalProperties: false,
    },
    async execute(input)
    {
        if (!input || typeof input !== "object" || Array.isArray(input) ||
            Object.keys(input).some((key) => !["blockType", "props"].includes(key)) ||
            typeof input.blockType !== "string")
            throw new Error("Provide blockType and optional props. Use list_block_types to discover types.");
        if (store.mode() !== "edit")
            throw new Error("Exit presentation mode before adding a block.");
        if (store.slide().blocks.length >= 500)
            throw new Error("A slide can contain at most 500 blocks.");

        const schema = blockSchema(input.blockType);
        const props = input.props === undefined ? {} : input.props;
        if (!props || typeof props !== "object" || Array.isArray(props))
            throw new Error("props must be an object matching get_block_schema.");
        const normalized = {};
        for (const [key, value] of Object.entries(props))
        {
            if (!Object.hasOwn(schema.properties, key))
                throw new Error(`Unknown property: ${key}. Use get_block_schema.`);
            const field = schema.properties[key];
            if (typeof value !== field.type ||
                (field.enum && !field.enum.includes(value)) ||
                (field.type === "number" && (!Number.isFinite(value) ||
                    (field.minimum != null && value < field.minimum) ||
                    (field.maximum != null && value > field.maximum))))
                throw new Error(`Invalid value for ${key}. Use get_block_schema for allowed values.`);
            normalized[key] = field.type === "number" ? String(value) : value;
        }

        const slideId = store.slide().id;
        const block = store.addBlock(input.blockType, undefined, undefined, normalized);
        return { slideId, block: structuredClone(block), saveState: store.saveState() };
    },
};