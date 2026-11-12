import { startHost } from "./remote-link.js";
import { drawQr } from "./qr-canvas.js";
import { paintIcons } from "./icons.js";
import { notify } from "./editor.js";

const BASE_KEY = "escena.phone.base";
const CAMERA_KEY = "escena.phone.camera";
const isLoopback = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);

function phoneUrl(baseText, code)
{
    let origin;
    try { origin = new URL(/^[a-z]+:\/\//i.test(baseText) ? baseText : `http://${baseText}`).origin; }
    catch { return null; }
    const path = new URL("./remote.html", location.href).pathname;
    return `${origin}${path}#pair=${code}`;
}

/** Pairs a phone. `onLink` receives the data-channel link once the phone connects. */
export function openPhoneDialog(onLink)
{
    if (document.querySelector("dialog[open]")) return;
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog phone-dialog";
    dialog.setAttribute("aria-label", "Connect phone remote");
    dialog.innerHTML = `
        <h2>Phone remote</h2>
        <p>Scan this with your phone camera, then show the code the phone displays to this computer's webcam.
            Both devices must be on the same Wi-Fi (or your phone's hotspot).</p>
        <label class="phone-field">Address your phone can reach
            <input data-field="base" list="phone-addresses" placeholder="http://192.168.1.20:5500" autocomplete="off" spellcheck="false">
            <datalist id="phone-addresses"></datalist>
        </label>
        <canvas class="phone-qr" aria-label="Pairing QR code" hidden></canvas>
        <p class="phone-status" role="status"></p>
        <video class="phone-scan" playsinline muted hidden></video>
        <select class="phone-camera" aria-label="Camera" hidden></select>
        <label class="phone-field" data-section="reply" hidden>Or paste the phone's code
            <textarea data-field="reply" rows="2" spellcheck="false"></textarea>
        </label>
        <form method="dialog">
            <button type="button" class="command-button" data-action="scan" hidden>Scan phone code</button>
            <button type="button" class="command-button" data-action="paste" hidden>Connect</button>
            <button class="command-button primary">Done</button>
        </form>`;
    const $ = (selector) => dialog.querySelector(selector);
    const baseInput = $('[data-field="base"]');
    const canvas = $(".phone-qr");
    const status = $(".phone-status");
    const video = $(".phone-scan");
    const cameraPicker = $(".phone-camera");
    const replyBox = $('[data-section="reply"]');
    const scanButton = $('[data-action="scan"]');
    const pasteButton = $('[data-action="paste"]');
    let pairing = null;
    let stream = null;
    let scanRun = 0;
    let closed = false;

    const say = (text) => { status.textContent = text; };
    baseInput.value = localStorage.getItem(BASE_KEY) || (isLoopback ? "" : location.origin);

    // Browsers can't see this computer's LAN address, but scripts/serve.mjs can.
    // Any other static server just returns an error and the field stays manual.
    async function detectAddress()
    {
        if (!isLoopback) return;
        try
        {
            const { addresses, port } = await (await fetch("/__lan", { cache: "no-store" })).json();
            if (!addresses?.length || closed) return;
            const urls = addresses.map((address) => `http://${address}:${port}`);
            $("datalist").replaceChildren(...urls.map((url) => Object.assign(document.createElement("option"), { value: url })));
            if (!urls.includes(baseInput.value))
            {
                baseInput.value = urls[0];
                await showQr();
            }
        }
        catch { /* not served by scripts/serve.mjs */ }
    }

    async function showQr()
    {
        if (!pairing) return;
        const url = baseInput.value.trim() && phoneUrl(baseInput.value.trim(), pairing.code);
        canvas.hidden = !url;
        if (!url) { say(isLoopback ? "Enter this computer's network address (not localhost)." : "That address is not valid."); return; }
        try
        {
            await drawQr(canvas, url);
            say("Waiting for the phone...");
        }
        catch (error) { canvas.hidden = true; say(`Could not draw the QR code: ${error.message}`); }
    }

    async function prepare()
    {
        say("Preparing a secure link...");
        try
        {
            pairing = await startHost();
            if (closed) { pairing.link.close(); return; }
            const { link } = pairing;
            link.onstatechange = (state) =>
            {
                if (state === "open")
                {
                    stopScan();
                    canvas.hidden = true;
                    replyBox.hidden = scanButton.hidden = pasteButton.hidden = true;
                    say("Phone connected. You can close this window.");
                    onLink(link);
                }
                else if (state === "closed" && !closed) say("The connection failed. Close this window and try again.");
            };
            scanButton.hidden = !navigator.mediaDevices?.getUserMedia;
            pasteButton.hidden = replyBox.hidden = false;
            await showQr();
        }
        catch (error) { say(`Could not start pairing: ${error.message}`); }
    }

    async function accept(text)
    {
        try { await pairing.accept(text); say("Connecting..."); return true; }
        catch (error) { say(error.message); return false; }
    }

    function stopScan()
    {
        scanRun++;
        stream?.getTracks().forEach((track) => track.stop());
        stream = null;
        video.hidden = true;
        video.srcObject = null;
        cameraPicker.hidden = true;
    }

    // Laptops with a built-in and an external webcam (or a virtual camera) need a choice;
    // labels only become available once camera permission has been granted.
    async function listCameras(activeId)
    {
        const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
        cameraPicker.replaceChildren(...cameras.map((camera, index) =>
            Object.assign(document.createElement("option"), { value: camera.deviceId, textContent: camera.label || `Camera ${index + 1}` })));
        if (activeId) cameraPicker.value = activeId;
        cameraPicker.hidden = cameras.length < 2;
    }

    async function openCamera(deviceId)
    {
        const wanted = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" };
        try { return await navigator.mediaDevices.getUserMedia({ video: wanted }); }
        catch (error)
        {
            // A remembered camera may be unplugged; fall back to the default one.
            if (deviceId && ["OverconstrainedError", "NotFoundError"].includes(error.name)) return navigator.mediaDevices.getUserMedia({ video: true });
            throw error;
        }
    }

    async function scan(deviceId = localStorage.getItem(CAMERA_KEY) || "")
    {
        if (typeof deviceId !== "string") deviceId = localStorage.getItem(CAMERA_KEY) || "";
        stopScan();
        const run = scanRun;
        try
        {
            const jsQR = (await import("jsqr")).default;
            const opened = await openCamera(deviceId);
            if (run !== scanRun || closed) { opened.getTracks().forEach((track) => track.stop()); return; }
            stream = opened;
            video.srcObject = stream;
            video.hidden = false;
            await video.play();
            await listCameras(stream.getVideoTracks()[0].getSettings().deviceId);
            say("Point the phone's code at the webcam...");
            const work = document.createElement("canvas");
            const context = work.getContext("2d", { willReadFrequently: true });
            const tick = async () =>
            {
                if (run !== scanRun) return;
                if (video.videoWidth)
                {
                    work.width = video.videoWidth;
                    work.height = video.videoHeight;
                    context.drawImage(video, 0, 0);
                    const image = context.getImageData(0, 0, work.width, work.height);
                    const found = jsQR(image.data, work.width, work.height, { inversionAttempts: "attemptBoth" });
                    if (found?.data && /^[\w-]{40,}$/.test(found.data.trim()))
                    {
                        stopScan();
                        await accept(found.data);
                        return;
                    }
                }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }
        catch (error)
        {
            stopScan();
            say(error.name === "NotAllowedError" ? "Camera access was blocked. Paste the phone's code instead." : `Could not start the camera: ${error.message}`);
        }
    }

    baseInput.addEventListener("input", () =>
    {
        localStorage.setItem(BASE_KEY, baseInput.value.trim());
        showQr();
    });
    scanButton.addEventListener("click", () => scan());
    cameraPicker.addEventListener("change", () =>
    {
        localStorage.setItem(CAMERA_KEY, cameraPicker.value);
        scan(cameraPicker.value);
    });
    pasteButton.addEventListener("click", () => { const text = $('[data-field="reply"]').value; if (text.trim()) accept(text); });
    dialog.addEventListener("close", () =>
    {
        closed = true;
        stopScan();
        if (pairing && pairing.link.state !== "open") pairing.link.close();
        dialog.remove();
    });
    (document.fullscreenElement || document.body).append(dialog);
    paintIcons(dialog);
    dialog.showModal();
    detectAddress();
    prepare().catch((error) => notify(error.message));
}
