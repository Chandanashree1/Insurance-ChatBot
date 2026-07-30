const { detectIntentAI } = require("./huggingFaceService");

async function detectIntent(message, language = "en") {

    const result = await detectIntentAI(message);

    // console.log("Intent Service Result:", result);

    return result.intent;
}

module.exports = { detectIntent };