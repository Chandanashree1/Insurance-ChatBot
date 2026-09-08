const axios = require("axios");

/*
=========================================================
PURCHASE FLOW SERVICE
=========================================================

Responsibilities:

1. Maintain purchase conversation state.
2. Remember information already provided by the user.
3. Dynamically understand the user's message.
4. Decide the next conversational stage.
5. Support English + Arabic.
6. Never force insurance-type selection when the user
   is still exploring / asking for advice.
=========================================================
*/


/*
=========================================================
IN-MEMORY PURCHASE FLOWS
=========================================================

For Demo 2 this is enough.

Later, if required, this can be moved to Redis / Oracle
so the flow survives server restarts.
=========================================================
*/

const purchaseFlows = new Map();


/*
=========================================================
DEFAULT FLOW
=========================================================
*/

function createDefaultFlow(userId) {

    return {
        userId,

        active: true,

        stage: "DISCOVERY",

        insuranceType: null,

        productType: null,

        plan: null,

        collectedData: {},

        missingInformation: [],

        lastIntent: null,

        lastUserMessage: null,

        updatedAt: new Date().toISOString()
    };
}


/*
=========================================================
GET PURCHASE FLOW
=========================================================
*/

function getPurchaseFlow(userId) {

    if (!purchaseFlows.has(userId)) {

        return null;

    }

    return purchaseFlows.get(userId);
}


/*
=========================================================
START PURCHASE FLOW
=========================================================
*/

function startPurchaseFlow(userId) {

    const existingFlow = getPurchaseFlow(userId);

    if (existingFlow) {

        return existingFlow;

    }

    const flow = createDefaultFlow(userId);

    purchaseFlows.set(userId, flow);

    return flow;
}


/*
=========================================================
UPDATE PURCHASE FLOW
=========================================================
*/

function updatePurchaseFlow(userId, decision = {}) {

    let flow = getPurchaseFlow(userId);

    if (!flow) {

        flow = createDefaultFlow(userId);

    }


    /*
    -----------------------------------------------------
    BASIC STATE
    -----------------------------------------------------
    */

    if (decision.stage) {

        flow.stage = decision.stage;

    }


    if (
        decision.insuranceType &&
        decision.insuranceType !== "UNKNOWN"
    ) {

        flow.insuranceType = decision.insuranceType;

    }


    if (
        decision.productType &&
        decision.productType !== "UNKNOWN"
    ) {

        flow.productType = decision.productType;

    }


    if (
        decision.plan &&
        decision.plan !== "UNKNOWN"
    ) {

        flow.plan = decision.plan;

    }


    /*
    -----------------------------------------------------
    MERGE EXTRACTED DATA
    -----------------------------------------------------

    Very important.

    We DO NOT replace collectedData.

    We merge new information into existing information.

    Example:

    First message:
        Toyota Corolla 2011

    Second message:
        Registration number 741852963

    Final state:

        {
            vehicleMake: Toyota,
            vehicleModel: Corolla,
            vehicleYear: 2011,
            registrationNumber: 741852963
        }
    -----------------------------------------------------
    */

    if (
        decision.extractedData &&
        typeof decision.extractedData === "object"
    ) {

        flow.collectedData = {
            ...flow.collectedData,
            ...removeUnknownValues(decision.extractedData)
        };

    }


    /*
    -----------------------------------------------------
    MISSING INFORMATION
    -----------------------------------------------------
    */

    if (Array.isArray(decision.missingInformation)) {

        flow.missingInformation =
            decision.missingInformation;

    }


    /*
    -----------------------------------------------------
    LAST MESSAGE
    -----------------------------------------------------
    */

    if (decision.lastUserMessage) {

        flow.lastUserMessage =
            decision.lastUserMessage;

    }


    flow.updatedAt = new Date().toISOString();

    purchaseFlows.set(userId, flow);

    return flow;
}


/*
=========================================================
REMOVE UNKNOWN / NULL VALUES
=========================================================
*/

function removeUnknownValues(data) {

    const cleaned = {};

    for (const [key, value] of Object.entries(data)) {

        if (
            value !== null &&
            value !== undefined &&
            value !== "" &&
            value !== "UNKNOWN"
        ) {

            cleaned[key] = value;

        }

    }

    return cleaned;
}


/*
=========================================================
END PURCHASE FLOW
=========================================================
*/

function endPurchaseFlow(userId) {

    purchaseFlows.delete(userId);

}


