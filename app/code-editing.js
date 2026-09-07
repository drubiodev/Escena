import { getLanguageService } from "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/esm/external/vscode-html-languageservice/lib/esm/htmlLanguageService.js";
import { TextDocument } from "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/esm/external/vscode-languageserver-textdocument/lib/esm/main.js";

const html = getLanguageService();

export function installTagClosing(monaco, editor)
{
    return editor.onDidType((text) =>
    {
        if (text !== ">" && text !== "/") return;
        const model = editor.getModel();
        const selections = editor.getSelections();
        if (!model || model.getLanguageId() !== "html" || selections.length !== 1 || !selections[0].isEmpty()) return;
        const position = editor.getPosition();
        const document = TextDocument.create(model.uri.toString(), "html", model.getVersionId(), model.getValue());
        const snippet = html.doTagComplete(document, {
            line: position.lineNumber - 1,
            character: position.column - 1,
        }, html.parseHTMLDocument(document));
        if (!snippet) return;
        const offset = model.getOffsetAt(position);
        const caret = snippet.indexOf("$0");
        editor.executeEdits("auto-close-tag", [{
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            text: snippet.replace("$0", ""),
        }]);
        editor.setPosition(model.getPositionAt(offset + (caret < 0 ? snippet.length : caret)));
    });
}