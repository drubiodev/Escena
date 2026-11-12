// Zero-dependency static server for Escena. Besides serving the folder, it
// reports this computer's LAN addresses at /__lan so the phone-remote dialog
// can fill in an address the phone can actually reach (browsers cannot find it).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT) || 5500;

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
};

// Home and office networks first; 169.254.x.x is a link-local fallback, not useful.
function lanAddresses()
{
    const rank = (address) => address.startsWith("192.168.") ? 0 : address.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(address) ? 2 : 3;
    return Object.values(networkInterfaces()).flat()
        .filter((entry) => entry && entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254."))
        .map((entry) => entry.address)
        .sort((left, right) => rank(left) - rank(right));
}

async function fileFor(pathname)
{
    const target = normalize(join(root, decodeURIComponent(pathname)));
    if (target !== root && !target.startsWith(root + sep)) return null;
    const info = await stat(target).catch(() => null);
    if (info?.isDirectory()) return fileFor(join(pathname, "index.html"));
    return info?.isFile() ? target : null;
}

createServer(async (request, response) =>
{
    try
    {
        const { pathname } = new URL(request.url, "http://localhost");
        if (pathname === "/__lan")
        {
            response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
            response.end(JSON.stringify({ addresses: lanAddresses(), port }));
            return;
        }
        const file = await fileFor(pathname);
        if (!file)
        {
            response.writeHead(404, { "content-type": "text/plain" });
            response.end("Not found");
            return;
        }
        response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
        response.end(await readFile(file));
    }
    catch
    {
        response.writeHead(400, { "content-type": "text/plain" });
        response.end("Bad request");
    }
}).listen(port, () =>
{
    console.log(`Serving!\n  Local:   http://localhost:${port}`);
    for (const address of lanAddresses()) console.log(`  Network: http://${address}:${port}`);
});
