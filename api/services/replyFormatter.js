/*
=========================================================
REPLY FORMATTER
=========================================================

The model writes markdown ("**bold**", "### headings", "- bullets"),
but the chat window shows plain text, so customers saw literal
asterisks and numbered points running together on one line:

    "... overview: 1. **Comprehensive Insurance**: This covers ... 2. **Third-Party ..."

This turns a model reply into clean plain text:

  - **bold**            ->  "bold"   (or plain bold if REPLY_BOLD_STYLE=plain)
  - ### Heading         ->  Heading
  - "- item" / "* item" ->  "• item"
  - *italic* and `code` ->  the text without the markers
  - "... plan. 2. Next" ->  "2. Next" starts on its own line

It only touches text the MODEL wrote. Fixed replies from code
don't need it. Running it twice gives the same result.
=========================================================
*/

function formatReply(text) {

    let out = String(text ?? "");

    if (!out.trim()) {
        return out;
    }

    out = out.replace(/\r\n?/g, "\n");

    const quoteBold = process.env.REPLY_BOLD_STYLE !== "plain";


    // "### Heading" -> "Heading"
    out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, "");


    // **bold** -> "bold". If the bold text already sits inside quotes,
    // don't add a second pair.
    out = out.replace(
        /(["“”]?)\*\*(?=\S)([^\n]*?\S)\*\*(["“”]?)/g,
        (match, before, inner, after) => {

            if (!quoteBold || before || after) {
                return before + inner + after;
            }

            return `"${inner}"`;
        }
    );

    // Any ** left over (unbalanced) is just noise.
    out = out.replace(/\*\*/g, "");


    // Bullets: "- item" / "* item" -> "• item"
    out = out.replace(/^[ \t]*[-*][ \t]+(?=\S)/gm, "• ");


    // *italic* -> italic, `code` -> code
    out = out.replace(/\*(\S(?:[^*\n]*\S)?)\*/g, "$1");
    out = out.replace(/`([^`\n]+)`/g, "$1");


    // "... done. 2. Next point" -> put "2." on its own line. Needs a
    // sentence end (or colon) before it and "N." followed by a space, so
    // decimals like 65.6 and years like 2026. are left alone.
    out = out.replace(
        /([.:!?؟])[ \t]+(?=\d{1,2}\.[ \t]+\S)/g,
        "$1\n"
    );


    // Tidy spacing.
    out = out
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return out;
}


module.exports = {
    formatReply
};