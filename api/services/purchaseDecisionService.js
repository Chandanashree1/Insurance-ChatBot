const { callLLM } = require("./llmService");

/*
|--------------------------------------------------------------------------
| Purchase Decision Service
|--------------------------------------------------------------------------
|
| This service decides what stage the customer is in during an insurance
| purchase conversation.
|
| IMPORTANT:
| We do NOT use hard-coded keywords here.
|
| The LLM considers:
| - Current user message
| - Previous conversation
| - Current purchase flow
|
|--------------------------------------------------------------------------
*/

const ALLOWED_STAGES = [
    "EXPLORING",
    "NEEDS_DISCOVERY",
    "PRODUCT_IDENTIFIED",
    "READY_FOR_QUOTE",
    "FORM_IN_PROGRESS",
    "QUOTE_GENERATED",
    "OPTION_SELECTED",
    "PAYMENT_PENDING",
    "COMPLETED"
];

const ALLOWED_PRODUCTS = [
    "HEALTH",
    "MOTOR",
    "TRAVEL",
    "LIFE",
    "UNKNOWN"
];

async function decidePurchaseStage({
    message,
    history = [],
    purchaseFlow = null,
    language = "en"
}) {

    try {

        const conversation = history
            .map(item => {
                const role =
                    item.role === "assistant"
                        ? "Assistant"
                        : "Customer";

                return `${role}: ${item.content}`;
            })
            .join("\n");

        const flowContext = purchaseFlow
            ? JSON.stringify(purchaseFlow, null, 2)
            : "No active purchase flow.";

        const languageName =
            language === "ar"
                ? "Arabic"
                : "English";

        const systemPrompt = `
You are the Purchase Conversation Decision Engine
for ABC Insurance.

Your job is NOT to answer the customer.

Your job is to understand the customer's insurance
conversation and determine the correct purchase stage.

You must use:
1. Current customer message
2. Previous conversation
3. Existing purchase flow

Do NOT rely on exact keywords.

Understand natural language, indirect requests,
advanced wording, incomplete sentences and context.

For example:

Customer:
"I have been thinking about getting some protection
for my family."

This does NOT mean the customer is ready to buy.

It means:
EXPLORING

Customer:
"There are five of us and I'm mainly concerned
about medical expenses."

This means:
NEEDS_DISCOVERY

Customer:
"I think health insurance would be suitable for us."

This means:
PRODUCT_IDENTIFIED

Customer:
"Okay, let's get a quote for the health plan."

This means:
READY_FOR_QUOTE

Customer:
"I want insurance for my car. Can you give me
a quote?"

This means:
READY_FOR_QUOTE
with product MOTOR.

The customer must NOT be forced into a product
just because they mentioned insurance.

Only identify a product when the conversation
provides enough evidence.

Allowed products:

HEALTH
MOTOR
TRAVEL
LIFE
UNKNOWN

Allowed stages:

EXPLORING
NEEDS_DISCOVERY
PRODUCT_IDENTIFIED
READY_FOR_QUOTE
FORM_IN_PROGRESS
QUOTE_GENERATED
OPTION_SELECTED
PAYMENT_PENDING
COMPLETED

IMPORTANT:

If the customer is simply asking for advice,
recommendations or discussing possibilities,
do NOT mark them READY_FOR_QUOTE.

If the customer has not decided what they want,
keep the product UNKNOWN.

If the customer clearly wants to proceed with
a quote/application, use READY_FOR_QUOTE.

Return ONLY valid JSON.

Required format:

{
    "stage": "EXPLORING",
    "product": "UNKNOWN",
    "confidence": 0.95,
    "reason": "Customer is exploring insurance options."
}

The reason must be short.

Do not add any other fields.

The response must be in valid JSON only.
`;

        const userPrompt = `
LANGUAGE:
${languageName}

PREVIOUS CONVERSATION:
${conversation || "No previous conversation."}

CURRENT PURCHASE FLOW:
${flowContext}

CURRENT CUSTOMER MESSAGE:
${message}
`;

        const content = await callLLM([
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: userPrompt
            }
        ]);

        const cleanContent = content
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const result = JSON.parse(cleanContent);

        /*
        |--------------------------------------------------------------------------
        | Safety validation
        |--------------------------------------------------------------------------
        */

        if (!ALLOWED_STAGES.includes(result.stage)) {
            result.stage = "EXPLORING";
        }

        if (!ALLOWED_PRODUCTS.includes(result.product)) {
            result.product = "UNKNOWN";
        }

        let confidence = Number(result.confidence);

        if (
            Number.isNaN(confidence) ||
            confidence < 0 ||
            confidence > 1
        ) {
            confidence = 0;
        }

        return {
            stage: result.stage,
            product: result.product,
            confidence,
            reason: result.reason || ""
        };

    } catch (error) {

        console.error(
            "Purchase Decision Error:",
            error.message
        );

        /*
        |--------------------------------------------------------------------------
        | Safe fallback
        |--------------------------------------------------------------------------
        |
        | If the AI cannot determine the customer's intention,
        | NEVER start a purchase form automatically.
        |
        */

        return {
            stage: "EXPLORING",
            product: "UNKNOWN",
            confidence: 0,
            reason: "Unable to determine purchase stage."
        };
    }
}

module.exports = {
    decidePurchaseStage
};