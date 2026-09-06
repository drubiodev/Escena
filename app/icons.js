import { createElement, icons } from "lucide";

export function paintIcons(root = document)
{
    for (const node of root.querySelectorAll("[data-icon]"))
    {
        if (node.firstElementChild) continue;
        const icon = icons[node.dataset.icon];
        if (icon) node.append(createElement(icon, { width: 16, height: 16, "stroke-width": 1.6, "aria-hidden": "true" }));
    }
}