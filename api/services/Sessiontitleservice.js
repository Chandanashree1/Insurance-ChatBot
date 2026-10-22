const { callLLM } = require("./llmService");
const { hasSessionTitle, saveSessionTitle } = require("./historyService");
const { isWrongLanguage, languageReminder } = require("./languageGuard");

/*
=========================================================
CHAT SESSION TITLES
=========================================================

Chat History used to show the first message of each chat, which
is often just "hi". This creates one short title per session, like
an AI chat app does ("Car insurance plans and prices").

How it behaves:

  - It runs once per session, on the customer's first message that
    is NOT small talk (greeting / thanks / goodbye / help). A chat
    that starts with "hi" gets its title from the first real
    question, never "Greeting".
  - It is started in the background and never awaited, so it can't
    slow down or break the customer's reply.
  - At most ONE model call per session. If the model fails, takes
    too long or answers in the wrong language, a trimmed copy of the
    customer's message is used instead, so the history list always
    gets something readable and the slow model isn't asked twice.
  - Set CHAT_TITLES_USE_LLM=false in .env to skip the model call
    completely and always use the trimmed message (still better than
    "hi", and costs no model time on a slow server).
=========================================================
*/

const SMALL_TALK_INTENTS = [
    "GREETING",
    "THANKS",
    "GOODBYE",
    "HELP"
];

const MAX_TITLE_LENGTH = 60;

// Chats (customer + session) already titled, or being titled, since this
// server started. Added BEFORE any await, so two quick messages can't
// both generate a title.
const handled = new Set();
const MAX_TRACKED_SESSIONS = 5000;


const TITLE_SYSTEM_PROMPT = `
You write short titles for a customer's chat history list at an
insurance company.

Write a title of 3 to 6 words that says what the customer wants.

Rules:
- Output the title only. No quotes, no emojis, no trailing period,
  and do not start with the word "Title".
- Do not include personal details such as names, phone numbers or
  full ID numbers.
- If the message is a policy, quote or claim number, describe it
  generically, for example "Policy number lookup".
`.trim();


/*
 * Clean up whatever the model returned into a one-line title.
 */
function cleanTitle(raw) {

    let title =
        String(raw || "")
            .split("\n")
            .map(line => line.trim())
            .find(line => line.length > 0) || "";

    title = title
        .replace(/^title\s*[:\-–]\s*/i, "")
        .replace(/^["'“”‘’`*#\s]+/, "")
        .replace(/["'“”‘’`*\s]+$/, "")
        .replace(/[.!?،。]+$/, "")
        .replace(/\s+/g, " ")
        .trim();

    if (title.length > MAX_TITLE_LENGTH) {
        title =
            title
                .slice(0, MAX_TITLE_LENGTH)
                .replace(/\s+\S*$/, "")
                .trim();
    }

    return title.length >= 3 ? title : "";
}


/*
 * Used when the model isn't asked, fails, or answers badly:
 * a trimmed copy of the customer's own message.
 */
function fallbackTitle(message) {

    const text =
        String(message || "")
            .replace(/\s+/g, " ")
            .trim();

    if (text.length <= 40) {
        return text;
    }

    return text.slice(0, 40).replace(/\s+\S*$/, "") + "…";
}


async function generateTitle(message, language) {

    const fallback = fallbackTitle(message);

    if (process.env.CHAT_TITLES_USE_LLM === "false") {
        return fallback;
    }

    try {

        const raw = await callLLM([
            {
                role: "system",
                content: TITLE_SYSTEM_PROMPT
            },
            {
                role: "user",
                content:
                    `Customer's message:\n${String(message).slice(0, 500)}`
            },
            {
                // Last, where a small model pays the most attention.
                role: "system",
                content:
                    languageReminder(language) +
                    " Write only the title."
            }
        ]);

        const title = cleanTitle(raw);

        if (!title || isWrongLanguage(title, language)) {
            return fallback;
        }

        return title;

    } catch (error) {

        console.error(
            "Session title model call failed, using fallback:",
            error.message
        );

        return fallback;
    }
}


/*
 * Call this (without await) from the chat controller.
 */
async function maybeCreateSessionTitle({
    customerId,
    sessionId,
    message,
    intent,
    language = "en"
}) {

    // Guests aren't saved to history, so there is nothing to title.
    if (!customerId || !sessionId) {
        return;
    }

    if (SMALL_TALK_INTENTS.includes(intent)) {
        return;
    }

    const text = String(message || "").trim();

    if (!text) {
        return;
    }

    // A chat is identified by customer + session, same as CHAT_HISTORY.
    const chatKey = `${customerId}:${sessionId}`;

    if (handled.has(chatKey)) {
        return;
    }

    handled.add(chatKey);

    if (handled.size > MAX_TRACKED_SESSIONS) {
        handled.clear();
        handled.add(chatKey);
    }

    try {

        // After a server restart the in-memory set is empty, so check
        // the database once before spending a model call.
        if (await hasSessionTitle(customerId, sessionId)) {
            return;
        }

        const title = await generateTitle(text, language);

        if (!title) {
            return;
        }

        await saveSessionTitle(customerId, sessionId, title);

        console.log("Session title saved:", sessionId, "->", title);

    } catch (error) {

        // Only database problems reach here (generateTitle never
        // throws). Allow a retry on the customer's next message.
        handled.delete(chatKey);

        console.error("Session title error:", error.message);
    }
}


module.exports = {
    maybeCreateSessionTitle
};