import { startGuest } from "./remote-link.js";
import { drawQr } from "./qr-canvas.js";

const $ = (id) => document.getElementById(id);
const FONT_KEY = "escena.remote.notesSize";
const MIN_FONT = 14;
const MAX_FONT = 44;

const status = $("status");
const say = (text) => { status.textContent = text; };

let fontSize = Number(localStorage.getItem(FONT_KEY)) || 22;
function applyFont(delta = 0)
{
    fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize + delta));
    document.documentElement.style.setProperty("--notes-size", `${fontSize}px`);
    localStorage.setItem(FONT_KEY, String(fontSize));
}
applyFont();
$("smaller").addEventListener("click", () => applyFont(-2));
$("larger").addEventListener("click", () => applyFont(2));

function formatTime(seconds)
{
    return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

async function keepAwake()
{
    try
    {
        let lock = await navigator.wakeLock?.request("screen");
        document.addEventListener("visibilitychange", async () =>
        {
            if (document.visibilityState === "visible" && lock?.released) lock = await navigator.wakeLock.request("screen").catch(() => lock);
        });
    }
    catch { /* Wake lock needs a secure context; the phone may simply dim. */ }
}

function showRemote(link)
{
    $("pairing").hidden = true;
    $("remote").hidden = false;
    $("controls").hidden = false;
    $("clock").hidden = false;
    keepAwake();

    let state = null;
    let receivedAt = 0;
    const prev = document.querySelector('[data-command="prev"]');
    const next = document.querySelector('[data-command="next"]');
    const editButton = $("edit-notes");
    const editor = $("notes-editor");
    const notesView = $("notes");
    const EMPTY_NOTES = "No notes for this slide.";

    // Notes editing: edits are sent shortly after typing stops, addressed by slide id.
    // While an edit is unconfirmed, incoming copies of that slide's notes are ignored
    // so the computer's older text can't overwrite what was just typed.
    let editing = false;
    let editId = "";
    let pending = false;
    let timer = 0;
    let inFlight = 0;
    let heldId = "";

    const holdsNotes = (id) => id === heldId && (editing || inFlight > 0);

    function flush()
    {
        clearTimeout(timer);
        if (!pending) return;
        pending = false;
        if (link.send({ type: "notes", id: editId, text: editor.value }))
        {
            inFlight++;
            heldId = editId;
            $("save-state").textContent = "Saving...";
        }
        else $("save-state").textContent = "Not saved: connection lost";
    }

    function startEdit()
    {
        if (!state?.id || state.truncated) return;
        editing = true;
        editId = heldId = state.id;
        editor.value = state.notes;
        notesView.hidden = true;
        editor.hidden = false;
        $("controls").hidden = true;
        editButton.textContent = "Done";
        editor.focus();
    }

    function stopEdit()
    {
        flush();
        editing = false;
        notesView.textContent = editor.value || EMPTY_NOTES;
        editor.hidden = true;
        notesView.hidden = false;
        $("controls").hidden = false;
        editButton.textContent = "Edit notes";
    }

    editButton.addEventListener("click", () => (editing ? stopEdit() : startEdit()));
    editor.addEventListener("input", () =>
    {
        pending = true;
        $("save-state").textContent = "Editing...";
        clearTimeout(timer);
        timer = setTimeout(flush, 500);
    });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    window.addEventListener("pagehide", flush);

    link.onmessage = (data) =>
    {
        if (data?.type === "saved")
        {
            inFlight = Math.max(0, inFlight - 1);
            if (!pending && !inFlight) $("save-state").textContent = "Saved";
            return;
        }
        if (data?.type !== "remote") return;
        // The slide changed under an open editor: save it, then follow along.
        if (editing && data.id !== editId) stopEdit();
        state = data;
        receivedAt = Date.now();
        $("title").textContent = data.title;
        $("counter").textContent = `${data.index + 1} / ${data.count}`;
        $("slide-name").textContent = data.name;
        if (!holdsNotes(data.id) && $("notes").textContent !== (data.notes || EMPTY_NOTES))
        {
            notesView.textContent = data.notes || EMPTY_NOTES;
            document.querySelector("main").scrollTop = 0;
        }
        editButton.disabled = !data.id || data.truncated;
        $("next-up").textContent = data.next ? `Up next: ${data.next}` : "Last slide";
        say(!data.presenting ? "Start presenting on the computer" : data.black ? "Screen is blacked out" : "Connected");
        prev.disabled = !data.presenting || data.index === 0;
        next.disabled = !data.presenting || data.index === data.count - 1;
    };

    document.addEventListener("click", (event) =>
    {
        const name = event.target.closest("[data-command]")?.dataset.command;
        if (name) link.send({ type: "command", name });
    });
    $("clock").addEventListener("click", () => link.send({ type: "command", name: "resetTimer" }));

    // The computer only pushes on change, so ask periodically. Silence means it went away.
    const heartbeat = setInterval(() =>
    {
        link.send({ type: "hello" });
        if (state?.presenting) $("clock").textContent = formatTime(state.elapsed + Math.floor((Date.now() - receivedAt) / 1000));
        if (state && Date.now() - receivedAt > 8000) say("Computer not responding...");
    }, 1000);

    link.onstatechange = (value) =>
    {
        if (value !== "closed") return;
        clearInterval(heartbeat);
        prev.disabled = next.disabled = true;
        say("Disconnected. Scan the QR code on the computer again.");
    };
    link.send({ type: "hello" });
}

async function main()
{
    const offer = location.hash.match(/pair=([\w-]+)/)?.[1];
    if (!offer)
    {
        say("Open this page by scanning the QR code in Escena (Phone remote).");
        return;
    }
    say("Preparing...");
    try
    {
        const { code, link } = await startGuest(offer);
        link.onstatechange = (state) =>
        {
            if (state === "open") showRemote(link);
            else if (state === "closed") say("Could not connect. Make sure both devices are on the same network, then scan again.");
        };
        $("pairing").hidden = false;
        $("answer-code").textContent = code;
        $("copy-code").addEventListener("click", () => navigator.clipboard?.writeText(code).then(() => say("Code copied.")).catch(() => say("Select the code and copy it manually.")));
        await drawQr($("answer-qr"), code);
        say("Show this code to the computer's webcam");
    }
    catch (error) { say(error.message); }
}

main();
