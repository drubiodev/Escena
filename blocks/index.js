import heading from "./heading/definition.js";
import text from "./text/definition.js";
import image from "./image/definition.js";
import qr from "./qr/definition.js";
import video from "./video/definition.js";

/**
 * Built-in blocks in palette and registration order.
 * @type {import("./types.js").BlockDefinition[]}
 */
export const BUILT_IN_BLOCKS = [heading, text, image, qr, video];