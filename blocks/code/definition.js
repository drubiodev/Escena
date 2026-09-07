export default {
    type: "code",
    label: "Code snippet",
    category: "Code",
    icon: "FileCode2",
    path: new URL("./index.html", import.meta.url).href,
    size: { w: 860, h: 440 },
    props: [
        { key: "language", label: "Language", type: "select", value: "javascript", options: ["javascript", "typescript", "html", "css", "json", "python", "bash", "sql", "yaml", "markdown", "csharp", "java", "go", "rust", "plaintext"] },
        { key: "code", label: "Code", type: "code", languageKey: "language", value: 'const greeting = (name) => {\n    return `Hello, ${name}!`;\n};\n\nconsole.log(greeting("world"));' },
        { key: "filename", label: "Filename", type: "text", value: "example.js" },
        { key: "theme", label: "Code theme", type: "select", value: "dark", options: ["dark", "light"] },
        { key: "size", label: "Font size", type: "range", value: "24", min: 12, max: 48, step: 1 },
        { key: "lineNumbers", label: "Line numbers", type: "toggle", value: "on" },
        { key: "header", label: "Header", type: "toggle", value: "on" },
        { key: "shadow", label: "Shadow", type: "toggle", value: "on" },
    ],
};