/*
=========================================================
CLEAR PURCHASE FLOW
=========================================================
*/

function clearPurchaseFlow(userId) {

    purchaseFlows.delete(userId);

}


/*
=========================================================
LLM CALL
=========================================================

We keep this separate from askAI() because this is not
a normal customer response.

This call is ONLY responsible for understanding the
purchase conversation.
=========================================================
*/

async function callPurchaseLLM(messages) {

    const response = await axios.post(

        process.env.LLM_API_URL,

        {
            model: process.env.LLM_MODEL,

            messages,

            stream: false,

            temperature: 0.1
        },

        {
            headers: {
                Authorization:
                    `Bearer ${process.env.LLM_API_KEY}`,

                "Content-Type":
                    "application/json"
            },

            timeout: 60000
        }

    );


    /*
    -----------------------------------------------------
    Different LLM providers sometimes return different
    response formats.
    -----------------------------------------------------
    */

    const data = response.data;


    if (
        data &&
        data.message &&
        data.message.content
    ) {

        return data.message.content;

    }


    if (
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message
    ) {

        return data.choices[0].message.content;

    }


    throw new Error(
        "Unexpected LLM response format."
    );
}


/*
=========================================================
BUILD PURCHASE DECISION PROMPT
=========================================================
*/

function buildPurchaseSystemPrompt(language) {

    const languageRule =
        language === "ar"

            ? `
You MUST return the "reply" field entirely in Arabic.

Do not mix Arabic and English in the reply.

JSON keys and enum values MUST remain in English.
Only the customer-facing "reply" must be Arabic.
`

            : `
You MUST return the "reply" field entirely in English.
`;


    return `
You are the Purchase Conversation Intelligence
for ABC Insurance.

Your job is NOT to sell a policy immediately.

Your job is to understand the customer's conversation,
remember information already provided, identify what they
are trying to achieve, and decide the appropriate NEXT
STEP.

${languageRule}


=========================================================
VERY IMPORTANT CONVERSATION RULE
=========================================================

NEVER assume that:

BUY_POLICY = SHOW INSURANCE TYPES.

BUY_POLICY only means the customer is discussing,
considering, exploring, or attempting to purchase insurance.

The customer may need a conversation first.

For example:

User:
"I am thinking about getting insurance for my family
of five. What would be useful?"

Correct behavior:

DO NOT immediately show:

Health
Motor
Travel
Life

Instead continue the conversation and ask a useful
clarifying question.

The customer may be looking for advice rather than
ready to select a product.


=========================================================
CONVERSATION CONTINUITY
=========================================================

The PURCHASE FLOW STATE is authoritative for information
already collected.

Never ask the customer again for information that already
exists in the purchase flow.

Example:

Previous state:

insuranceType = MOTOR
productType = THIRD_PARTY

collectedData:

vehicleMake = Toyota
vehicleModel = Corolla
vehicleYear = 2011

User:
"I am ready to proceed."

Do NOT ask:

"What type of insurance do you need?"

Do NOT ask:

"What vehicle do you have?"

Continue from the next missing step.


=========================================================
DYNAMIC LANGUAGE UNDERSTANDING
=========================================================

Do NOT depend on exact keywords.

Understand:

- different wording
- advanced wording
- informal wording
- incomplete sentences
- spelling variations
- conversational language
- indirect requests
- Arabic
- English

Examples that can mean purchase discussion:

"I am thinking of getting coverage."
"I want to protect my family."
"I may need insurance for my car."
"Can you recommend something for my family?"
"I am planning to insure my vehicle."
"I'd like to get covered."
"What kind of protection would suit my family?"
"I am interested in getting a policy."

Do not require the exact phrase "buy policy".


=========================================================
INSURANCE TYPES
=========================================================

Allowed insuranceType values:

MOTOR
HEALTH
TRAVEL
LIFE
UNKNOWN


=========================================================
MOTOR PRODUCT TYPES
=========================================================

For motor insurance:

THIRD_PARTY
COMPREHENSIVE
UNKNOWN

Examples:

"third party"
"third-party cover"
"basic legal liability"
"only third party"

=> THIRD_PARTY

"full coverage"
"comprehensive"
"complete protection"

=> COMPREHENSIVE


=========================================================
PURCHASE STAGES
=========================================================

Use exactly one of these:

DISCOVERY

TYPE_IDENTIFICATION

PRODUCT_IDENTIFICATION

VEHICLE_DETAILS

CUSTOMER_DETAILS

PLAN_SELECTION

READY_FOR_QUOTE

QUOTE_OPTIONS

PAYMENT

COMPLETED


=========================================================
DISCOVERY
=========================================================

Use DISCOVERY when the customer is still explaining their
need or asking for advice.

Example:

"I want insurance for my family of five. What would you
recommend?"

Do NOT force them to choose an insurance type immediately.

Ask a natural question that helps understand their need.


=========================================================
TYPE_IDENTIFICATION
=========================================================

Use this when the customer has clearly expressed a need
but the insurance type is still unclear.

Example:

"I want some insurance for my family."

The customer may need clarification about what they want
to protect.


=========================================================
PRODUCT_IDENTIFICATION
=========================================================

Use this when insurance type is known but the specific
product / coverage is not.

Example:

"I need motor insurance for my car."

Ask whether they want third-party or comprehensive only
when appropriate.


=========================================================
VEHICLE_DETAILS
=========================================================

Use this for motor insurance when vehicle information is
needed.

Potential vehicle information:

vehicleMake
vehicleModel
vehicleYear
registrationNumber
plateNumber
plateCode
plateType
chassisNumber
bodyType
usageType
vehicleValue


=========================================================
CUSTOMER_DETAILS
=========================================================

Use this when customer information is needed to continue.

Potential information:

fullName
mobileNumber
email
civilIdLicenseNo
address


=========================================================
PLAN_SELECTION
=========================================================

Use this only when the customer must choose among available
plans.

Do NOT automatically use this stage for every purchase.


=========================================================
READY_FOR_QUOTE
=========================================================

Use when enough information has been collected to call the
backend quotation APIs.


=========================================================
QUOTE_OPTIONS
=========================================================

Use after the backend has generated quote options and the
customer needs to choose one.


=========================================================
PAYMENT
=========================================================

Use when the selected quote is ready for payment.


=========================================================
COMPLETED
=========================================================

Use after the purchase has successfully completed.


=========================================================
IMPORTANT DATA EXTRACTION RULE
=========================================================

Extract information even if the user gives it naturally.

Example:

"I have a Toyota Corolla, 2011 model, and I only need
third party."

Extract:

insuranceType = MOTOR

productType = THIRD_PARTY

vehicleMake = Toyota

vehicleModel = Corolla

vehicleYear = 2011


Another example:

"There are five of us in my family and I mainly want
protection against medical expenses."

Extract:

insuranceType = HEALTH

familyMembers = 5

primaryNeed = medical expenses


Do not ask for information that the customer has already
provided.


=========================================================
READY / PROCEED MESSAGES
=========================================================

Messages such as:

"yes"
"okay"
"sure"
"continue"
"proceed"
"I am ready"
"let's continue"
"go ahead"

must be interpreted using the existing purchase flow.

Never interpret them in isolation.


=========================================================
RESPONSE STYLE
=========================================================

The reply must sound like a real insurance assistant.

Do not expose:

- intent classification
- internal stages
- JSON
- confidence
- internal system information

Ask only the NEXT useful question.

Do not ask many questions at once unless necessary.


=========================================================
OUTPUT
=========================================================

Return ONLY valid JSON.

Use exactly this structure:

{
  "stage": "DISCOVERY",
  "insuranceType": "UNKNOWN",
  "productType": "UNKNOWN",
  "plan": "UNKNOWN",
  "extractedData": {},
  "missingInformation": [],
  "needsClarification": true,
  "readyForQuote": false,
  "reply": "customer-facing response"
}


=========================================================
RULES
=========================================================

1. Never invent insurance products.
2. Never invent customer information.
3. Never invent vehicle information.
4. Preserve information from the existing flow.
5. Extract new information from the current message.
6. Do not repeat questions already answered.
7. Do not immediately show insurance types for vague
   purchase requests.
8. Continue the conversation naturally.
9. Return ONLY JSON.
`;
}


