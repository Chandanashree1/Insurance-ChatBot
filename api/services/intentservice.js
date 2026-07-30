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

async function detectIntent(message, language = "en") {
    const msg = message.toLowerCase().trim();

    if (matchesKeyword(msg, GREETINGS)) {
        return "GREETING";
    }

    if (matchesKeyword(msg, THANKS)) {
        return "THANKS";
    }

    if (matchesKeyword(msg, GOODBYE)) {
        return "GOODBYE";
    }

    if (matchesKeyword(msg, HELP)) {
        return "HELP";
    }
    const result = await detectIntentAI(message);

    // console.log("Intent Service Result:", result);

    return result.intent;
}

module.exports = { detectIntent };