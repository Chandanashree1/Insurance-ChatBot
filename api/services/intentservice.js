const { detectIntentAI } = require("./huggingFaceService");
const GREETINGS = [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good afternoon",
    "good evening"
];

const THANKS = [
    "thanks",
    "thank you",
    "thanks a lot",
    "thankyou"
];

const GOODBYE = [
    "bye",
    "goodbye",
    "see you",
    "take care"
];

const HELP = [
    "help",
    "what can you do",
    "how can you help",
    "services",
    "options"
];
function matchesKeyword(message, keywords) {
    return keywords.some(keyword => message.includes(keyword));
}

async function detectIntent(message) {

    const msg = message.toLowerCase().trim();

    // Fast keyword detection
    if (matchesKeyword(msg, GREETINGS))
        return "GREETING";

    if (matchesKeyword(msg, THANKS))
        return "THANKS";

    if (matchesKeyword(msg, GOODBYE))
        return "GOODBYE";

    if (matchesKeyword(msg, HELP))
        return "HELP";

    // AI intent detection
    const result = await detectIntentAI(message);

    console.log("Detected Intent:", result.intent);
    console.log("Confidence:", result.confidence);

    if (result.confidence < 0.6) {
        return "OUT_OF_SCOPE";
    }

    return result.intent;
}

module.exports = { detectIntent };