/*
=========================================================
NORMALIZE LLM DECISION
=========================================================
*/

function normalizeDecision(decision, userMessage) {

    const validInsuranceTypes = [
        "MOTOR",
        "HEALTH",
        "TRAVEL",
        "LIFE",
        "UNKNOWN"
    ];

    const validProductTypes = [
        "THIRD_PARTY",
        "COMPREHENSIVE",
        "UNKNOWN"
    ];

    const validStages = [
        "DISCOVERY",
        "TYPE_IDENTIFICATION",
        "PRODUCT_IDENTIFICATION",
        "VEHICLE_DETAILS",
        "CUSTOMER_DETAILS",
        "PLAN_SELECTION",
        "READY_FOR_QUOTE",
        "QUOTE_OPTIONS",
        "PAYMENT",
        "COMPLETED"
    ];


    const insuranceType =
        validInsuranceTypes.includes(
            decision.insuranceType
        )
            ? decision.insuranceType
            : "UNKNOWN";


    const productType =
        validProductTypes.includes(
            decision.productType
        )
            ? decision.productType
            : "UNKNOWN";


    const stage =
        validStages.includes(
            decision.stage
        )
            ? decision.stage
            : "DISCOVERY";


    return {

        stage,

        insuranceType,

        productType,

        plan:
            decision.plan || "UNKNOWN",

        extractedData:
            decision.extractedData &&
            typeof decision.extractedData === "object"

                ? removeUnknownValues(
                    decision.extractedData
                )

                : {},

        missingInformation:
            Array.isArray(
                decision.missingInformation
            )
                ? decision.missingInformation
                : [],

        needsClarification:
            Boolean(
                decision.needsClarification
            ),

        readyForQuote:
            Boolean(
                decision.readyForQuote
            ),

        reply:
            typeof decision.reply === "string"
                ? decision.reply.trim()
                : "",

        lastUserMessage: userMessage
    };
}


