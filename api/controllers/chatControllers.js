/*
=========================================================
CHAT CONTROLLER
=========================================================

Responsibilities:

1. Handle normal insurance conversations.
2. Detect intent.
3. Handle protected intents.
4. Handle OUT_OF_SCOPE.
5. Start purchase flow ONLY when the customer genuinely
   wants to purchase insurance.
6. Continue an existing purchase flow regardless of the
   latest intent classification.
7. Extract important purchase information deterministically
   when possible.
8. Use purchaseFlowService for conversational intelligence.
9. Use Oracle service for quote / option / payment / policy.
10. Support English + Arabic.
=========================================================
*/


/*
=========================================================
IMPORTS
=========================================================
*/

const {
    getVehicle,
    getProducts,
    createQuote,
    getQuoteOptions,
    selectQuoteOption,
    getSelectedQuoteOption,
    updatePaymentStatus,
    createPolicy,
    convertQuote
} = require("../services/oracleservice");


const {
    askAI
} = require("../services/huggingFaceService");


const {
    detectIntent
} = require("../services/intentservice");


const {
    retrieveRelevantChunks
} = require("../services/ragService");


const {
    getHistory,
    addMessage,
    clearHistory
} = require("../services/conversationservice");


const {
    saveMessage
} = require("../services/historyService");


/*
=========================================================
PURCHASE FLOW SERVICE
=========================================================
*/

const {
    startPurchaseFlow,
    getPurchaseFlow,
    updatePurchaseFlow,
    endPurchaseFlow,
    decidePurchaseStage
} = require("../services/purchaseFlowService");


/*
=========================================================
PROTECTED INTENTS
=========================================================
*/

const PROTECTED_INTENTS = [
    "POLICY",
    "CLAIM",
    "PROFILE",
    "PAYMENT",
    "DOWNLOAD_POLICY",
    "RENEW_POLICY"
];


/*
=========================================================
OUT OF SCOPE
=========================================================
*/

const OUT_OF_SCOPE_REPLIES = {

    en:
        "I am ABC Insurance's virtual assistant and can only assist with insurance-related queries.",

    ar:
        "أنا المساعد الافتراضي لشركة ABC للتأمين، ويمكنني فقط مساعدتك في الاستفسارات المتعلقة بالتأمين."

};


/*
=========================================================
TEXT
=========================================================
*/

const TEXT = {

    en: {

        greeting:
            "👋 Hello! Welcome to ABC Insurance.\nHow can I assist you today?",

        thanks:
            "You're welcome! 😊",

        goodbye:
            "Thank you for choosing ABC Insurance. Have a wonderful day! 👋",

        help:
            "I can help you with:\n• Policy Details\n• Claim Status\n• Renewals\n• Premiums\n• Claim Documents",

        login:
            "I'd be happy to help with your personal insurance information. Please log in to continue.",

        loginPurchase:
            "Please log in before we continue with your insurance purchase.",

        quoteMissing:
            "I have the information so far, but I still need a few details before I can generate your quote.",

        vehicleNotFound:
            "I couldn't find a vehicle matching those registration details. Please check the plate number and plate code.",

        productNotFound:
            "I couldn't find the requested insurance product in our available products.",

        quoteCreated:
            "Great! Your quote has been generated. Here are the available options.",

        optionSelected:
            "Great! Your insurance option has been selected.",

        paymentSuccess:
            "Your payment has been completed successfully.",

        policyCreated:
            "Your policy has been created successfully."

    },


    ar: {

        greeting:
            "👋 مرحباً! أهلاً بك في تأمين ABC.\nكيف يمكنني مساعدتك اليوم؟",

        thanks:
            "على الرحب والسعة! 😊",

        goodbye:
            "شكراً لاختيارك تأمين ABC. نتمنى لك يوماً رائعاً! 👋",

        help:
            "يمكنني مساعدتك في:\n• تفاصيل الوثيقة\n• حالة المطالبة\n• تجديد الوثيقة\n• الأقساط\n• مستندات المطالبة",

        login:
            "سأكون سعيدًا بمساعدتك بمعلومات التأمين الشخصي الخاصة بك. الرجاء تسجيل الدخول للمتابعة.",

        loginPurchase:
            "يرجى تسجيل الدخول قبل متابعة شراء التأمين.",

        quoteMissing:
            "لديّ المعلومات التي قدمتها حتى الآن، ولكن ما زلت بحاجة إلى بعض التفاصيل قبل إنشاء عرض السعر.",

        vehicleNotFound:
            "لم أتمكن من العثور على مركبة تطابق بيانات التسجيل. يرجى التحقق من رقم اللوحة ورمز اللوحة.",

        productNotFound:
            "لم أتمكن من العثور على منتج التأمين المطلوب ضمن المنتجات المتاحة.",

        quoteCreated:
            "ممتاز! تم إنشاء عرض السعر الخاص بك. إليك الخيارات المتاحة.",

        optionSelected:
            "ممتاز! تم اختيار خيار التأمين الخاص بك.",

        paymentSuccess:
            "تمت عملية الدفع بنجاح.",

        policyCreated:
            "تم إنشاء وثيقة التأمين الخاصة بك بنجاح."

    }

};


/*
=========================================================
LANGUAGE
=========================================================
*/

