/**
 * @type {{
 *   id: string,
 *   title: string,
 *   theme: string,
 *   slides: Array<{id: string, name: string, notes: string, background: string, blocks: Object[]}>
 * }}
 */
export const STARTER_DECK = {
    id: "starter",
    title: "SlideForge rebuild",
    theme: "brick",
    slides: [
        {
            id: "s1",
            name: "Opening",
            notes: "",
            background: "",
            blocks: [
                {
                    id: "b1", type: "heading",
                    x: 96, y: 80, w: 960, h: 190, z: 0, rotate: 0,
                    props: { text: "Slides are data", size: "76" },
                },
                {
                    id: "b2", type: "text",
                    x: 100, y: 300, w: 720, h: 180, z: 1, rotate: 0,
                    props: { text: "One renderer. Every surface.", size: "30" },
                },
            ],
        },
    ],
};
