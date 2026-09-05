import
    {
        $listen,
    } from "ladrillosjs";

import { store } from "./store.js";

export function installCommands()
{
    $listen("escena:command", (command) =>
    {
        switch (command?.name)
        {
            case "block:add":
                store.addBlock(command.type);
                break;
            default:
                break;
        }
    });
}