function getLanguage(language) {

    return language === "ar"
        ? "ar"
        : "en";

}


/*
=========================================================
PURCHASE REPLY
=========================================================
*/

function purchaseReply(language, en, ar) {

    return language === "ar"
        ? ar
        : en;

}


/*
=========================================================
GENERATE QUOTE NUMBER
=========================================================
*/

function generateQuoteNumber() {

    const timestamp =
        Date.now().toString();

    const random =
        Math.floor(
            1000 + Math.random() * 9000
        );

    return `Q-${timestamp}-${random}`;
}


/*
=========================================================
GENERATE POLICY NUMBER
=========================================================
*/

function generatePolicyNumber() {

    const timestamp =
        Date.now().toString();

    const random =
        Math.floor(
            1000 + Math.random() * 9000
        );

    return `POL-${timestamp}-${random}`;
}


/*
=========================================================
NORMALIZE PRODUCT TYPE
=========================================================
*/

function normalizeProductType(productType) {

    if (!productType) {

        return null;

    }


    const value =
        String(productType)
            .trim()
            .toUpperCase()
            .replace(/-/g, "_");


    if (
        value === "THIRD_PARTY" ||
        value === "THIRD PARTY" ||
        value === "THIRDPARTY"
    ) {

        return "THIRD_PARTY";

    }


    if (
        value === "COMPREHENSIVE" ||
        value === "FULL_COVERAGE" ||
        value === "FULL COVERAGE" ||
        value === "FULLCOVERAGE"
    ) {

        return "COMPREHENSIVE";

    }


    return value;
}


/*
=========================================================
DETERMINE PURCHASE INTENT
=========================================================

IMPORTANT:

We do NOT put every insurance-related message into the
purchase flow.

The purchase flow should start when:

A. detectIntent() says BUY_POLICY

OR

B. The message contains a strong purchase request.

Examples:

"I want to buy insurance"
"I want insurance for my car"
"I need motor insurance"
"I want to insure my vehicle"
"I would like to purchase a policy"

But:

"What is comprehensive insurance?"

should remain normal insurance conversation.
=========================================================
*/

function isStrongPurchaseMessage(message) {

    const text =
        String(message || "")
            .trim()
            .toLowerCase();


    if (!text) {

        return false;

    }


    const purchasePatterns = [

        /\bi want to buy\b/,
        /\bi want insurance\b/,
        /\bi need insurance\b/,
        /\bi need .* insurance\b/,
        /\bi want .* insurance\b/,
        /\bi would like to buy\b/,
        /\bi would like .* insurance\b/,
        /\bi'd like to buy\b/,
        /\bi'd like .* insurance\b/,
        /\bi want to insure\b/,
        /\bi need to insure\b/,
        /\bi would like to insure\b/,
        /\bi want to purchase\b/,
        /\bi need to purchase\b/,
        /\bi am buying insurance\b/,
        /\bi'm buying insurance\b/,
        /\bget me insurance\b/,
        /\bget insurance for\b/,
        /\binsure my car\b/,
        /\binsure my vehicle\b/,
        /\bbuy a policy\b/,
        /\bpurchase a policy\b/

    ];


    return purchasePatterns.some(
        pattern => pattern.test(text)
    );
}


/*
=========================================================
PURCHASE PRODUCT EXTRACTION
=========================================================

This is the important fix for:

"I want third party."

The LLM is no longer the ONLY source of truth.

We deterministically recognize the product type.
=========================================================
*/

