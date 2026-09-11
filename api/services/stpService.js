const { KNOWN_ISSUES } = require ("./knownIssues");
const { retrieveRelevantChunks } = require("./ragService");

async function resolveKnownIssue(message) {

    const text = message.toLowerCase();

    let matchedIssue = null;

    for (const issue of KNOWN_ISSUES) {

        const matchedKeywords = issue.keywords.filter(keyword =>
            text.includes(keyword.toLowerCase())
        );

        if (matchedKeywords.length >= 1) {
            matchedIssue = issue;
            break;
        }
    }

    if (!matchedIssue) {
        return {
            matched: false
        };
    }

   const chunks = await retrieveRelevantChunks(
    matchedIssue.searchQuery,
    3,
    "known_issuesEmbadding.json"
);
    if (!chunks || chunks.length === 0) {
        return {
            matched: false,
            reason: "NO_KB_RESULT"
        };
    }

    return {
        matched: true,
        issueCode: matchedIssue.code,
        chunks
    };
}

module.exports = {
    resolveKnownIssue
};