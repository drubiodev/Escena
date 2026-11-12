/** Draws `text` as a QR code on `canvas`. The encoder library loads on first use. */
export async function drawQr(canvas, text)
{
    const qrcode = (await import("qrcode-generator")).default;
    const qr = qrcode(0, "L");
    qr.addData(text);
    qr.make();
    const modules = qr.getModuleCount();
    const cell = 4;
    const margin = 4 * cell;
    const size = modules * cell + margin * 2;
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, size, size);
    context.fillStyle = "#111";
    for (let row = 0; row < modules; row++)
        for (let column = 0; column < modules; column++)
            if (qr.isDark(row, column)) context.fillRect(margin + column * cell, margin + row * cell, cell, cell);
}