function extractPurchaseHints(message, existingFlow = null) {

    const text =
        String(message || "")
            .trim()
            .toLowerCase();


    const hints = {};


    /*
    -----------------------------------------------------
    MOTOR
    -----------------------------------------------------
    */

    if (
        /\bmotor\b/.test(text) ||
        /\bcar insurance\b/.test(text) ||
        /\bvehicle insurance\b/.test(text) ||
        /\bmy car\b/.test(text) ||
        /\bmy vehicle\b/.test(text)
    ) {

        hints.insuranceType = "MOTOR";

    }


    /*
    -----------------------------------------------------
    THIRD PARTY
    -----------------------------------------------------
    */

    if (
        /\bthird[\s-]?party\b/.test(text) ||
        /\bthirdparty\b/.test(text) ||
        /\blegal liability\b/.test(text)
    ) {

        hints.productType = "THIRD_PARTY";


        /*
        If we are already inside a motor purchase flow,
        third party automatically belongs to MOTOR.
        */

        if (
            existingFlow &&
            existingFlow.insuranceType === "MOTOR"
        ) {

            hints.insuranceType = "MOTOR";

        }

    }


    /*
    -----------------------------------------------------
    COMPREHENSIVE
    -----------------------------------------------------
    */

    if (
        /\bcomprehensive\b/.test(text) ||
        /\bfull coverage\b/.test(text) ||
        /\bfull cover\b/.test(text) ||
        /\bcomplete coverage\b/.test(text)
    ) {

        hints.productType = "COMPREHENSIVE";


        if (
            existingFlow &&
            existingFlow.insuranceType === "MOTOR"
        ) {

            hints.insuranceType = "MOTOR";

        }

    }


    /*
    -----------------------------------------------------
    PLATE NUMBER
    -----------------------------------------------------
    */

    const plateNumberMatch =
        text.match(
            /\b(?:plate\s*(?:number|no)?|registration\s*(?:number|no)?|reg(?:istration)?)\s*[:#-]?\s*([a-z0-9]+)\b/i
        );


    if (plateNumberMatch) {

        hints.plateNumber =
            plateNumberMatch[1];

    }


    /*
    -----------------------------------------------------
    PLATE CODE
    -----------------------------------------------------
    */

    const plateCodeMatch =
        text.match(
            /\bplate\s*code\s*[:#-]?\s*([a-z0-9]+)\b/i
        );


    if (plateCodeMatch) {

        hints.plateCode =
            plateCodeMatch[1];

    }


    /*
    -----------------------------------------------------
    VEHICLE YEAR
    -----------------------------------------------------
    */

    const yearMatch =
        text.match(
            /\b(19|20)\d{2}\b/
        );


    if (yearMatch) {

        hints.vehicleYear =
            yearMatch[0];

    }


    /*
    -----------------------------------------------------
    VEHICLE MAKE / MODEL
    -----------------------------------------------------

    We intentionally do not guess make/model from arbitrary
    text. The purchase LLM can extract those.
    -----------------------------------------------------
    */


    return hints;
}


/*
=========================================================
APPLY PURCHASE HINTS
=========================================================
*/

function applyPurchaseHints(
    decision,
    message,
    existingFlow
) {

    const hints =
        extractPurchaseHints(
            message,
            existingFlow
        );


    /*
    -----------------------------------------------------
    INSURANCE TYPE
    -----------------------------------------------------
    */

    if (
        hints.insuranceType &&
        (
            !decision.insuranceType ||
            decision.insuranceType === "UNKNOWN"
        )
    ) {

        decision.insuranceType =
            hints.insuranceType;

    }


    /*
    -----------------------------------------------------
    PRODUCT TYPE
    -----------------------------------------------------
    */

    if (
        hints.productType &&
        (
            !decision.productType ||
            decision.productType === "UNKNOWN"
        )
    ) {

        decision.productType =
            hints.productType;

    }


    /*
    -----------------------------------------------------
    EXTRACTED DATA
    -----------------------------------------------------
    */

    decision.extractedData = {

        ...(existingFlow?.collectedData || {}),

        ...(decision.extractedData || {}),

        ...hints

    };


    /*
    -----------------------------------------------------
    PRESERVE EXISTING INSURANCE TYPE
    -----------------------------------------------------
    */

    if (
        (
            !decision.insuranceType ||
            decision.insuranceType === "UNKNOWN"
        ) &&
        existingFlow?.insuranceType &&
        existingFlow.insuranceType !== "UNKNOWN"
    ) {

        decision.insuranceType =
            existingFlow.insuranceType;

    }


    /*
    -----------------------------------------------------
    PRESERVE EXISTING PRODUCT
    -----------------------------------------------------
    */

    if (
        (
            !decision.productType ||
            decision.productType === "UNKNOWN"
        ) &&
        existingFlow?.productType &&
        existingFlow.productType !== "UNKNOWN"
    ) {

        decision.productType =
            existingFlow.productType;

    }


    /*
    -----------------------------------------------------
    PRESERVE PLAN
    -----------------------------------------------------
    */

    if (
        (
            !decision.plan ||
            decision.plan === "UNKNOWN"
        ) &&
        existingFlow?.plan &&
        existingFlow.plan !== "UNKNOWN"
    ) {

        decision.plan =
            existingFlow.plan;

    }


    return decision;
}


/*
=========================================================
RESOLVE PURCHASE STAGE
=========================================================

The LLM can suggest a stage, but critical flow stages
are resolved using actual collected data.

This prevents:

insuranceType = MOTOR
productType = THIRD_PARTY

from incorrectly remaining at:

TYPE_IDENTIFICATION
=========================================================
*/

function resolvePurchaseStage(
    decision,
    flow,
    customerId
) {

    const insuranceType =
        decision.insuranceType ||
        flow.insuranceType ||
        "UNKNOWN";


    const productType =
        decision.productType ||
        flow.productType ||
        "UNKNOWN";


    const data = {

        ...(flow.collectedData || {}),

        ...(decision.extractedData || {})

    };


    /*
    -----------------------------------------------------
    NO INSURANCE TYPE
    -----------------------------------------------------
    */

    if (
        insuranceType === "UNKNOWN"
    ) {

        return (
            decision.stage === "DISCOVERY"
                ? "DISCOVERY"
                : "TYPE_IDENTIFICATION"
        );

    }


    /*
    -----------------------------------------------------
    MOTOR BUT NO PRODUCT
    -----------------------------------------------------
    */

    if (
        insuranceType === "MOTOR" &&
        productType === "UNKNOWN"
    ) {

        return "PRODUCT_IDENTIFICATION";

    }


    /*
    -----------------------------------------------------
    MOTOR + PRODUCT BUT NO VEHICLE DETAILS
    -----------------------------------------------------
    */

    if (
        insuranceType === "MOTOR" &&
        productType !== "UNKNOWN"
    ) {

        const hasPlateNumber =
            Boolean(
                data.plateNumber ||
                data.registrationNumber
            );


        const hasPlateCode =
            Boolean(
                data.plateCode
            );


        if (
            !hasPlateNumber ||
            !hasPlateCode
        ) {

            return "VEHICLE_DETAILS";

        }

    }


    /*
    -----------------------------------------------------
    QUOTE DATA
    -----------------------------------------------------
    */

    if (
        customerId &&
        insuranceType &&
        insuranceType !== "UNKNOWN" &&
        productType &&
        productType !== "UNKNOWN"
    ) {

        if (
            data.coverFrom &&
            data.coverTo
        ) {

            return "READY_FOR_QUOTE";

        }

    }


    /*
    -----------------------------------------------------
    KEEP LLM STAGE IF VALID
    -----------------------------------------------------
    */

    return (
        decision.stage ||
        flow.stage ||
        "DISCOVERY"
    );
}


/*
=========================================================
VALIDATE QUOTE DATA
=========================================================
*/

function validateQuoteData(
    flow,
    customerId
) {

    const data =
        flow.collectedData || {};

    const missing = [];


    /*
    CUSTOMER
    */

    if (!customerId) {

        missing.push("customerId");

    }


    /*
    INSURANCE TYPE
    */

    if (
        !flow.insuranceType ||
        flow.insuranceType === "UNKNOWN"
    ) {

        missing.push("insuranceType");

    }


    /*
    PRODUCT TYPE
    */

    if (
        !flow.productType ||
        flow.productType === "UNKNOWN"
    ) {

        missing.push("productType");

    }


    /*
    MOTOR
    */

    if (
        flow.insuranceType === "MOTOR"
    ) {

        if (
            !data.plateNumber &&
            !data.registrationNumber
        ) {

            missing.push("plateNumber");

        }


        if (!data.plateCode) {

            missing.push("plateCode");

        }

    }


    /*
    COVER DATES
    */

    if (!data.coverFrom) {

        missing.push("coverFrom");

    }


    if (!data.coverTo) {

        missing.push("coverTo");

    }


    return {

        valid:
            missing.length === 0,

        missing

    };
}


/*
=========================================================
FIND PRODUCT
=========================================================
*/

async function findProduct(productType) {

    const products =
        await getProducts();


    if (
        !Array.isArray(products) ||
        products.length === 0
    ) {

        return null;

    }


    const normalized =
        normalizeProductType(
            productType
        );


    if (!normalized) {

        return null;

    }


    return products.find(
        product => {

            const dbProductType =
                normalizeProductType(
                    product.PRODUCT_TYPE
                );


            const dbProductName =
                product.PRODUCT_NAME
                    ? String(
                        product.PRODUCT_NAME
                    ).toUpperCase()
                    : "";


            return (
                dbProductType === normalized ||
                dbProductName.includes(
                    normalized
                )
            );

        }
    ) || null;
}


/*
=========================================================
PROCESS READY FOR QUOTE
=========================================================
*/

async function processReadyForQuote({

    customerId,

    flow,

    language

}) {

    const t =
        TEXT[language];


    /*
    -----------------------------------------------------
    VALIDATE
    -----------------------------------------------------
    */

    const validation =
        validateQuoteData(
            flow,
            customerId
        );


    if (!validation.valid) {

        console.log(
            "\n========== QUOTE VALIDATION =========="
        );

        console.log(
            JSON.stringify(
                validation,
                null,
                2
            )
        );


        return {

            success: true,

            readyForQuote: false,

            uiType: "TEXT",

            reply:
                t.quoteMissing,

            actions: [],

            data: [],

            missingInformation:
                validation.missing

        };

    }


    const data =
        flow.collectedData || {};


    /*
    -----------------------------------------------------
    VEHICLE
    -----------------------------------------------------
    */

    let vehicle = null;


    if (
        flow.insuranceType === "MOTOR"
    ) {

        const plateNumber =
            data.plateNumber ||
            data.registrationNumber;


        vehicle =
            await getVehicle(
                plateNumber,
                data.plateCode
            );


        if (!vehicle) {

            return {

                success: true,

                readyForQuote: false,

                uiType: "TEXT",

                reply:
                    t.vehicleNotFound,

                actions: [],

                data: []

            };

        }

    }


    /*
    -----------------------------------------------------
    PRODUCT
    -----------------------------------------------------
    */

    const product =
        await findProduct(
            flow.productType
        );


    if (!product) {

        return {

            success: true,

            readyForQuote: false,

            uiType: "TEXT",

            reply:
                t.productNotFound,

            actions: [],

            data: []

        };

    }


    /*
    -----------------------------------------------------
    CREATE QUOTE
    -----------------------------------------------------
    */

    const quoteNumber =
        generateQuoteNumber();


    const quote =
        await createQuote({

            quoteNumber,

            customerId,

            vehicleId:
                vehicle
                    ? vehicle.VEHICLE_ID
                    : data.vehicleId || null,

            productId:
                product.PRODUCT_ID,

            vehicleValue:
                data.vehicleValue || null,

            coverFrom:
                data.coverFrom,

            coverTo:
                data.coverTo

        });


    console.log(
        "\n========== QUOTE CREATED =========="
    );

    console.log(
        JSON.stringify(
            quote,
            null,
            2
        )
    );


    /*
    -----------------------------------------------------
    GET OPTIONS
    -----------------------------------------------------
    */

    const options =
        await getQuoteOptions(
            quote.quoteId
        );


    /*
    -----------------------------------------------------
    UPDATE FLOW
    -----------------------------------------------------
    */

    updatePurchaseFlow(

        customerId,

        {

            stage:
                "QUOTE_OPTIONS",

            extractedData: {

                quoteId:
                    quote.quoteId,

                quoteNumber:
                    quote.quoteNumber,

                vehicleId:
                    vehicle
                        ? vehicle.VEHICLE_ID
                        : data.vehicleId || null,

                productId:
                    product.PRODUCT_ID

            },

            missingInformation: []

        }

    );


    return {

        success: true,

        readyForQuote: true,

        uiType:
            "QUOTE_OPTIONS",

        reply:
            t.quoteCreated,

        actions:
            options.map(
                option => ({

                    label:
                        option.PLAN_NAME,

                    action:
                        `SELECT_QUOTE_OPTION_${option.OPTION_NUMBER}`

                })
            ),

        data:
            options,

        quote: {

            quoteId:
                quote.quoteId,

            quoteNumber:
                quote.quoteNumber

        }

    };
}


/*
=========================================================
PROCESS QUOTE OPTION SELECTION
=========================================================
*/

async function processQuoteOptionSelection({

    customerId,

    message,

    language

}) {

    const flow =
        getPurchaseFlow(
            customerId
        );


    if (!flow) {

        return null;

    }


    const normalized =
        String(message)
            .trim()
            .toUpperCase();


    const match =
        normalized.match(
            /SELECT_QUOTE_OPTION_(\d+)/
        );


    if (!match) {

        return null;

    }


    const optionNumber =
        Number(match[1]);


    const data =
        flow.collectedData || {};


    if (!data.quoteId) {

        return null;

    }


    const selected =
        await selectQuoteOption(
            data.quoteId,
            optionNumber
        );


    if (!selected) {

        return {

            success: false,

            uiType:
                "TEXT",

            reply:
                purchaseReply(

                    language,

                    "I couldn't select that quote option. Please choose one of the available options.",

                    "لم أتمكن من اختيار خيار عرض السعر هذا. يرجى اختيار أحد الخيارات المتاحة."

                ),

            actions: [],

            data: []

        };

    }


    const selectedOption =
        await getSelectedQuoteOption(
            data.quoteId
        );


    updatePurchaseFlow(

        customerId,

        {

            stage:
                "PAYMENT",

            extractedData: {

                selectedOptionNumber:
                    optionNumber,

                selectedOptionId:
                    selectedOption
                        ? selectedOption.OPTION_ID
                        : null,

                premium:
                    selectedOption
                        ? selectedOption.PREMIUM
                        : null

            },

            missingInformation: []

        }

    );


    return {

        success: true,

        uiType:
            "PAYMENT",

        reply:
            purchaseReply(

                language,

                "Great! Your insurance option has been selected. You can proceed with payment.",

                "ممتاز! تم اختيار خيار التأمين الخاص بك. يمكنك الآن المتابعة إلى الدفع."

            ),

        actions: [

            {

                label:
                    purchaseReply(
                        language,
                        "Pay Now",
                        "الدفع الآن"
                    ),

                action:
                    "PAY_QUOTE"

            }

        ],

        data:
            selectedOption
                ? [selectedOption]
                : []

    };
}


/*
=========================================================
PROCESS PAYMENT
=========================================================
*/

async function processPayment({

    customerId,

    message,

    language

}) {

    const normalized =
        String(message)
            .trim()
            .toUpperCase();


    if (
        normalized !== "PAY_QUOTE" &&
        normalized !== "PAY"
    ) {

        return null;

    }


    const flow =
        getPurchaseFlow(
            customerId
        );


    if (!flow) {

        return null;

    }


    const data =
        flow.collectedData || {};


    if (!data.quoteId) {

        return null;

    }


    /*
    -----------------------------------------------------
    IMPORTANT:

    Verify selected option BEFORE marking payment PAID.
    -----------------------------------------------------
    */

    const selectedOption =
        await getSelectedQuoteOption(
            data.quoteId
        );


    if (!selectedOption) {

        return {

            success: false,

            uiType:
                "TEXT",

            reply:
                purchaseReply(

                    language,

                    "I couldn't find the selected quote option. Please select a quote option first.",

                    "لم أتمكن من العثور على خيار عرض السعر المحدد. يرجى اختيار أحد الخيارات أولاً."

                ),

            actions: [],

            data: []

        };

    }


    /*
    -----------------------------------------------------
    DEMO PAYMENT
    -----------------------------------------------------
    */

    const payment =
        await updatePaymentStatus(

            data.quoteId,

            "PAID"

        );


    if (!payment.success) {

        return {

            success: false,

            uiType:
                "TEXT",

            reply:
                purchaseReply(

                    language,

                    "I couldn't complete the payment process. Please try again.",

                    "لم أتمكن من إكمال عملية الدفع. يرجى المحاولة مرة أخرى."

                ),

            actions: [],

            data: []

        };

    }


    /*
    -----------------------------------------------------
    CONVERT QUOTE
    -----------------------------------------------------
    */

    await convertQuote(
        data.quoteId
    );


    /*
    -----------------------------------------------------
    CREATE POLICY
    -----------------------------------------------------
    */

    const policyNumber =
        generatePolicyNumber();


    const policy =
        await createPolicy({

            policyNumber,

            quoteId:
                data.quoteId,

            customerId,

            vehicleId:
                data.vehicleId || null,

            productId:
                data.productId,

            optionId:
                selectedOption.OPTION_ID,

            premium:
                selectedOption.PREMIUM,

            coverFrom:
                data.coverFrom,

            coverTo:
                data.coverTo

        });


    /*
    -----------------------------------------------------
    UPDATE FLOW
    -----------------------------------------------------
    */

    updatePurchaseFlow(

        customerId,

        {

            stage:
                "COMPLETED",

            extractedData: {

                policyId:
                    policy.policyId,

                policyNumber:
                    policy.policyNumber,

                paymentStatus:
                    "PAID"

            },

            missingInformation: []

        }

    );


    return {

        success: true,

        uiType:
            "TEXT",

        reply:
            purchaseReply(

                language,

                `Payment completed successfully. Your policy ${policy.policyNumber} has been created successfully.`,

                `تمت عملية الدفع بنجاح. تم إنشاء وثيقتك رقم ${policy.policyNumber} بنجاح.`

            ),

        actions: [],

        data: [

            {

                policyId:
                    policy.policyId,

                policyNumber:
                    policy.policyNumber,

                paymentStatus:
                    "PAID"

            }

        ]

    };
}


/*
=========================================================
SAVE ASSISTANT MESSAGE
=========================================================
*/

async function saveAssistantMessage({

    userId,

    customerId,

    loggedIn,

    sessionId,

    message,

    language

}) {

    if (!message) {

        return;

    }


    addMessage(

        userId,

        "assistant",

        message

    );


    if (
        loggedIn &&
        customerId
    ) {

        await saveMessage(

            customerId,

            sessionId,

            "bot",

            message,

            language

        );

    }
}


/*
=========================================================
MAIN CHAT
=========================================================
*/

const chat = async (req, res) => {

    try {

        /*
        -------------------------------------------------
        REQUEST
        -------------------------------------------------
        */

        const {

            message,

            customerId,

            loggedIn = true,

            language,

            sessionId

        } = req.body;


        /*
        -------------------------------------------------
        LANGUAGE
        -------------------------------------------------
        */

        const lang =
            getLanguage(language);


        const t =
            TEXT[lang];


        /*
        -------------------------------------------------
        VALIDATE MESSAGE
        -------------------------------------------------
        */

        if (
            !message ||
            !String(message).trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Message is required"

            });

        }


        /*
        -------------------------------------------------
        USER ID
        -------------------------------------------------
        */

        const userId =
            customerId || "guest";


        /*
        -------------------------------------------------
        SAVE USER MESSAGE
        -------------------------------------------------
        */

        addMessage(

            userId,

            "user",

            message

        );


        if (
            loggedIn &&
            customerId
        ) {

            await saveMessage(

                customerId,

                sessionId,

                "user",

                message,

                lang

            );

        }


        /*
        -------------------------------------------------
        HISTORY
        -------------------------------------------------
        */

        const history =
            getHistory(
                userId
            );


        /*
        =================================================
        CHECK EXISTING PURCHASE FLOW FIRST
        =================================================

        THIS IS VERY IMPORTANT.

        If the user is already inside a purchase flow:

            "I need motor insurance."
                    ↓
            purchase flow starts
                    ↓
            "I want third party."

        We DO NOT call normal chat handling first.

        The existing purchase flow owns the conversation.
        =================================================
        */

        const existingPurchaseFlow =
            getPurchaseFlow(
                userId
            );


        /*
        =================================================
        PURCHASE BUTTON ACTIONS
        =================================================
        */

        if (
            customerId &&
            existingPurchaseFlow
        ) {

            /*
            -------------------------------------------------
            QUOTE OPTION BUTTON
            -------------------------------------------------
            */

            const optionResult =
                await processQuoteOptionSelection({

                    customerId,

                    message,

                    language:
                        lang

                });


            if (optionResult) {

                await saveAssistantMessage({

                    userId,

                    customerId,

                    loggedIn,

                    sessionId,

                    message:
                        optionResult.reply,

                    language:
                        lang

                });


                return res.json({

                    ...optionResult,

                    intent:
                        "BUY_POLICY",

                    purchaseStage:
                        getPurchaseFlow(
                            userId
                        )?.stage || "PAYMENT"

                });

            }


            /*
            -------------------------------------------------
            PAYMENT BUTTON
            -------------------------------------------------
            */

            const paymentResult =
                await processPayment({

                    customerId,

                    message,

                    language:
                        lang

                });


            if (paymentResult) {

                await saveAssistantMessage({

                    userId,

                    customerId,

                    loggedIn,

                    sessionId,

                    message:
                        paymentResult.reply,

                    language:
                        lang

                });


                return res.json({

                    ...paymentResult,

                    intent:
                        "BUY_POLICY",

                    purchaseStage:
                        getPurchaseFlow(
                            userId
                        )?.stage || "COMPLETED"

                });

            }

        }


        /*
        =================================================
        INTENT DETECTION
        =================================================
        */

        const intentResult =
            await detectIntent(
                message
            );


        const intent =
            typeof intentResult === "string"

                ? intentResult

                : intentResult?.intent || "UNKNOWN";


        console.log(
            "\n========== INTENT =========="
        );

        console.log(
            JSON.stringify(
                intentResult,
                null,
                2
            )
        );


        /*
        =================================================
        OUT OF SCOPE
        =================================================

        Existing purchase flow gets priority over this.
        =================================================
        */

        if (
            !existingPurchaseFlow &&
            intent === "OUT_OF_SCOPE"
        ) {

            const reply =
                OUT_OF_SCOPE_REPLIES[
                    lang
                ];


            await saveAssistantMessage({

                userId,

                customerId,

                loggedIn,

                sessionId,

                message:
                    reply,

                language:
                    lang

            });


            return res.json({

                success: true,

                intent,

                reply,

                requiresLogin:
                    false,

                uiType:
                    "TEXT",

                actions: [],

                data: []

            });

        }


        /*
        =================================================
        PROTECTED INTENTS
        =================================================
        */

        if (
            !existingPurchaseFlow &&
            PROTECTED_INTENTS.includes(
                intent
            ) &&
            !loggedIn
        ) {

            const reply =
                t.login;


            await saveAssistantMessage({

                userId,

                customerId,

                loggedIn,

                sessionId,

                message:
                    reply,

                language:
                    lang

            });


            return res.json({

                success: true,

                intent,

                requiresLogin:
                    true,

                uiType:
                    "LOGIN_REQUIRED",

                reply,

                actions: [],

                data: []

            });

        }


        /*
        =================================================
        DETERMINE WHETHER PURCHASE FLOW SHOULD RUN
        =================================================

        Three possibilities:

        1. Existing purchase flow
        2. BUY_POLICY intent
        3. Strong explicit purchase request

        INSURANCE_GENERAL ALONE DOES NOT START PURCHASE FLOW.

        This is the important distinction between:

        "What is comprehensive insurance?"
                → normal insurance chat

        and

        "I want to buy comprehensive insurance."
                → purchase flow
        =================================================
        */

        const shouldStartPurchaseFlow =
            Boolean(
                existingPurchaseFlow ||
                intent === "BUY_POLICY" ||
                isStrongPurchaseMessage(message)
            );


        /*
        =================================================
        PURCHASE FLOW
        =================================================
        */

        if (
            shouldStartPurchaseFlow
        ) {

            /*
            -------------------------------------------------
            GET OR CREATE FLOW
            -------------------------------------------------
            */

            let purchaseFlow =
                existingPurchaseFlow;


            if (!purchaseFlow) {

                purchaseFlow =
                    startPurchaseFlow(
                        userId
                    );

            }


            /*
            -------------------------------------------------
            PURCHASE DECISION
            -------------------------------------------------
            */

            let purchaseDecision =
                await decidePurchaseStage({

                    message,

                    history,

                    purchaseFlow,

                    language:
                        lang

                });


            /*
            -------------------------------------------------
            APPLY DETERMINISTIC PURCHASE HINTS
            -------------------------------------------------

            Example:

            User:
            "I want third party."

            Even if LLM returns:

            productType = UNKNOWN

            we force:

            productType = THIRD_PARTY
            -------------------------------------------------
            */

            purchaseDecision =
                applyPurchaseHints(

                    purchaseDecision,

                    message,

                    purchaseFlow

                );


            /*
            -------------------------------------------------
            RESOLVE STAGE USING REAL DATA
            -------------------------------------------------
            */

            purchaseDecision.stage =
                resolvePurchaseStage(

                    purchaseDecision,

                    purchaseFlow,

                    customerId

                );


            /*
            -------------------------------------------------
            READY FOR QUOTE FLAG
            -------------------------------------------------

            Do not blindly trust the LLM.

            We calculate whether Oracle can actually create
            the quote.
            -------------------------------------------------
            */

            const temporaryFlow = {

                ...purchaseFlow,

                insuranceType:
                    purchaseDecision.insuranceType ||
                    purchaseFlow.insuranceType,

                productType:
                    purchaseDecision.productType ||
                    purchaseFlow.productType,

                plan:
                    purchaseDecision.plan ||
                    purchaseFlow.plan,

                collectedData: {

                    ...(purchaseFlow.collectedData || {}),

                    ...(purchaseDecision.extractedData || {})

                }

            };


            const quoteValidation =
                validateQuoteData(

                    temporaryFlow,

                    customerId

                );


            purchaseDecision.readyForQuote =
                quoteValidation.valid;


            if (
                purchaseDecision.readyForQuote
            ) {

                purchaseDecision.stage =
                    "READY_FOR_QUOTE";

            }


            /*
            -------------------------------------------------
            UPDATE PURCHASE FLOW
            -------------------------------------------------

            IMPORTANT:

            This happens AFTER deterministic extraction.
            -------------------------------------------------
            */

            purchaseFlow =
                updatePurchaseFlow(

                    userId,

                    purchaseDecision

                );


            console.log(
                "\n========== UPDATED PURCHASE FLOW =========="
            );

            console.log(
                JSON.stringify(
                    purchaseFlow,
                    null,
                    2
                )
            );


            /*
            =================================================
            READY FOR QUOTE
            =================================================
            */

            if (
                purchaseDecision.readyForQuote === true
            ) {

                /*
                -------------------------------------------------
                LOGIN REQUIRED
                -------------------------------------------------
                */

                if (
                    !loggedIn ||
                    !customerId
                ) {

                    const reply =
                        t.loginPurchase;


                    await saveAssistantMessage({

                        userId,

                        customerId,

                        loggedIn,

                        sessionId,

                        message:
                            reply,

                        language:
                            lang

                    });


                    return res.json({

                        success: true,

                        intent:
                            "BUY_POLICY",

                        purchaseStage:
                            purchaseFlow.stage,

                        reply,

                        requiresLogin:
                            true,

                        uiType:
                            "LOGIN_REQUIRED",

                        actions: [],

                        data: []

                    });

                }


                /*
                -------------------------------------------------
                PROCESS ORACLE QUOTE
                -------------------------------------------------
                */

                const quoteResult =
                    await processReadyForQuote({

                        customerId,

                        flow:
                            purchaseFlow,

                        language:
                            lang

                    });


                if (
                    quoteResult.reply
                ) {

                    await saveAssistantMessage({

                        userId,

                        customerId,

                        loggedIn,

                        sessionId,

                        message:
                            quoteResult.reply,

                        language:
                            lang

                    });

                }


                return res.json({

                    success:
                        quoteResult.success,

                    intent:
                        "BUY_POLICY",

                    purchaseStage:
                        getPurchaseFlow(
                            userId
                        )?.stage ||
                        purchaseDecision.stage,

                    product:
                        getPurchaseFlow(
                            userId
                        )?.productType ||
                        null,

                    reply:
                        quoteResult.reply,

                    requiresLogin:
                        false,

                    uiType:
                        quoteResult.uiType,

                    actions:
                        quoteResult.actions || [],

                    data:
                        quoteResult.data || [],

                    quote:
                        quoteResult.quote || null,

                    purchaseData:
                        getPurchaseFlow(
                            userId
                        )?.collectedData || {},

                    missingInformation:
                        quoteResult.missingInformation || []

                });

            }


            /*
            =================================================
            NORMAL PURCHASE CONVERSATION
            =================================================
            */

            const reply =
                purchaseDecision.reply ||
                purchaseReply(

                    lang,

                    "Absolutely. Let's continue from where we left off.",

                    "بالتأكيد، دعنا نتابع من حيث توقفنا."

                );


            await saveAssistantMessage({

                userId,

                customerId,

                loggedIn,

                sessionId,

                message:
                    reply,

                language:
                    lang

            });


            return res.json({

                success: true,

                intent:
                    "BUY_POLICY",

                purchaseStage:
                    purchaseFlow.stage,

                product:
                    purchaseFlow.productType ||
                    null,

                reply,

                requiresLogin:
                    false,

                uiType:
                    "TEXT",

                actions: [],

                data: [],

                purchaseData:
                    purchaseFlow.collectedData || {},

                missingInformation:
                    purchaseFlow.missingInformation || []

            });

        }


        /*
        =================================================
        NORMAL INSURANCE CHAT
        =================================================
        */

        let databaseContext =
            "";

        const data = [];


        /*
        -------------------------------------------------
        RAG
        -------------------------------------------------
        */

        const retrievedChunks =
            await retrieveRelevantChunks(
                message
            );


        const ragContext =
            Array.isArray(
                retrievedChunks
            )

                ? retrievedChunks
                    .map(
                        chunk =>
                            `[${chunk.fileName}]\n${chunk.text}`
                    )
                    .join("\n\n")

                : "";


        console.log(
            "\n========== RAG CONTEXT =========="
        );

        console.log(
            ragContext
        );


        /*
        -------------------------------------------------
        AI
        -------------------------------------------------
        */

        const aiReply =
            await askAI(

                message,

                databaseContext,

                ragContext,

                history,

                lang

            );


        /*
        -------------------------------------------------
        SAVE
        -------------------------------------------------
        */

        await saveAssistantMessage({

            userId,

            customerId,

            loggedIn,

            sessionId,

            message:
                aiReply,

            language:
                lang

        });


        /*
        -------------------------------------------------
        RESPONSE
        -------------------------------------------------
        */

        return res.json({

            success: true,

            intent,

            reply:
                aiReply,

            requiresLogin:
                false,

            uiType:
                "TEXT",

            actions: [],

            data

        });

    }

    catch (err) {

        console.error(
            "\n========== CHAT CONTROLLER ERROR =========="
        );

        console.error(
            err
        );


        return res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


/*
=========================================================
CLEAR CHAT
=========================================================
*/

const clearChat = (req, res) => {

    try {

        const userId =
            req.body.customerId ||
            "guest";


        /*
        -------------------------------------------------
        NORMAL CHAT
        -------------------------------------------------
        */

        clearHistory(
            userId
        );


        /*
        -------------------------------------------------
        PURCHASE FLOW
        -------------------------------------------------
        */

        endPurchaseFlow(
            userId
        );


        return res.json({

            success: true,

            message:
                "Conversation cleared."

        });

    }

    catch (err) {

        console.error(
            "Clear chat error:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    chat,

    clearChat

};