/*
=========================================================
FALLBACK DECISION
=========================================================

This is intentionally conservative.

If the LLM fails, we DO NOT guess an insurance type.

We continue discovery instead.
=========================================================
*/

function fallbackDecision(
    userMessage,
    flow,
    language
) {

    const reply =
        language === "ar"

            ? "بالتأكيد، يمكنني مساعدتك في اختيار التغطية المناسبة. أخبرني أكثر عن الشيء الذي تريد حمايته وما الذي تحتاج إلى تغطيته."

            : "Absolutely, I can help you figure out what coverage may suit your needs. Could you tell me a little more about what you would like to protect and what you want the insurance to cover?";


    return {

        stage:
            flow.stage || "DISCOVERY",

        insuranceType:
            flow.insuranceType || "UNKNOWN",

        productType:
            flow.productType || "UNKNOWN",

        plan:
            flow.plan || "UNKNOWN",

        extractedData:
            flow.collectedData || {},

        missingInformation: [],

        needsClarification: true,

        readyForQuote: false,

        reply,

        lastUserMessage: userMessage
    };
}


/*
=========================================================
DECIDE PURCHASE STAGE
=========================================================
*/

async function decidePurchaseStage({

    message,

    history = [],

    purchaseFlow = null,

    language = "en"

}) {

    try {

        /*
        -------------------------------------------------
        Create flow if it doesn't exist.
        -------------------------------------------------
        */

        const flow =
            purchaseFlow || {
                ...createDefaultFlow("unknown")
            };


        /*
        -------------------------------------------------
        Convert history into readable conversation.
        -------------------------------------------------
        */

        const conversationHistory =
            Array.isArray(history)

                ? history
                    .slice(-12)
                    .map(item => ({
                        role:
                            item.role === "assistant"
                                ? "assistant"
                                : "user",

                        content:
                            item.content || ""
                    }))

                : [];


        /*
        -------------------------------------------------
        Purchase state is explicitly supplied to LLM.
        -------------------------------------------------
        */

        const purchaseState = {

            stage:
                flow.stage || "DISCOVERY",

            insuranceType:
                flow.insuranceType || "UNKNOWN",

            productType:
                flow.productType || "UNKNOWN",

            plan:
                flow.plan || "UNKNOWN",

            collectedData:
                flow.collectedData || {},

            missingInformation:
                flow.missingInformation || []
        };


        const systemPrompt =
            buildPurchaseSystemPrompt(language);


        const messages = [

            {
                role: "system",

                content: systemPrompt
            },


            {
                role: "system",

                content: `
CURRENT PURCHASE FLOW STATE:

${JSON.stringify(
    purchaseState,
    null,
    2
)}

Remember:

The customer may be continuing an existing purchase
conversation.

Do NOT restart the conversation.

Do NOT ask for information that already exists above.
`
            },


            ...conversationHistory,


            {
                role: "user",

                content: message
            }

        ];


        console.log(
            "\n========== PURCHASE STATE =========="
        );

        console.log(
            JSON.stringify(
                purchaseState,
                null,
                2
            )
        );


        /*
        -------------------------------------------------
        CALL LLM
        -------------------------------------------------
        */

        const rawResponse =
            await callPurchaseLLM(messages);


        console.log(
            "\n========== RAW PURCHASE DECISION =========="
        );

        console.log(rawResponse);


        /*
        -------------------------------------------------
        CLEAN JSON
        -------------------------------------------------
        */

        let cleanResponse =
            rawResponse
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();


        /*
        -------------------------------------------------
        Sometimes LLM returns extra text before/after JSON.
        Try to isolate JSON.
        -------------------------------------------------
        */

        const firstBrace =
            cleanResponse.indexOf("{");

        const lastBrace =
            cleanResponse.lastIndexOf("}");


        if (
            firstBrace !== -1 &&
            lastBrace !== -1
        ) {

            cleanResponse =
                cleanResponse.substring(
                    firstBrace,
                    lastBrace + 1
                );

        }


        const parsedDecision =
            JSON.parse(cleanResponse);


        /*
        -------------------------------------------------
        NORMALIZE
        -------------------------------------------------
        */

        const decision =
            normalizeDecision(
                parsedDecision,
                message
            );


        /*
        -------------------------------------------------
        PRESERVE EXISTING STATE
        -------------------------------------------------

        LLM should never accidentally erase information.
        -------------------------------------------------
        */

        if (
            decision.insuranceType === "UNKNOWN" &&
            flow.insuranceType
        ) {

            decision.insuranceType =
                flow.insuranceType;

        }


        if (
            decision.productType === "UNKNOWN" &&
            flow.productType
        ) {

            decision.productType =
                flow.productType;

        }


        if (
            decision.plan === "UNKNOWN" &&
            flow.plan
        ) {

            decision.plan =
                flow.plan;

        }


        decision.extractedData = {

            ...(flow.collectedData || {}),

            ...(decision.extractedData || {})

        };


        /*
        -------------------------------------------------
        SPECIAL CONTINUITY PROTECTION
        -------------------------------------------------

        If the user says "proceed", "continue", etc.,
        and the flow already knows the insurance type,
        do not reset to DISCOVERY.
        -------------------------------------------------
        */

        const continuationMessage =
            message
                .toLowerCase()
                .trim();


        const continuationWords = [
            "yes",
            "okay",
            "ok",
            "sure",
            "continue",
            "proceed",
            "go ahead",
            "i am ready",
            "i'm ready",
            "ready to proceed",
            "let's continue",
            "lets continue"
        ];


        const isContinuation =
            continuationWords.includes(
                continuationMessage
            );


        if (
            isContinuation &&
            flow.insuranceType &&
            flow.insuranceType !== "UNKNOWN"
        ) {

            decision.insuranceType =
                flow.insuranceType;


            if (
                flow.productType &&
                flow.productType !== "UNKNOWN"
            ) {

                decision.productType =
                    flow.productType;

            }


            decision.extractedData = {

                ...(flow.collectedData || {}),

                ...(decision.extractedData || {})

            };


            /*
            Do not allow a continuation message to
            accidentally reset an existing stage.
            */

            if (
                decision.stage === "DISCOVERY" ||
                decision.stage === "TYPE_IDENTIFICATION"
            ) {

                decision.stage =
                    flow.stage;
            }

        }


        /*
        -------------------------------------------------
        FALLBACK REPLY
        -------------------------------------------------
        */

        if (!decision.reply) {

            decision.reply =
                language === "ar"

                    ? "بالتأكيد، دعنا نتابع من حيث توقفنا."

                    : "Absolutely, let's continue from where we left off.";

        }


        /*
        -------------------------------------------------
        FINAL DECISION LOG
        -------------------------------------------------
        */

        console.log(
            "\n========== NORMALIZED PURCHASE DECISION =========="
        );

        console.log(
            JSON.stringify(
                decision,
                null,
                2
            )
        );


        return decision;

    }

    catch (error) {

        console.error(
            "\nPurchase Decision Error:",
            error.message
        );


        /*
        -------------------------------------------------
        IMPORTANT:
        Never destroy the existing purchase state because
        the LLM failed.
        -------------------------------------------------
        */

        const safeFlow =
            purchaseFlow || createDefaultFlow("unknown");


        return fallbackDecision(
            message,
            safeFlow,
            language
        );

    }

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    startPurchaseFlow,

    getPurchaseFlow,

    updatePurchaseFlow,

    endPurchaseFlow,

    clearPurchaseFlow,

    decidePurchaseStage

};