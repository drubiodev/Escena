import { tools } from "./tools/index.js";

export async function installWebMCP()
{
    if (!document.modelContext?.registerTool) return;

    for (const tool of tools)
    {
        try
        {
            await document.modelContext.registerTool(tool);
        }
        catch (error)
        {
            console.warn(`WebMCP tool registration failed (${tool.name}):`, error);
        }
    }
}