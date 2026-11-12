import test from "node:test";
import assert from "node:assert/strict";
import { encodeSignal, decodeSignal } from "../app/remote-link.js";

const sdp = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\na=ice-ufrag:abcd\r\na=fingerprint:sha-256 " + "AB:".repeat(31) + "AB\r\n";

test("signal codes round-trip and stay URL-safe", async () =>
{
    const code = await encodeSignal({ type: "offer", sdp });
    assert.match(code, /^[\w-]+$/);
    assert.deepEqual(await decodeSignal(code), { type: "offer", sdp });
    assert.equal((await decodeSignal(`http://192.168.1.2:5500/remote.html#pair=${code}`)).sdp, sdp);
});

test("answers keep their type and garbage is rejected", async () =>
{
    assert.equal((await decodeSignal(await encodeSignal({ type: "answer", sdp }))).type, "answer");
    await assert.rejects(decodeSignal("not-a-code"), /not valid/);
});
