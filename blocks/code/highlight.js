let highlighterPromise;

export async function highlightCode(element, source, language)
{
    element.textContent = source;
    try
    {
        highlighterPromise ??= import("https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/highlight.min.js")
            .catch((error) => { highlighterPromise = null; throw error; });
        const { default: highlighter } = await highlighterPromise;
        if (!element.isConnected || !highlighter.getLanguage(language)) return;
        element.innerHTML = highlighter.highlight(source, { language, ignoreIllegals: true }).value;
    }
    catch
    {
        element.textContent = source;
    }
}