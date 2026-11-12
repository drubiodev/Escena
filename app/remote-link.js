// Serverless phone link: one WebRTC data channel, paired by passing an offer
// and an answer between the devices as QR codes (or pasted text). No server
// ever sees the traffic, and no STUN/TURN means both devices must share a network.

const RTC_CONFIG = { iceServers: [] };
const ICE_TIMEOUT_MS = 2500;
const CHANNEL_LABEL = "escena-remote";
const MAX_MESSAGE_CHARS = 60000;

function toBase64Url(bytes)
{
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text)
{
    const padded = text.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function pipe(bytes, stream)
{
    const result = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await result.arrayBuffer());
}

/** Packs a session description into a compact URL-safe string. */
export async function encodeSignal(description)
{
    const json = JSON.stringify({ t: description.type === "offer" ? "o" : "a", s: description.sdp });
    return toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw")));
}

/** Accepts a bare code, or any text/URL containing `pair=<code>`. */
export async function decodeSignal(input)
{
    const text = String(input).trim();
    const code = text.match(/pair=([\w-]+)/)?.[1] ?? text;
    try
    {
        const bytes = await pipe(fromBase64Url(code), new DecompressionStream("deflate-raw"));
        const { t, s } = JSON.parse(new TextDecoder().decode(bytes));
        if (!["o", "a"].includes(t) || typeof s !== "string") throw new Error();
        return { type: t === "o" ? "offer" : "answer", sdp: s };
    }
    catch { throw new Error("That pairing code is not valid."); }
}

function gathered(connection)
{
    if (connection.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) =>
    {
        const finish = () => { clearTimeout(timer); connection.removeEventListener("icegatheringstatechange", check); resolve(); };
        const check = () => { if (connection.iceGatheringState === "complete") finish(); };
        const timer = setTimeout(finish, ICE_TIMEOUT_MS);
        connection.addEventListener("icegatheringstatechange", check);
    });
}

/** JSON messages over the data channel; `state` is "connecting", "open" or "closed". */
class Link
{
    state = "connecting";
    onmessage = () => { };
    onstatechange = () => { };

    constructor(connection)
    {
        this.connection = connection;
        connection.addEventListener("connectionstatechange", () =>
        {
            if (["failed", "closed", "disconnected"].includes(connection.connectionState)) this.#set("closed");
        });
    }

    attach(channel)
    {
        this.channel = channel;
        channel.addEventListener("open", () => this.#set("open"));
        channel.addEventListener("close", () => this.#set("closed"));
        channel.addEventListener("message", ({ data }) =>
        {
            try { this.onmessage(JSON.parse(data)); } catch { /* ignore malformed frames */ }
        });
        if (channel.readyState === "open") this.#set("open");
    }

    send(message)
    {
        if (this.state !== "open") return false;
        const text = JSON.stringify(message);
        if (text.length > MAX_MESSAGE_CHARS) return false;
        this.channel.send(text);
        return true;
    }

    close()
    {
        this.#set("closed");
        this.channel?.close();
        this.connection.close();
    }

    #set(state)
    {
        if (this.state === state || this.state === "closed") return;
        this.state = state;
        this.onstatechange(state);
    }
}

/** Computer side: returns the offer code to show, and `accept` for the phone's answer code. */
export async function startHost()
{
    const connection = new RTCPeerConnection(RTC_CONFIG);
    const link = new Link(connection);
    link.attach(connection.createDataChannel(CHANNEL_LABEL));
    await connection.setLocalDescription(await connection.createOffer());
    await gathered(connection);
    return {
        code: await encodeSignal(connection.localDescription),
        link,
        async accept(answerText)
        {
            const description = await decodeSignal(answerText);
            if (description.type !== "answer") throw new Error("Paste the code shown on the phone, not the computer's code.");
            await connection.setRemoteDescription(description);
        },
    };
}

/** Phone side: consumes the offer code and returns the answer code to show back. */
export async function startGuest(offerText)
{
    const description = await decodeSignal(offerText);
    if (description.type !== "offer") throw new Error("That is not a computer pairing code.");
    const connection = new RTCPeerConnection(RTC_CONFIG);
    const link = new Link(connection);
    connection.addEventListener("datachannel", ({ channel }) => link.attach(channel));
    await connection.setRemoteDescription(description);
    await connection.setLocalDescription(await connection.createAnswer());
    await gathered(connection);
    return { code: await encodeSignal(connection.localDescription), link };
}
