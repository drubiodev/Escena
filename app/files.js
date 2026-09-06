import { store } from "./store.js";
import { renderSlide } from "./renderer.js";
import { notify } from "./editor.js";

function filename(extension)
{
    return `${store.title().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "presentation"}.${extension}`;
}

function download(content, type, name)
{
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveDeck()
{
    // JSON is the editable original. HTML is a playable presentation copy.
    download(JSON.stringify(store.deck(), null, 2), "application/json", filename("escena.json"));
    notify("Presentation downloaded.");
}

export async function openDeck(file)
{
    if (!file) return;
    if (file.size > 20_000_000) throw new Error("Choose a deck smaller than 20 MB.");
    const raw = JSON.parse(await file.text());
    store.importDeck(raw);
    notify("Presentation opened. Undo restores the previous deck.");
}

// Native dialogs keep focus inside the decision and support Escape for free.
export function confirmNewDeck()
{
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute("aria-labelledby", "new-deck-title");
    dialog.innerHTML = '<h2 id="new-deck-title">Start a new presentation?</h2><p>The current local draft will be replaced. Download a copy to keep it.</p><form method="dialog"><button class="command-button" value="cancel">Cancel</button><button class="command-button" value="save">Download current</button><button class="command-button primary" value="new">New presentation</button></form>';
    dialog.addEventListener("close", () =>
    {
        if (dialog.returnValue === "save") saveDeck();
        if (dialog.returnValue === "new") store.newDeck();
        dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
}

async function waitForBlocks(surface)
{
    const deadline = performance.now() + 10000;
    while ([...surface.querySelectorAll(".frame > *")].some((block) => !(block.shadowRoot || block).firstElementChild))
    {
        if (performance.now() > deadline) throw new Error("Some blocks are still loading. Try the export again.");
        await new Promise(requestAnimationFrame);
    }
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
}

function snapshotNode(node)
{
    // Shadow DOM normally disappears when you serialize an element. Preserve it
    // as declarative shadow DOM, and turn drawn QR canvases into ordinary images.
    if (node.nodeType !== Node.ELEMENT_NODE) return node.cloneNode(true);
    if (node.tagName === "SCRIPT") return document.createTextNode("");
    if (node.tagName === "CANVAS")
    {
        const image = document.createElement("img");
        image.src = node.toDataURL();
        image.alt = node.getAttribute("aria-label") || "QR code";
        image.style.cssText = "display:block;width:100%;height:100%;image-rendering:pixelated";
        image.hidden = node.hidden;
        return image;
    }
    const clone = node.cloneNode(false);
    clone.removeAttribute("contenteditable");
    for (const attribute of [...clone.attributes]) if (attribute.name.startsWith("on")) clone.removeAttribute(attribute.name);
    if (node.tagName === "VIDEO")
    {
        clone.controls = true;
        clone.removeAttribute("autoplay");
        clone.setAttribute("preload", "metadata");
    }
    if (clone.matches(".play-toggle")) clone.hidden = true;
    if (node.shadowRoot)
    {
        const template = document.createElement("template");
        template.setAttribute("shadowrootmode", "open");
        // Ladrillos shares constructed stylesheets between instances. They are
        // not DOM nodes, so copy their rules into the exported shadow root.
        for (const sheet of node.shadowRoot.adoptedStyleSheets)
        {
            const style = document.createElement("style");
            style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
            template.content.append(style);
        }
        for (const child of node.shadowRoot.childNodes) template.content.append(snapshotNode(child));
        clone.append(template);
    }
    for (const child of node.childNodes) clone.append(snapshotNode(child));
    return clone;
}

export async function buildPlayerHTML()
{
    const deck = structuredClone(store.deck());
    const response = await fetch(new URL("./theme.css", import.meta.url));
    if (!response.ok) throw new Error("Could not load slide styles for export.");
    const css = await response.text();
    const staging = document.createElement("div");
    staging.className = "export-staging";
    staging.inert = true;
    document.body.append(staging);
    const slides = [];
    try
    {
        // Reuse the real renderer so exported blocks match the editor exactly.
        // Render one slide at a time to keep large decks from flooding the DOM.
        for (const slide of deck.slides)
        {
            const surface = document.createElement("section");
            surface.className = "slide-page export-slide";
            surface.setAttribute("aria-label", slide.name);
            staging.replaceChildren(surface);
            renderSlide(surface, slide, deck.theme, { preview: true });
            await waitForBlocks(surface);
            slides.push(snapshotNode(surface).outerHTML);
        }
    }
    finally { staging.remove(); }
    const title = document.createElement("span");
    title.textContent = deck.title;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.innerHTML}</title><style>${css}
body{background:#000}.export-slide{position:absolute;inset:auto;left:50%;top:50%;width:1280px;height:720px;transform-origin:center;overflow:hidden;box-shadow:none}.export-nav{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:16px;align-items:center;background:#191816ee;padding:6px 12px;border-radius:4px;z-index:100}.export-nav button{color:#fff;background:transparent;border:0;font-size:24px}.export-nav span{font-size:12px}.export-black .export-slide{visibility:hidden}
</style></head><body>${slides.join("\n")}<nav class="export-nav" aria-label="Presentation"><button id="prev" aria-label="Previous slide">&#8592;</button><span id="counter" aria-live="polite"></span><button id="next" aria-label="Next slide">&#8594;</button><button id="fullscreen" aria-label="Fullscreen" title="Fullscreen">&#9974;</button></nav><script>
const slides=[...document.querySelectorAll('.export-slide')];let index=0;
function pauseMedia(root){root.querySelectorAll('*').forEach(node=>{if(node.tagName==='VIDEO')node.pause();if(node.shadowRoot)pauseMedia(node.shadowRoot)})}
function draw(){slides.forEach((slide,position)=>{slide.hidden=position!==index;slide.style.transform='translate(-50%,-50%) scale('+Math.min(innerWidth/1280,innerHeight/720)+')';if(slide.hidden)pauseMedia(slide)});document.getElementById('counter').textContent=(index+1)+' / '+slides.length;document.getElementById('prev').disabled=index===0;document.getElementById('next').disabled=index===slides.length-1}
function go(delta){index=Math.max(0,Math.min(slides.length-1,index+delta));draw()}
document.getElementById('prev').onclick=()=>go(-1);document.getElementById('next').onclick=()=>go(1);document.getElementById('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
addEventListener('resize',draw);addEventListener('keydown',event=>{if(event.composedPath().some(node=>node.tagName==='VIDEO'))return;if(['ArrowRight','PageDown',' '].includes(event.key)){event.preventDefault();go(1)}if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();go(-1)}if(event.key.toLowerCase()==='b')document.body.classList.toggle('export-black');if(event.key==='Home'){index=0;draw()}if(event.key==='End'){index=slides.length-1;draw()}});draw();
<\/script></body></html>`;
}

export async function exportHTML()
{
    notify("Preparing presentation...");
    const html = await buildPlayerHTML();
    download(html, "text/html", filename("html"));
    notify("HTML player downloaded. Linked media still needs its source.");
}
