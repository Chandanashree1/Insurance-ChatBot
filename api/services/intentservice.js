const { detectIntentAI } = require("./huggingFaceService");


/*
|--------------------------------------------------------------------------
| INTENT SERVICE
|--------------------------------------------------------------------------
|
| This service uses AI to understand the user's meaning.
|
| IMPORTANT:
| We intentionally DO NOT use static keyword matching.
|
| The AI receives:
|   1. Current user message
|   2. Previous conversation
|   3. Current conversation context
|
| and returns structured information.
|
|--------------------------------------------------------------------------
*/


const ALLOWED_INTENTS = [
    "GREETING",
    "THANKS",
    "GOODBYE",
    "HELP",

    "INSURANCE_ADVICE",
    "BUY_POLICY",
    "GET_QUOTE",

    "POLICY_DETAILS",
    "CLAIM",
    "RENEWAL",
    "PAYMENT",
    "COVERAGE",

    "INSURANCE_QUERY",
    "OUT_OF_SCOPE",
    "UNKNOWN"
];


const ALLOWED_INSURANCE_TYPES = [
    "MOTOR",
    "HEALTH",
    "TRAVEL",
    "LIFE",
    "UNKNOWN"
];


const ALLOWED_STAGES = [
    "CONVERSATION",
    "DISCOVERY",
    "READY_TO_BUY",
    "QUOTE",
    "PAYMENT",
    "POLICY",
    "CLAIM",
    "UNKNOWN"
];


/*
|--------------------------------------------------------------------------
| Normalize AI response
|--------------------------------------------------------------------------
*/

function normalizeIntent(result) {

    if (!result || typeof result !== "object") {

        return {
            intent: "UNKNOWN",
            insuranceType: "UNKNOWN",
            stage: "UNKNOWN",
            confidence: 0,
            needsClarification: true
        };
    }


    let intent = String(result.intent || "UNKNOWN")
        .trim()
        .toUpperCase();


    let insuranceType = String(result.insuranceType || "UNKNOWN")
        .trim()
        .toUpperCase();


    let stage = String(result.stage || "UNKNOWN")
        .trim()
        .toUpperCase();


    let confidence = Number(result.confidence);


    if (!Number.isFinite(confidence)) {
        confidence = 0;
    }


    /*
     * Protect the application from unexpected AI values.
     */

    if (!ALLOWED_INTENTS.includes(intent)) {
        intent = "UNKNOWN";
    }


    if (!ALLOWED_INSURANCE_TYPES.includes(insuranceType)) {
        insuranceType = "UNKNOWN";
    }


    if (!ALLOWED_STAGES.includes(stage)) {
        stage = "UNKNOWN";
    }


    /*
     * Keep confidence between 0 and 1.
     */

    confidence = Math.max(
        0,
        Math.min(1, confidence)
    );


    /*
     * Decide whether clarification is required.
     *
     * We should NOT launch a purchase form when the AI
     * doesn't know what insurance the customer wants.
     */

    let needsClarification = Boolean(
        result.needsClarification
    );


    if (
        (intent === "BUY_POLICY" ||
         intent === "GET_QUOTE") &&
        insuranceType === "UNKNOWN"
    ) {

        needsClarification = true;
    }


    return {
        intent,
        insuranceType,
        stage,
        confidence,
        needsClarification
    };
}


/*
|--------------------------------------------------------------------------
| Main Intent Detection
|--------------------------------------------------------------------------
*/

async function detectIntent(message, conversationHistory = [], context = {}) {

    try {

        if (!message || !String(message).trim()) {

            return {
                intent: "UNKNOWN",
                insuranceType: "UNKNOWN",
                stage: "UNKNOWN",
                confidence: 0,
                needsClarification: true
            };
        }


        /*
        |--------------------------------------------------------------------------
        | Send everything important to the AI
        |--------------------------------------------------------------------------
        */

        const result = await detectIntentAI(
            message,
            conversationHistory,
            context
        );


        console.log(
            "\n========== AI INTENT =========="
        );

        console.log(
            "Message:",
            message
        );

        console.log(
            "Intent:",
            result.intent
        );

        console.log(
            "Insurance Type:",
            result.insuranceType
        );

        console.log(
            "Stage:",
            result.stage
        );

        console.log(
            "Confidence:",
            result.confidence
        );

        console.log(
            "Needs Clarification:",
            result.needsClarification
        );


        return normalizeIntent(result);

    } catch (error) {

        console.error(
            "Intent Detection Error:",
            error.message
        );


        /*
         * Never break the chatbot because intent detection failed.
         */

        return {
            intent: "UNKNOWN",
            insuranceType: "UNKNOWN",
            stage: "CONVERSATION",
            confidence: 0,
            needsClarification: true
        };
    }
}


module.exports = {
    detectIntent
};