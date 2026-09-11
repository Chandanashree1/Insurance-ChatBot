const axios = require("axios");

/*
=========================================================
PURCHASE FLOW SERVICE
=========================================================

FLOW:

BUY_POLICY
    ↓
Purchase LLM
    ↓
Extract information only
    ↓
Backend validation
    ↓
Determine missing information
    ↓
Ask next question
    ↓
READY_FOR_QUOTE
    ↓
Controller -> Oracle API
    ↓
QUOTE_OPTIONS
    ↓
PAYMENT
    ↓
COMPLETED


IMPORTANT:

The LLM is NOT the source of truth for the purchase stage.

LLM:
    Understands the user's message
    Extracts information

Backend:
    Maintains state
    Validates information
    Determines next stage
=========================================================
*/


/*
=========================================================
IN-MEMORY PURCHASE FLOWS
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

    const existingFlow =
        getPurchaseFlow(userId);

    if (existingFlow) {

        return existingFlow;

    }

    const flow =
        createDefaultFlow(userId);

    purchaseFlows.set(
        userId,
        flow
    );

    return flow;

}


/*
=========================================================
REMOVE UNKNOWN VALUES
=========================================================
*/

function removeUnknownValues(data) {

    const cleaned = {};

    if (
        !data ||
        typeof data !== "object"
    ) {

        return cleaned;

    }


    for (
        const [key, value]
        of Object.entries(data)
    ) {

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
NORMALIZE INSURANCE TYPE
=========================================================
*/

function normalizeInsuranceType(value) {

    if (!value) {

        return null;

    }

    const normalized =
        String(value)
            .trim()
            .toUpperCase()
            .replace(/-/g, "_")
            .replace(/\s+/g, "_");


    const aliases = {

        MOTOR: "MOTOR",

        CAR: "MOTOR",

        AUTO: "MOTOR",

        VEHICLE: "MOTOR",

        "CAR_INSURANCE": "MOTOR",

        "MOTOR_INSURANCE": "MOTOR",


        HEALTH: "HEALTH",

        MEDICAL: "HEALTH",

        "HEALTH_INSURANCE": "HEALTH",

        "MEDICAL_INSURANCE": "HEALTH",


        TRAVEL: "TRAVEL",

        "TRAVEL_INSURANCE": "TRAVEL",


        LIFE: "LIFE",

        "LIFE_INSURANCE": "LIFE"

    };


    return aliases[normalized] || null;

}


/*
=========================================================
NORMALIZE PRODUCT TYPE
=========================================================
*/

function normalizeProductType(value) {

    if (!value) {

        return null;

    }

    const normalized =
        String(value)
            .trim()
            .toUpperCase()
            .replace(/-/g, "_")
            .replace(/\s+/g, "_");


    if (
        normalized === "THIRD_PARTY" ||
        normalized === "THIRD"
    ) {

        return "THIRD_PARTY";

    }


    if (
        normalized === "COMPREHENSIVE" ||
        normalized === "FULL_COVERAGE" ||
        normalized === "FULL"
    ) {

        return "COMPREHENSIVE";

    }


    return null;

}


/*
=========================================================
UPDATE PURCHASE FLOW
=========================================================

This function ONLY updates state.

It does NOT blindly trust the LLM stage.
=========================================================
*/

function updatePurchaseFlow(
    userId,
    decision = {}
) {

    let flow =
        getPurchaseFlow(userId);


    if (!flow) {

        flow =
            createDefaultFlow(userId);

    }


    /*
    -----------------------------------------------------
    INSURANCE TYPE
    -----------------------------------------------------
    */

    const insuranceType =
        normalizeInsuranceType(
            decision.insuranceType
        );


    if (insuranceType) {

        flow.insuranceType =
            insuranceType;

    }


    /*
    -----------------------------------------------------
    PRODUCT TYPE
    -----------------------------------------------------
    */

    const productType =
        normalizeProductType(
            decision.productType
        );


    if (productType) {

        flow.productType =
            productType;

    }


    /*
    -----------------------------------------------------
    PLAN
    -----------------------------------------------------
    */

    if (
        decision.plan &&
        decision.plan !== "UNKNOWN"
    ) {

        flow.plan =
            decision.plan;

    }


    /*
    -----------------------------------------------------
    MERGE EXTRACTED DATA
    -----------------------------------------------------
    */

    if (
        decision.extractedData &&
        typeof decision.extractedData === "object"
    ) {

        const cleaned =
            removeUnknownValues(
                decision.extractedData
            );


        flow.collectedData = {

            ...flow.collectedData,

            ...cleaned

        };

    }


    /*
    -----------------------------------------------------
    MISSING INFORMATION
    -----------------------------------------------------
    */

    if (
        Array.isArray(
            decision.missingInformation
        )
    ) {

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


    /*
    -----------------------------------------------------
    LAST INTENT
    -----------------------------------------------------
    */

    if (decision.lastIntent) {

        flow.lastIntent =
            decision.lastIntent;

    }


    flow.updatedAt =
        new Date().toISOString();


    purchaseFlows.set(
        userId,
        flow
    );


    return flow;

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
*/

async function callPurchaseLLM(messages) {

    const response =
        await axios.post(

            process.env.LLM_API_URL,

            {

                model:
                    process.env.LLM_MODEL,

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


    const data =
        response.data;


    /*
    -----------------------------------------------------
    OLLAMA / MESSAGE FORMAT
    -----------------------------------------------------
    */

    if (
        data &&
        data.message &&
        data.message.content
    ) {

        return data.message.content;

    }


    /*
    -----------------------------------------------------
    OPENAI-COMPATIBLE FORMAT
    -----------------------------------------------------
    */

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
PURCHASE EXTRACTION PROMPT
=========================================================

VERY IMPORTANT:

The LLM does NOT decide the final stage.

It only extracts information.
=========================================================
*/

function buildPurchaseSystemPrompt(language) {

    const languageRule =
        language === "ar"

            ? `
The customer-facing "reply" MUST be completely in Arabic.

JSON keys and enum values remain in English.
`

            : `
The customer-facing "reply" MUST be completely in English.
`;


    return `

You are the Purchase Information Extraction Assistant
for ABC Insurance.

Your responsibility is to understand the customer's
latest message and extract any insurance purchase
information they provided.

You are NOT responsible for deciding the final purchase
stage.

The backend will decide the stage.

${languageRule}


=========================================================
IMPORTANT
=========================================================

Do NOT assume that BUY_POLICY means the customer has
provided all required information.

Do NOT force the customer to select an insurance type
unless the customer actually gives enough information
to identify one.

Understand natural conversation.


=========================================================
INSURANCE TYPES
=========================================================

Allowed values:

MOTOR
HEALTH
TRAVEL
LIFE
UNKNOWN


=========================================================
MOTOR PRODUCT TYPES
=========================================================

Allowed values:

THIRD_PARTY
COMPREHENSIVE
UNKNOWN


Examples:

"third party"
"third-party"
"basic cover"

=> THIRD_PARTY


"comprehensive"
"full coverage"
"full cover"

=> COMPREHENSIVE


=========================================================
DATA TO EXTRACT
=========================================================

Extract whatever the customer gives.

Possible fields:

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

coverFrom
coverTo

fullName
mobileNumber
email
civilIdLicenseNo
address

familyMembers
primaryNeed

travelDestination
travelDate

age
dateOfBirth

=========================================================
EXAMPLES
=========================================================

User:

"I want to insure my Toyota Corolla 2011."

Return:

{
  "insuranceType": "MOTOR",
  "productType": "UNKNOWN",
  "extractedData": {
    "vehicleMake": "Toyota",
    "vehicleModel": "Corolla",
    "vehicleYear": 2011
  },
  "reply": "..."
}


User:

"I have a Toyota Corolla 2011 and only want third party."

Return:

{
  "insuranceType": "MOTOR",
  "productType": "THIRD_PARTY",
  "extractedData": {
    "vehicleMake": "Toyota",
    "vehicleModel": "Corolla",
    "vehicleYear": 2011
  },
  "reply": "..."
}


User:

"I need insurance for my family of five mainly for medical expenses."

Return:

{
  "insuranceType": "HEALTH",
  "productType": "UNKNOWN",
  "extractedData": {
    "familyMembers": 5,
    "primaryNeed": "medical expenses"
  },
  "reply": "..."
}


User:

"I want insurance."

Do NOT invent:

MOTOR
HEALTH
TRAVEL
LIFE

Return UNKNOWN.


=========================================================
CONTINUATION MESSAGES
=========================================================

If the user says:

yes
okay
ok
sure
continue
proceed
go ahead
ready

Do NOT invent information.

Use the existing purchase flow supplied by the backend.

=========================================================
OUTPUT
=========================================================

Return ONLY valid JSON.

Exactly:

{
  "insuranceType": "UNKNOWN",
  "productType": "UNKNOWN",
  "plan": "UNKNOWN",
  "extractedData": {},
  "reply": ""
}

=========================================================
RULES
=========================================================

1. Never invent customer information.
2. Never invent vehicle information.
3. Never invent insurance type.
4. Extract only information supported by the conversation.
5. Preserve existing information through the supplied flow.
6. Do not decide the backend purchase stage.
7. Return ONLY JSON.

`;

}


/*
=========================================================
NORMALIZE LLM RESPONSE
=========================================================
*/

function normalizeExtraction(
    decision,
    userMessage
) {

    const insuranceType =
        normalizeInsuranceType(
            decision.insuranceType
        );


    const productType =
        normalizeProductType(
            decision.productType
        );


    return {

        insuranceType:
            insuranceType || null,

        productType:
            productType || null,

        plan:
            decision.plan &&
            decision.plan !== "UNKNOWN"

                ? decision.plan

                : null,

        extractedData:
            removeUnknownValues(
                decision.extractedData
            ),

        reply:
            typeof decision.reply === "string"

                ? decision.reply.trim()

                : "",

        lastUserMessage:
            userMessage

    };

}


/*
=========================================================
PARSE LLM JSON
=========================================================
*/

function parseLLMJson(rawResponse) {

    let cleanResponse =
        String(rawResponse || "")
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();


    const firstBrace =
        cleanResponse.indexOf("{");


    const lastBrace =
        cleanResponse.lastIndexOf("}");


    if (
        firstBrace === -1 ||
        lastBrace === -1
    ) {

        throw new Error(
            "LLM did not return valid JSON."
        );

    }


    cleanResponse =
        cleanResponse.substring(
            firstBrace,
            lastBrace + 1
        );


    return JSON.parse(
        cleanResponse
    );

}


/*
=========================================================
BACKEND VALIDATION
=========================================================

THIS IS THE MOST IMPORTANT PART.

The backend decides what is missing.

LLM does NOT decide READY_FOR_QUOTE.
=========================================================
*/

function validatePurchaseFlow(flow) {

    const missing = [];


    /*
    -----------------------------------------------------
    INSURANCE TYPE
    -----------------------------------------------------
    */

    if (!flow.insuranceType) {

        missing.push(
            "insuranceType"
        );

    }


    /*
    -----------------------------------------------------
    MOTOR
    -----------------------------------------------------
    */

    if (
        flow.insuranceType === "MOTOR"
    ) {

        /*
        Product type is required.
        */

        if (!flow.productType) {

            missing.push(
                "productType"
            );

        }


        /*
        Plate number / registration number.
        */

        const data =
            flow.collectedData || {};


        const plateNumber =
            data.plateNumber ||
            data.registrationNumber;


        if (!plateNumber) {

            missing.push(
                "plateNumber"
            );

        }


        /*
        Plate code.
        */

        if (!data.plateCode) {

            missing.push(
                "plateCode"
            );

        }


        /*
        Cover dates.
        */

        if (!data.coverFrom) {

            missing.push(
                "coverFrom"
            );

        }


        if (!data.coverTo) {

            missing.push(
                "coverTo"
            );

        }

    }


    /*
    -----------------------------------------------------
    HEALTH
    -----------------------------------------------------
    */

    if (
        flow.insuranceType === "HEALTH"
    ) {

        const data =
            flow.collectedData || {};


        if (!data.familyMembers) {

            missing.push(
                "familyMembers"
            );

        }


        if (!data.coverFrom) {

            missing.push(
                "coverFrom"
            );

        }


        if (!data.coverTo) {

            missing.push(
                "coverTo"
            );

        }

    }


    /*
    -----------------------------------------------------
    TRAVEL
    -----------------------------------------------------
    */

    if (
        flow.insuranceType === "TRAVEL"
    ) {

        const data =
            flow.collectedData || {};


        if (!data.travelDestination) {

            missing.push(
                "travelDestination"
            );

        }


        if (!data.travelDate) {

            missing.push(
                "travelDate"
            );

        }

    }


    /*
    -----------------------------------------------------
    LIFE
    -----------------------------------------------------
    */

    if (
        flow.insuranceType === "LIFE"
    ) {

        const data =
            flow.collectedData || {};


        if (!data.dateOfBirth) {

            missing.push(
                "dateOfBirth"
            );

        }

    }


    return {

        valid:
            missing.length === 0,

        missing

    };

}


/*
=========================================================
GET NEXT STAGE
=========================================================
*/

function determineNextStage(flow) {

    const validation =
        validatePurchaseFlow(
            flow
        );


    if (
        validation.valid
    ) {

        return {

            stage:
                "READY_FOR_QUOTE",

            missingInformation: []

        };

    }


    const missing =
        validation.missing;


    /*
    -----------------------------------------------------
    INSURANCE TYPE
    -----------------------------------------------------
    */

    if (
        missing.includes(
            "insuranceType"
        )
    ) {

        return {

            stage:
                "TYPE_IDENTIFICATION",

            missingInformation:
                missing

        };

    }


    /*
    -----------------------------------------------------
    MOTOR PRODUCT
    -----------------------------------------------------
    */

    if (
        missing.includes(
            "productType"
        )
    ) {

        return {

            stage:
                "PRODUCT_IDENTIFICATION",

            missingInformation:
                missing

        };

    }


    /*
    -----------------------------------------------------
    VEHICLE
    -----------------------------------------------------
    */

    if (
        missing.includes(
            "plateNumber"
        ) ||
        missing.includes(
            "plateCode"
        )
    ) {

        return {

            stage:
                "VEHICLE_DETAILS",

            missingInformation:
                missing

        };

    }


    /*
    -----------------------------------------------------
    CUSTOMER
    -----------------------------------------------------
    */

    if (
        missing.includes(
            "fullName"
        ) ||
        missing.includes(
            "mobileNumber"
        ) ||
        missing.includes(
            "email"
        )
    ) {

        return {

            stage:
                "CUSTOMER_DETAILS",

            missingInformation:
                missing

        };

    }


    /*
    -----------------------------------------------------
    DATES
    -----------------------------------------------------
    */

    if (
        missing.includes(
            "coverFrom"
        ) ||
        missing.includes(
            "coverTo"
        )
    ) {

        return {

            stage:
                "CUSTOMER_DETAILS",

            missingInformation:
                missing

        };

    }


    /*
    -----------------------------------------------------
    FALLBACK
    -----------------------------------------------------
    */

    return {

        stage:
            flow.stage ||
            "DISCOVERY",

        missingInformation:
            missing

    };

}


/*
=========================================================
GENERATE NEXT QUESTION
=========================================================
*/

function generateNextQuestion(
    flow,
    language
) {

    const missing =
        flow.missingInformation || [];


    const firstMissing =
        missing[0];


    if (language === "ar") {

        switch (firstMissing) {

            case "insuranceType":

                return "بالتأكيد. هل تحتاج إلى تأمين للسيارة أو التأمين الصحي أو تأمين السفر أو التأمين على الحياة؟";


            case "productType":

                return "ما نوع تغطية السيارة التي تفضلها: تأمين ضد الغير أم تأمين شامل؟";


            case "plateNumber":

                return "يرجى تزويدي برقم تسجيل المركبة أو رقم اللوحة.";


            case "plateCode":

                return "يرجى تزويدي برمز اللوحة.";


            case "coverFrom":

                return "ما هو تاريخ بدء التغطية المطلوبة؟";


            case "coverTo":

                return "ما هو تاريخ انتهاء التغطية المطلوبة؟";


            case "familyMembers":

                return "كم عدد أفراد العائلة الذين ترغب في تغطيتهم؟";


            case "travelDestination":

                return "إلى أي دولة ستسافر؟";


            case "travelDate":

                return "ما هو تاريخ السفر؟";


            case "dateOfBirth":

                return "ما هو تاريخ الميلاد؟";


            case "fullName":

                return "يرجى تزويدي بالاسم الكامل.";


            case "mobileNumber":

                return "يرجى تزويدي برقم الهاتف.";


            case "email":

                return "يرجى تزويدي بعنوان البريد الإلكتروني.";


            default:

                return "بالتأكيد، دعنا نكمل. ما هي المعلومات الإضافية المطلوبة للمتابعة؟";

        }

    }


    switch (firstMissing) {

        case "insuranceType":

            return "Absolutely. What would you like to insure: your car, health, travel, or life?";


        case "productType":

            return "For your car insurance, would you prefer third-party or comprehensive coverage?";


        case "plateNumber":

            return "Could you provide the vehicle registration number or plate number?";


        case "plateCode":

            return "Could you provide the plate code?";


        case "coverFrom":

            return "What date would you like the insurance coverage to start?";


        case "coverTo":

            return "What date should the insurance coverage end?";


        case "familyMembers":

            return "How many family members would you like to cover?";


        case "travelDestination":

            return "Which country are you travelling to?";


        case "travelDate":

            return "What is your travel date?";


        case "dateOfBirth":

            return "What is your date of birth?";


        case "fullName":

            return "Could you provide your full name?";


        case "mobileNumber":

            return "Could you provide your mobile number?";


        case "email":

            return "Could you provide your email address?";


        default:

            return "Absolutely. Let's continue. Could you provide the next required detail?";

    }

}


/*
=========================================================
FALLBACK EXTRACTION
=========================================================
*/

function fallbackExtraction(
    message,
    flow,
    language
) {

    return {

        insuranceType:
            flow.insuranceType,

        productType:
            flow.productType,

        plan:
            flow.plan,

        extractedData:
            flow.collectedData || {},

        reply:
            "",

        lastUserMessage:
            message

    };

}


/*
=========================================================
DECIDE PURCHASE STAGE
=========================================================

THIS IS THE MAIN FUNCTION USED BY CONTROLLER.

IMPORTANT:

1. LLM extracts.
2. State is updated.
3. Backend validates.
4. Backend determines stage.
5. Backend generates next question.
=========================================================
*/

async function decidePurchaseStage({

    message,

    history = [],

    purchaseFlow = null,

    language = "en"

}) {

    let flow =
        purchaseFlow;


    /*
    -----------------------------------------------------
    CREATE FLOW
    -----------------------------------------------------
    */

    if (!flow) {

        flow =
            createDefaultFlow(
                "unknown"
            );

    }


    /*
    -----------------------------------------------------
    CONVERSATION HISTORY
    -----------------------------------------------------
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
    -----------------------------------------------------
    CURRENT STATE
    -----------------------------------------------------
    */

    const purchaseState = {

        insuranceType:
            flow.insuranceType || "UNKNOWN",

        productType:
            flow.productType || "UNKNOWN",

        plan:
            flow.plan || "UNKNOWN",

        collectedData:
            flow.collectedData || {}

    };


    /*
    -----------------------------------------------------
    SYSTEM PROMPT
    -----------------------------------------------------
    */

    const systemPrompt =
        buildPurchaseSystemPrompt(
            language
        );


    /*
    -----------------------------------------------------
    LLM MESSAGES
    -----------------------------------------------------
    */

    const messages = [

        {

            role: "system",

            content:
                systemPrompt

        },


        {

            role: "system",

            content: `
CURRENT PURCHASE STATE:

${JSON.stringify(
    purchaseState,
    null,
    2
)}

The current state is authoritative.

Extract only NEW information from the user's latest
message.

Do not remove existing information.
`

        },


        ...conversationHistory,


        {

            role: "user",

            content:
                message

        }

    ];


    /*
    -----------------------------------------------------
    CALL PURCHASE LLM
    -----------------------------------------------------
    */

    let extraction;


    try {

        const rawResponse =
            await callPurchaseLLM(
                messages
            );


        console.log(
            "\n========== PURCHASE LLM =========="
        );

        console.log(
            rawResponse
        );


        const parsed =
            parseLLMJson(
                rawResponse
            );


        extraction =
            normalizeExtraction(
                parsed,
                message
            );

    }

    catch (error) {

        console.error(
            "\nPurchase LLM Error:",
            error.message
        );


        extraction =
            fallbackExtraction(
                message,
                flow,
                language
            );

    }


    /*
    =====================================================
    UPDATE STATE WITH EXTRACTED INFORMATION
    =====================================================
    */

    flow =
        updatePurchaseFlow(

            flow.userId,

            {

                insuranceType:
                    extraction.insuranceType,

                productType:
                    extraction.productType,

                plan:
                    extraction.plan,

                extractedData:
                    extraction.extractedData,

                lastUserMessage:
                    message

            }

        );


    /*
    =====================================================
    BACKEND VALIDATION
    =====================================================
    */

    const validation =
        validatePurchaseFlow(
            flow
        );


    console.log(
        "\n========== BACKEND VALIDATION =========="
    );

    console.log(
        JSON.stringify(
            validation,
            null,
            2
        )
    );


    /*
    =====================================================
    DETERMINE NEXT STAGE
    =====================================================
    */

    const next =
        determineNextStage(
            flow
        );


    /*
    =====================================================
    UPDATE STAGE
    =====================================================
    */

    flow =
        updatePurchaseFlow(

            flow.userId,

            {

                stage:
                    next.stage,

                missingInformation:
                    next.missingInformation,

                lastUserMessage:
                    message

            }

        );


    /*
    =====================================================
    READY FOR QUOTE
    =====================================================
    */

    if (
        next.stage ===
        "READY_FOR_QUOTE"
    ) {

        return {

            stage:
                "READY_FOR_QUOTE",

            insuranceType:
                flow.insuranceType,

            productType:
                flow.productType,

            plan:
                flow.plan || "UNKNOWN",

            extractedData:
                flow.collectedData,

            missingInformation: [],

            needsClarification:
                false,

            readyForQuote:
                true,

            reply:
                "Your information is complete. I can now generate your quote.",

            lastUserMessage:
                message

        };

    }


    /*
    =====================================================
    ASK NEXT REQUIRED QUESTION
    =====================================================
    */

    const nextQuestion =
        generateNextQuestion(
            flow,
            language
        );


    /*
    =====================================================
    RETURN FINAL DECISION
    =====================================================
    */

    return {

        stage:
            flow.stage,

        insuranceType:
            flow.insuranceType ||
            "UNKNOWN",

        productType:
            flow.productType ||
            "UNKNOWN",

        plan:
            flow.plan ||
            "UNKNOWN",

        extractedData:
            flow.collectedData || {},

        missingInformation:
            flow.missingInformation || [],

        needsClarification:
            true,

        readyForQuote:
            false,

        reply:
            nextQuestion,

        lastUserMessage:
            message

    };

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