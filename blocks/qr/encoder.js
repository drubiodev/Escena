const VERSION_DATA = [
    { version: 1, size: 21, dataCodewords: 19, eccCodewords: 7, align: [] },
    { version: 2, size: 25, dataCodewords: 34, eccCodewords: 10, align: [6, 18] },
    { version: 3, size: 29, dataCodewords: 55, eccCodewords: 15, align: [6, 22] },
    { version: 4, size: 33, dataCodewords: 80, eccCodewords: 20, align: [6, 26] },
    { version: 5, size: 37, dataCodewords: 108, eccCodewords: 26, align: [6, 30] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
let fieldValue = 1;
for (let index = 0; index < 255; index++)
{
    GF_EXP[index] = fieldValue;
    GF_LOG[fieldValue] = index;
    fieldValue <<= 1;
    if (fieldValue & 0x100) fieldValue ^= 0x11d;
}
for (let index = 255; index < GF_EXP.length; index++)
    GF_EXP[index] = GF_EXP[index - 255];

function multiply(left, right)
{
    if (left === 0 || right === 0) return 0;
    return GF_EXP[GF_LOG[left] + GF_LOG[right]];
}

function multiplyPolynomials(left, right)
{
    const result = new Uint8Array(left.length + right.length - 1);
    for (let leftIndex = 0; leftIndex < left.length; leftIndex++)
        for (let rightIndex = 0; rightIndex < right.length; rightIndex++)
            result[leftIndex + rightIndex] ^=
                multiply(left[leftIndex], right[rightIndex]);
    return result;
}

function generatorPolynomial(degree)
{
    let result = Uint8Array.of(1);
    for (let index = 0; index < degree; index++)
        result = multiplyPolynomials(result, Uint8Array.of(1, GF_EXP[index]));
    return result;
}

function errorCorrection(data, count)
{
    const generator = generatorPolynomial(count);
    const result = new Uint8Array(data.length + count);
    result.set(data);

    for (let index = 0; index < data.length; index++)
    {
        const factor = result[index];
        if (factor === 0) continue;
        for (let offset = 0; offset < generator.length; offset++)
            result[index + offset] ^= multiply(generator[offset], factor);
    }

    return result.slice(data.length);
}

function appendBits(bits, value, length)
{
    for (let shift = length - 1; shift >= 0; shift--)
        bits.push((value >>> shift) & 1);
}

function makeCodewords(bytes, config)
{
    const capacity = config.dataCodewords * 8;
    const bits = [];
    appendBits(bits, 0b0100, 4);
    appendBits(bits, bytes.length, 8);
    for (const byte of bytes) appendBits(bits, byte, 8);

    appendBits(bits, 0, Math.min(4, capacity - bits.length));
    while (bits.length % 8) bits.push(0);

    const data = [];
    for (let index = 0; index < bits.length; index += 8)
    {
        let value = 0;
        for (let offset = 0; offset < 8; offset++)
            value = (value << 1) | bits[index + offset];
        data.push(value);
    }
    for (let pad = 0; data.length < config.dataCodewords; pad++)
        data.push(pad % 2 === 0 ? 0xec : 0x11);

    const dataBytes = Uint8Array.from(data);
    return Uint8Array.from([
        ...dataBytes,
        ...errorCorrection(dataBytes, config.eccCodewords),
    ]);
}

function makeGrid(size, value = null)
{
    return Array.from({ length: size }, () => Array(size).fill(value));
}

function setFunction(matrix, reserved, row, column, dark)
{
    if (row < 0 || column < 0 || row >= matrix.length || column >= matrix.length)
        return;
    matrix[row][column] = dark;
    reserved[row][column] = true;
}

function drawFinder(matrix, reserved, top, left)
{
    for (let row = -1; row <= 7; row++)
    {
        for (let column = -1; column <= 7; column++)
        {
            const inside = row >= 0 && row <= 6 && column >= 0 && column <= 6;
            const dark = inside && (
                row === 0 || row === 6 || column === 0 || column === 6 ||
                (row >= 2 && row <= 4 && column >= 2 && column <= 4)
            );
            setFunction(matrix, reserved, top + row, left + column, dark);
        }
    }
}

function drawAlignment(matrix, reserved, centerRow, centerColumn)
{
    for (let row = -2; row <= 2; row++)
        for (let column = -2; column <= 2; column++)
            setFunction(
                matrix,
                reserved,
                centerRow + row,
                centerColumn + column,
                Math.max(Math.abs(row), Math.abs(column)) !== 1
            );
}

function formatBits(mask)
{
    const data = (0b01 << 3) | mask;
    let remainder = data;
    for (let index = 0; index < 10; index++)
        remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    return ((data << 10) | remainder) ^ 0x5412;
}

function drawFormat(matrix, reserved, mask)
{
    const size = matrix.length;
    const bits = formatBits(mask);
    const set = (row, column, bit) =>
        setFunction(matrix, reserved, row, column, ((bits >>> bit) & 1) !== 0);

    for (let index = 0; index <= 5; index++) set(index, 8, index);
    set(7, 8, 6);
    set(8, 8, 7);
    set(8, 7, 8);
    for (let index = 9; index < 15; index++) set(8, 14 - index, index);

    for (let index = 0; index < 8; index++) set(8, size - 1 - index, index);
    for (let index = 8; index < 15; index++) set(size - 15 + index, 8, index);
    setFunction(matrix, reserved, size - 8, 8, true);
}

function drawFunctions(config)
{
    const matrix = makeGrid(config.size);
    const reserved = makeGrid(config.size, false);
    drawFinder(matrix, reserved, 0, 0);
    drawFinder(matrix, reserved, 0, config.size - 7);
    drawFinder(matrix, reserved, config.size - 7, 0);

    for (let index = 8; index < config.size - 8; index++)
    {
        setFunction(matrix, reserved, 6, index, index % 2 === 0);
        setFunction(matrix, reserved, index, 6, index % 2 === 0);
    }

    for (const row of config.align)
        for (const column of config.align)
            if (!reserved[row][column]) drawAlignment(matrix, reserved, row, column);

    drawFormat(matrix, reserved, 0);
    return { matrix, reserved };
}

function placeData(matrix, reserved, codewords)
{
    const size = matrix.length;
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2)
    {
        if (right === 6) right--;
        for (let vertical = 0; vertical < size; vertical++)
        {
            const upward = ((right + 1) & 2) === 0;
            const row = upward ? size - 1 - vertical : vertical;
            for (let offset = 0; offset < 2; offset++)
            {
                const column = right - offset;
                if (reserved[row][column]) continue;
                const byte = codewords[bitIndex >>> 3];
                matrix[row][column] = bitIndex < codewords.length * 8
                    ? ((byte >>> (7 - (bitIndex & 7))) & 1) !== 0
                    : false;
                bitIndex++;
            }
        }
    }
}

function isMasked(mask, row, column)
{
    const product = row * column;
    switch (mask)
    {
        case 0: return (row + column) % 2 === 0;
        case 1: return row % 2 === 0;
        case 2: return column % 3 === 0;
        case 3: return (row + column) % 3 === 0;
        case 4: return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
        case 5: return product % 2 + product % 3 === 0;
        case 6: return (product % 2 + product % 3) % 2 === 0;
        case 7: return ((row + column) % 2 + product % 3) % 2 === 0;
        default: return false;
    }
}

function applyMask(matrix, reserved, mask)
{
    for (let row = 0; row < matrix.length; row++)
        for (let column = 0; column < matrix.length; column++)
            if (!reserved[row][column] && isMasked(mask, row, column))
                matrix[row][column] = !matrix[row][column];
}

function scoreRuns(line)
{
    let score = 0;
    let runLength = 1;
    for (let index = 1; index <= line.length; index++)
    {
        if (index < line.length && line[index] === line[index - 1])
        {
            runLength++;
            continue;
        }
        if (runLength >= 5) score += 3 + runLength - 5;
        runLength = 1;
    }
    return score;
}

function scoreFinderPatterns(line)
{
    let score = 0;
    const pattern = "1011101";
    const bits = line.map(Number).join("");
    for (let index = 0; index <= bits.length - pattern.length; index++)
    {
        if (bits.slice(index, index + 7) !== pattern) continue;
        const before = bits.slice(Math.max(0, index - 4), index);
        const after = bits.slice(index + 7, index + 11);
        if (before === "0000" || after === "0000") score += 40;
    }
    return score;
}

function penaltyScore(matrix)
{
    const size = matrix.length;
    let score = 0;
    let darkCount = 0;
    for (let index = 0; index < size; index++)
    {
        const row = matrix[index];
        const column = matrix.map((line) => line[index]);
        score += scoreRuns(row) + scoreRuns(column);
        score += scoreFinderPatterns(row) + scoreFinderPatterns(column);
        darkCount += row.filter(Boolean).length;
    }

    for (let row = 0; row < size - 1; row++)
        for (let column = 0; column < size - 1; column++)
            if (
                matrix[row][column] === matrix[row][column + 1] &&
                matrix[row][column] === matrix[row + 1][column] &&
                matrix[row][column] === matrix[row + 1][column + 1]
            ) score += 3;

    const total = size * size;
    score += Math.floor(Math.abs(darkCount * 100 / total - 50) / 5) * 10;
    return score;
}

/** Encodes text as a level-L QR Model 2 matrix, selecting versions 1 through 5. */
export function encodeQr(text)
{
    const bytes = new TextEncoder().encode(text);
    const config = VERSION_DATA.find((item) => bytes.length <= item.dataCodewords - 2);
    if (!config) throw new Error("QR content is too long (106 UTF-8 bytes maximum)");

    const codewords = makeCodewords(bytes, config);
    const base = drawFunctions(config);
    placeData(base.matrix, base.reserved, codewords);

    let best = null;
    for (let mask = 0; mask < 8; mask++)
    {
        const matrix = base.matrix.map((row) => [...row]);
        applyMask(matrix, base.reserved, mask);
        drawFormat(matrix, makeGrid(config.size, false), mask);
        const score = penaltyScore(matrix);
        if (!best || score < best.score) best = { matrix, score };
    }
    return best.matrix;
}

/** Draws a QR matrix to a canvas with crisp integer-sized modules. */
export function drawQr(canvas, text, options = {})
{
    const matrix = encodeQr(text);
    const margin = Math.max(0, Math.min(8, Math.round(options.margin ?? 4)));
    const scale = 12;
    const dimension = (matrix.length + margin * 2) * scale;
    canvas.width = dimension;
    canvas.height = dimension;

    const context = canvas.getContext("2d");
    context.fillStyle = options.light || "#ffffff";
    context.fillRect(0, 0, dimension, dimension);
    context.fillStyle = options.dark || "#111111";
    for (let row = 0; row < matrix.length; row++)
        for (let column = 0; column < matrix.length; column++)
            if (matrix[row][column])
                context.fillRect(
                    (column + margin) * scale,
                    (row + margin) * scale,
                    scale,
                    scale
                );
}