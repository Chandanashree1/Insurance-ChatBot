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


// This list must stay identical to the `allowedIntents` list
// inside detectIntentAI (huggingFaceService.js) — that function
// is the only source of these values, so a mismatch here silently
// downgrades valid intents to UNKNOWN before the controller ever
// sees them.
const ALLOWED_INTENTS = [
    "GREETING",
    "THANKS",
    "GOODBYE",
    "HELP",

    "POLICY",
    "CLAIM",
    "CLAIM_ELIGIBILITY",
    "CLAIM_DOCUMENTS",

    "RENEW_POLICY",
    "BUY_POLICY",

    "PREMIUM",
    "PAYMENT",

    "FAQ",
    "INSURANCE_GENERAL",

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
            confidence: 0,
            readyToPurchase: false,
            needsClarification: true
        };
    }


    let intent = String(result.intent || "UNKNOWN")
        .trim()
        .toUpperCase();


    let insuranceType = String(result.insuranceType || "UNKNOWN")
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


    /*
     * Keep confidence between 0 and 1.
     */

    confidence = Math.max(
        0,
        Math.min(1, confidence)
    );


    /*
     * The AI decides readiness directly now (see detectIntentAI's
     * "readyToPurchase" field). Only BUY_POLICY can ever be ready —
     * any other intent is never treated as a purchase trigger,
     * regardless of what the AI layer sends.
     */

    let readyToPurchase =
        intent === "BUY_POLICY" &&
        Boolean(result.readyToPurchase);


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
        intent === "BUY_POLICY" &&
        insuranceType === "UNKNOWN"
    ) {

        needsClarification = true;

        // Can't be ready to purchase without knowing what
        // insurance type is being purchased.
        readyToPurchase = false;
    }


    return {
        intent,
        insuranceType,
        confidence,
        readyToPurchase,
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
                confidence: 0,
                readyToPurchase: false,
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
            "Ready To Purchase:",
            result.readyToPurchase
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
            confidence: 0,
            readyToPurchase: false,
            needsClarification: true
        };
    }
}


module.exports = {
    detectIntent
};