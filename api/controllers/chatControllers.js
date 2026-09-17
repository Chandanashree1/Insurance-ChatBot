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

const { askAI } = require("../services/huggingFaceService");
const { detectIntent } = require("../services/intentservice");
const { retrieveRelevantChunks } = require("../services/ragService");

const {
    getHistory,
    addMessage,
    clearHistory
} = require("../services/conversationservice");

const { saveMessage } = require("../services/historyService");

const {
    startPurchaseFlow,
    getPurchaseFlow,
    updatePurchaseFlow,
    endPurchaseFlow,
    decidePurchaseStage
} = require("../services/purchaseFlowService");


// Protected intents

const PROTECTED_INTENTS = [
    "POLICY",
    "CLAIM",
    "PROFILE",
    "PAYMENT",
    "DOWNLOAD_POLICY",
    "RENEW_POLICY"
];


// General responses

const OUT_OF_SCOPE_REPLIES = {
    en: "I am ABC Insurance's virtual assistant and can only assist with insurance-related queries.",
    ar: "أنا المساعد الافتراضي لشركة ABC للتأمين، ويمكنني فقط مساعدتك في الاستفسارات المتعلقة بالتأمين."
};

const TEXT = {
    en: {
        greeting: "👋 Hello! Welcome to ABC Insurance.\nHow can I assist you today?",
        thanks: "You're welcome! 😊",
        goodbye: "Thank you for choosing ABC Insurance. Have a wonderful day! 👋",
        help: "I can help you with:\n• Policy Details\n• Claim Status\n• Renewals\n• Premiums\n• Claim Documents",
        login: "I'd be happy to help with your personal insurance information. Please log in to continue.",
        loginPurchase: "Please log in before we continue with your insurance purchase.",
        quoteMissing: "I still need a few details before I can generate your quote.",
        vehicleNotFound: "I couldn't find a vehicle matching those registration details. Please check the plate number and plate code.",
        productNotFound: "I couldn't find the requested insurance product in our available products.",
        quoteCreated: "Great! Your quote has been generated. Here are the available options."
    },

    ar: {
        greeting: "👋 مرحباً! أهلاً بك في تأمين ABC.\nكيف يمكنني مساعدتك اليوم؟",
        thanks: "على الرحب والسعة! 😊",
        goodbye: "شكراً لاختيارك تأمين ABC. نتمنى لك يوماً رائعاً! 👋",
        help: "يمكنني مساعدتك في:\n• تفاصيل الوثيقة\n• حالة المطالبة\n• تجديد الوثيقة\n• الأقساط\n• مستندات المطالبة",
        login: "سأكون سعيدًا بمساعدتك بمعلومات التأمين الشخصي الخاصة بك. الرجاء تسجيل الدخول للمتابعة.",
        loginPurchase: "يرجى تسجيل الدخول قبل متابعة شراء التأمين.",
        quoteMissing: "ما زلت بحاجة إلى بعض التفاصيل قبل إنشاء عرض السعر الخاص بك.",
        vehicleNotFound: "لم أتمكن من العثور على مركبة تطابق بيانات التسجيل. يرجى التحقق من رقم اللوحة ورمز اللوحة.",
        productNotFound: "لم أتمكن من العثور على منتج التأمين المطلوب ضمن المنتجات المتاحة.",
        quoteCreated: "ممتاز! تم إنشاء عرض السعر الخاص بك. إليك الخيارات المتاحة."
    }
};


function getLanguage(language) {
    return language === "ar" ? "ar" : "en";
}


function purchaseReply(language, en, ar) {
    return language === "ar" ? ar : en;
}


function generateQuoteNumber() {
    return `Q-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}


function generatePolicyNumber() {
    return `POL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}


function normalizeProductType(productType) {
    if (!productType) return null;

    const value = String(productType).trim().toUpperCase();

    if (
        value === "THIRD_PARTY" ||
        value === "THIRD PARTY"
    ) {
        return "THIRD_PARTY";
    }

    if (
        value === "COMPREHENSIVE" ||
        value === "FULL_COVERAGE" ||
        value === "FULL COVERAGE"
    ) {
        return "COMPREHENSIVE";
    }

    return value;
}


// Backend decides what information is actually missing.

function getPurchaseRequirements(flow) {
    const data = flow.collectedData || {};
    const missing = [];

    if (!flow.insuranceType) {
        missing.push("insuranceType");
        return missing;
    }

    if (
        flow.insuranceType === "MOTOR" &&
        !flow.productType
    ) {
        missing.push("productType");
        return missing;
    }

    if (flow.insuranceType === "MOTOR") {
        if (!data.plateNumber && !data.registrationNumber) {
            missing.push("plateNumber");
        }

        if (!data.plateCode) {
            missing.push("plateCode");
        }
    }

    if (!data.coverFrom) {
        missing.push("coverFrom");
    }

    if (!data.coverTo) {
        missing.push("coverTo");
    }

    return missing;
}


// Backend determines the purchase stage.

function determinePurchaseStage(flow) {
    const missing = getPurchaseRequirements(flow);

    if (missing.includes("insuranceType")) {
        return "TYPE_IDENTIFICATION";
    }

    if (missing.includes("productType")) {
        return "PRODUCT_IDENTIFICATION";
    }

    if (
        missing.includes("plateNumber") ||
        missing.includes("plateCode")
    ) {
        return "VEHICLE_DETAILS";
    }

    if (
        missing.includes("coverFrom") ||
        missing.includes("coverTo")
    ) {
        return "DATES";
    }

    return "READY_FOR_QUOTE";
}


// Build the next purchase question.

function buildPurchaseReply(flow, stage, language) {
    const data = flow.collectedData || {};

    if (stage === "TYPE_IDENTIFICATION") {
        return purchaseReply(
            language,
            "What would you like to insure: your Motor, health, travel, or life?",
            "ما الذي ترغب في تأمينه: السيارة أم الصحة أم السفر أم الحياة؟"
        );
    }

    if (
        stage === "PRODUCT_IDENTIFICATION" &&
        flow.insuranceType === "MOTOR"
    ) {
        return purchaseReply(
            language,
            "For your car insurance, would you prefer third-party or comprehensive coverage?",
            "بالنسبة لتأمين سيارتك، هل تفضل تغطية الطرف الثالث أم التغطية الشاملة؟"
        );
    }

    if (stage === "VEHICLE_DETAILS") {
        if (
            !data.plateNumber &&
            !data.registrationNumber
        ) {
            return purchaseReply(
                language,
                "Please provide your vehicle plate number.",
                "يرجى تزويدي برقم لوحة المركبة."
            );
        }

        if (!data.plateCode) {
            return purchaseReply(
                language,
                "Please provide your vehicle plate code.",
                "يرجى تزويدي برمز لوحة المركبة."
            );
        }
    }

    if (stage === "DATES") {
        if (!data.coverFrom) {
            return purchaseReply(
                language,
                "What date would you like your insurance coverage to start?",
                "ما التاريخ الذي ترغب أن تبدأ فيه التغطية التأمينية؟"
            );
        }

        if (!data.coverTo) {
            return purchaseReply(
                language,
                "What date should your insurance coverage end?",
                "ما التاريخ الذي ترغب أن تنتهي فيه التغطية التأمينية؟"
            );
        }
    }

    return purchaseReply(
        language,
        "I have the required information. I can now prepare your quote.",
        "لدي الآن المعلومات المطلوبة ويمكنني إعداد عرض السعر الخاص بك."
    );
}


// Find product from Oracle.

async function findProduct(productType) {
    const products = await getProducts();

    if (!Array.isArray(products) || products.length === 0) {
        return null;
    }

    const normalized = normalizeProductType(productType);

    return products.find(product => {
        const dbType =
            normalizeProductType(product.PRODUCT_TYPE);

        const dbName = product.PRODUCT_NAME
            ? String(product.PRODUCT_NAME).toUpperCase()
            : "";

        return (
            dbType === normalized ||
            dbName.includes(normalized)
        );
    }) || null;
}


// Validate quote data.

function validateQuoteData(flow, customerId) {
    const data = flow.collectedData || {};
    const missing = [];

    if (!customerId) {
        missing.push("customerId");
    }

    if (!flow.insuranceType) {
        missing.push("insuranceType");
    }

    if (!flow.productType) {
        missing.push("productType");
    }

    if (flow.insuranceType === "MOTOR") {
        if (!data.plateNumber && !data.registrationNumber) {
            missing.push("plateNumber");
        }

        if (!data.plateCode) {
            missing.push("plateCode");
        }
    }

    if (!data.coverFrom) {
        missing.push("coverFrom");
    }

    if (!data.coverTo) {
        missing.push("coverTo");
    }

    return {
        valid: missing.length === 0,
        missing
    };
}


// Create Oracle quote.

async function processReadyForQuote({
    customerId,
    flow,
    language
}) {
    const t = TEXT[language];

    const validation =
        validateQuoteData(flow, customerId);

    if (!validation.valid) {
        return {
            success: true,
            readyForQuote: false,
            uiType: "TEXT",
            reply: t.quoteMissing,
            actions: [],
            data: [],
            missingInformation:
                validation.missing
        };
    }

    const data = flow.collectedData || {};

    let vehicle = null;

    if (flow.insuranceType === "MOTOR") {
        const plateNumber =
            data.plateNumber ||
            data.registrationNumber;

        vehicle = await getVehicle(
            plateNumber,
            data.plateCode
        );

        if (!vehicle) {
            return {
                success: true,
                readyForQuote: false,
                uiType: "TEXT",
                reply: t.vehicleNotFound,
                actions: [],
                data: []
            };
        }
    }

    const product =
        await findProduct(flow.productType);

    if (!product) {
        return {
            success: true,
            readyForQuote: false,
            uiType: "TEXT",
            reply: t.productNotFound,
            actions: [],
            data: []
        };
    }

    const quoteNumber =
        generateQuoteNumber();

    const quote = await createQuote({
        quoteNumber,
        customerId,
        vehicleId: vehicle
            ? vehicle.VEHICLE_ID
            : data.vehicleId || null,
        productId: product.PRODUCT_ID,
        vehicleValue:
            data.vehicleValue || null,
        coverFrom: data.coverFrom,
        coverTo: data.coverTo
    });

    console.log("\n========== QUOTE CREATED ==========");

    console.log(
        JSON.stringify(quote, null, 2)
    );

    const options =
        await getQuoteOptions(quote.quoteId);

    updatePurchaseFlow(
        customerId,
        {
            stage: "QUOTE_OPTIONS",
            extractedData: {
                quoteId: quote.quoteId,
                quoteNumber: quote.quoteNumber,
                vehicleId: vehicle
                    ? vehicle.VEHICLE_ID
                    : null,
                productId: product.PRODUCT_ID
            },
            missingInformation: []
        }
    );

    return {
        success: true,
        readyForQuote: true,
        uiType: "QUOTE_OPTIONS",
        reply: t.quoteCreated,

        actions: options.map(option => ({
            label: option.PLAN_NAME,
            action:
                `SELECT_QUOTE_OPTION_${option.OPTION_NUMBER}`
        })),

        data: options,

        quote: {
            quoteId: quote.quoteId,
            quoteNumber: quote.quoteNumber
        }
    };
}


// Quote option selection.

async function processQuoteOptionSelection({
    customerId,
    message,
    language
}) {
    const flow =
        getPurchaseFlow(customerId);

    if (!flow) return null;

    const match = String(message)
        .trim()
        .toUpperCase()
        .match(/SELECT_QUOTE_OPTION_(\d+)/);

    if (!match) return null;

    const optionNumber =
        Number(match[1]);

    const data =
        flow.collectedData || {};

    if (!data.quoteId) return null;

    const selected =
        await selectQuoteOption(
            data.quoteId,
            optionNumber
        );

    if (!selected) {
        return {
            success: false,
            uiType: "TEXT",
            reply: purchaseReply(
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
            stage: "PAYMENT",
            extractedData: {
                selectedOptionNumber:
                    optionNumber,
                selectedOptionId:
                    selectedOption?.OPTION_ID || null,
                premium:
                    selectedOption?.PREMIUM || null
            },
            missingInformation: []
        }
    );

    return {
        success: true,
        uiType: "PAYMENT",

        reply: purchaseReply(
            language,
            "Great! Your insurance option has been selected. You can proceed with payment.",
            "ممتاز! تم اختيار خيار التأمين الخاص بك. يمكنك الآن المتابعة إلى الدفع."
        ),

        actions: [
            {
                label: purchaseReply(
                    language,
                    "Pay Now",
                    "الدفع الآن"
                ),
                action: "PAY_QUOTE"
            }
        ],

        data: selectedOption
            ? [selectedOption]
            : []
    };
}


// Payment and policy creation.

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
        getPurchaseFlow(customerId);

    if (!flow) return null;

    const data =
        flow.collectedData || {};

    if (!data.quoteId) return null;

    const payment =
        await updatePaymentStatus(
            data.quoteId,
            "PAID"
        );

    if (!payment.success) {
        return {
            success: false,
            uiType: "TEXT",
            reply: purchaseReply(
                language,
                "I couldn't complete the payment process. Please try again.",
                "لم أتمكن من إكمال عملية الدفع. يرجى المحاولة مرة أخرى."
            ),
            actions: [],
            data: []
        };
    }

    const selectedOption =
        await getSelectedQuoteOption(
            data.quoteId
        );

    if (!selectedOption) {
        return {
            success: false,
            uiType: "TEXT",
            reply: purchaseReply(
                language,
                "I couldn't find the selected quote option.",
                "لم أتمكن من العثور على خيار عرض السعر المحدد."
            ),
            actions: [],
            data: []
        };
    }

    await convertQuote(data.quoteId);

    const policyNumber =
        generatePolicyNumber();

    const policy = await createPolicy({
        policyNumber,
        quoteId: data.quoteId,
        customerId,
        vehicleId:
            data.vehicleId || null,
        productId: data.productId,
        optionId:
            selectedOption.OPTION_ID,
        premium:
            selectedOption.PREMIUM,
        coverFrom:
            data.coverFrom,
        coverTo:
            data.coverTo
    });

    updatePurchaseFlow(
        customerId,
        {
            stage: "COMPLETED",
            extractedData: {
                policyId:
                    policy.policyId,
                policyNumber:
                    policy.policyNumber,
                paymentStatus: "PAID"
            },
            missingInformation: []
        }
    );

    const result = {
        success: true,
        uiType: "TEXT",

        reply: purchaseReply(
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

    // Purchase is finished.

    endPurchaseFlow(customerId);

    return result;
}


// Main chat controller.

const chat = async (req, res) => {
    try {
        const {
            message,
            customerId,
            loggedIn = true,
            language,
            sessionId
        } = req.body;

        const lang = getLanguage(language);

        // Use sessionId for conversation state.
        // This prevents different conversations from sharing
        // the same purchase flow.
        const flowUserId =
            sessionId || customerId || "guest";

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message is required"
            });
        }

        addMessage(flowUserId, "user", message);

        if (loggedIn && customerId) {
            await saveMessage(
                customerId,
                sessionId,
                "user",
                message,
                lang
            );
        }

        const history = getHistory(flowUserId);

        // --------------------------------------------------
        // 1. Quote option selection
        // --------------------------------------------------

        if (customerId) {
            const optionResult =
                await processQuoteOptionSelection({
                    customerId,
                    message,
                    language: lang
                });

            if (optionResult) {
                if (optionResult.reply) {
                    addMessage(
                        flowUserId,
                        "assistant",
                        optionResult.reply
                    );

                    if (loggedIn) {
                        await saveMessage(
                            customerId,
                            sessionId,
                            "bot",
                            optionResult.reply,
                            lang
                        );
                    }
                }

                return res.json(optionResult);
            }

            // --------------------------------------------------
            // 2. Payment
            // --------------------------------------------------

            const paymentResult =
                await processPayment({
                    customerId,
                    message,
                    language: lang
                });

            if (paymentResult) {
                if (paymentResult.reply) {
                    addMessage(
                        flowUserId,
                        "assistant",
                        paymentResult.reply
                    );

                    if (loggedIn) {
                        await saveMessage(
                            customerId,
                            sessionId,
                            "bot",
                            paymentResult.reply,
                            lang
                        );
                    }
                }

                return res.json(paymentResult);
            }
        }

        // --------------------------------------------------
        // 3. Check active purchase flow FIRST
        // --------------------------------------------------
        //
        // This is the most important part.
        //
        // Example:
        //
        // User: I want to buy insurance
        //       -> BUY_POLICY
        //
        // User: My car
        //       -> Purchase LLM
        //
        // User: Comprehensive
        //       -> Purchase LLM
        //
        // User: My plate number is 12345 and plate code is M
        //       -> Purchase LLM
        //
        // We MUST NOT run detectIntent() again for these
        // follow-up messages.
        // --------------------------------------------------

        const existingPurchaseFlow =
            getPurchaseFlow(flowUserId);

        if (
            existingPurchaseFlow &&
            existingPurchaseFlow.active !== false
        ) {
            console.log(
                "\n========== ACTIVE PURCHASE FLOW =========="
            );

            console.log(
                JSON.stringify(
                    existingPurchaseFlow,
                    null,
                    2
                )
            );

            return await handlePurchaseFlow({
                req,
                res,
                message,
                customerId,
                loggedIn,
                lang,
                sessionId,
                userId: flowUserId,
                history,
                purchaseFlow:
                    existingPurchaseFlow
            });
        }

        // --------------------------------------------------
        // 4. No active purchase flow
        //    Now detect the user's intent
        // --------------------------------------------------

        const intentResult =
            await detectIntent(message);

        const intent =
            typeof intentResult === "string"
                ? intentResult
                : intentResult?.intent || "UNKNOWN";

        console.log(
            "\n========== AI INTENT =========="
        );

        console.log(
            "Message:",
            message
        );

        console.log(
            "Intent:",
            intent
        );

        console.log(
            JSON.stringify(
                intentResult,
                null,
                2
            )
        );

        // --------------------------------------------------
        // 5. Protected intents
        // --------------------------------------------------

        if (
            PROTECTED_INTENTS.includes(intent) &&
            !loggedIn
        ) {
            const reply =
                TEXT[lang].login;

            addMessage(
                flowUserId,
                "assistant",
                reply
            );

            return res.json({
                success: true,
                intent,
                requiresLogin: true,
                uiType: "LOGIN_REQUIRED",
                reply,
                actions: [],
                data: []
            });
        }

        // -------------------------
// STP - Instant Resolution
// -------------------------

if (intent === "COMPLAINT") {

    const stpResult = await resolveKnownIssue(message);

    if (stpResult.matched) {

        const stpContext = stpResult.chunks
            .map(chunk => `[${chunk.fileName}]\n${chunk.text}`)
            .join("\n\n");

        console.log("\n========== STP ISSUE ==========");
        console.log(stpResult.issueCode);

        console.log("\n========== STP RAG CONTEXT ==========");
        console.log(stpContext);

        const stpReply = await askAI(
            message,
            "",
            stpContext,
            history,
            language
        );

        // Save assistant response
        addMessage(userId, "assistant", stpReply);

        if (loggedIn && customerId) {
            await saveMessage(
                customerId,
                sessionId,
                "bot",
                stpReply,
                language
            );
        }

        return res.json({
            success: true,
            intent,
            reply: stpReply,
            requiresLogin: false,
            uiType: "STP_RESOLUTION",
            stp: true,
            issueCode: stpResult.issueCode,
            actions: [
                {
                    label: language === "ar"
                        ? "تم الحل"
                        : "Yes, resolved",
                    action: "STP_RESOLVED"
                },
                {
                    label: language === "ar"
                        ? "ما زلت بحاجة إلى مساعدة"
                        : "No, I still need help",
                    action: "STP_NOT_RESOLVED"
                }
            ],
            data: []
        });
    }

    console.log("No known issue matched. Continue with normal complaint flow.");
}

        // -------------------------
// STP - Instant Resolution
// -------------------------

if (intent === "COMPLAINT") {

    const stpResult = await resolveKnownIssue(message);

    if (stpResult.matched) {

        const stpContext = stpResult.chunks
            .map(chunk => `[${chunk.fileName}]\n${chunk.text}`)
            .join("\n\n");

        console.log("\n========== STP ISSUE ==========");
        console.log(stpResult.issueCode);

        console.log("\n========== STP RAG CONTEXT ==========");
        console.log(stpContext);

        const stpReply = await askAI(
            message,
            "",
            stpContext,
            history,
            language
        );

        // Save assistant response
        addMessage(userId, "assistant", stpReply);

        if (loggedIn && customerId) {
            await saveMessage(
                customerId,
                sessionId,
                "bot",
                stpReply,
                language
            );
        }

        return res.json({
            success: true,
            intent,
            reply: stpReply,
            requiresLogin: false,
            uiType: "STP_RESOLUTION",
            stp: true,
            issueCode: stpResult.issueCode,
            actions: [
                {
                    label: language === "ar"
                        ? "تم الحل"
                        : "Yes, resolved",
                    action: "STP_RESOLVED"
                },
                {
                    label: language === "ar"
                        ? "ما زلت بحاجة إلى مساعدة"
                        : "No, I still need help",
                    action: "STP_NOT_RESOLVED"
                }
            ],
            data: []
        });
    }

    console.log("No known issue matched. Continue with normal complaint flow.");
}


        // --------------------------------------------------
        // 6. Out of scope
        // --------------------------------------------------
        //
        // This is reached ONLY when there is no active
        // purchase flow.
        //
        // Therefore a purchase follow-up such as:
        // "plate number is 12345"
        // cannot accidentally reach this block.
        // --------------------------------------------------

        if (intent === "OUT_OF_SCOPE") {
            const reply =
                OUT_OF_SCOPE_REPLIES[lang];

            addMessage(
                flowUserId,
                "assistant",
                reply
            );

            return res.json({
                success: true,
                intent,
                reply,
                requiresLogin: false,
                uiType: "TEXT",
                actions: [],
                data: []
            });
        }

        // --------------------------------------------------
        // 7. Start purchase flow
        // --------------------------------------------------

        const isPurchaseRequest =
            intent === "BUY_POLICY" ||
            intent === "INSURANCE_GENERAL";

        if (isPurchaseRequest) {
            const purchaseFlow =
                startPurchaseFlow(flowUserId);

            console.log(
                "\n========== START PURCHASE FLOW =========="
            );

            console.log(
                JSON.stringify(
                    purchaseFlow,
                    null,
                    2
                )
            );

            return await handlePurchaseFlow({
                req,
                res,
                message,
                customerId,
                loggedIn,
                lang,
                sessionId,
                userId: flowUserId,
                history,
                purchaseFlow
            });
        }

        // --------------------------------------------------
        // 8. Normal insurance chat
        // --------------------------------------------------

        const retrievedChunks =
            await retrieveRelevantChunks(message);

        const ragContext =
            retrievedChunks
                .map(
                    chunk =>
                        `[${chunk.fileName}]\n${chunk.text}`
                )
                .join("\n\n");

        const aiReply =
            await askAI(
                message,
                "",
                ragContext,
                history,
                lang
            );

        addMessage(
            flowUserId,
            "assistant",
            aiReply
        );

        if (loggedIn && customerId) {
            await saveMessage(
                customerId,
                sessionId,
                "bot",
                aiReply,
                lang
            );
        }

        return res.json({
            success: true,
            intent,
            reply: aiReply,
            requiresLogin: false,
            uiType: "TEXT",
            actions: [],
            data: []
        });

    } catch (err) {
        console.error(
            "\n========== CHAT CONTROLLER ERROR =========="
        );

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// Purchase flow handler.

async function handlePurchaseFlow({
    req,
    res,
    message,
    customerId,
    loggedIn,
    lang,
    sessionId,
    userId,
    history,
    purchaseFlow
}) {
    const decision =
        await decidePurchaseStage({
            message,
            history,
            purchaseFlow,
            language: lang
        });

    console.log("\n========== PURCHASE LLM ==========");
    console.log(JSON.stringify(decision, null, 2));

    const updatedFlow =
        updatePurchaseFlow(
            userId,
            {
                ...decision,
                stage: undefined,
                lastUserMessage: message
            }
        );

    const missing =
        getPurchaseRequirements(updatedFlow);

    const stage =
        determinePurchaseStage(updatedFlow);

    const finalFlow =
        updatePurchaseFlow(
            userId,
            {
                stage,
                missingInformation: missing
            }
        );

    console.log("\n========== BACKEND PURCHASE VALIDATION ==========");
    console.log(JSON.stringify({ stage, missing, collectedData: finalFlow.collectedData }, null, 2));

    // --------------------------------------------------
    // Hand off MOTOR purchases to the visual Buy Policy
    // form — it collects productType, plate details, and
    // dates in one screen, so skip the text slot-filling.
    // --------------------------------------------------

    if (
        finalFlow.insuranceType === "MOTOR" &&
        stage !== "READY_FOR_QUOTE"
    ) {
        // Require login before showing the purchase form.
        if (!loggedIn || !customerId) {
            const loginReply = TEXT[lang].loginPurchase;

            addMessage(userId, "assistant", loginReply);

            return res.json({
                success: true,
                intent: "BUY_POLICY",
                purchaseStage: stage,
                product: "MOTOR",
                reply: loginReply,
                requiresLogin: true,
                uiType: "LOGIN_REQUIRED",
                actions: [],
                data: [],
                purchaseData: finalFlow.collectedData || {},
                missingInformation: []
            });
        }

        const formHandoffReply = purchaseReply(
            lang,
            "Sure — let's get your car insurance details.",
            "بالتأكيد! دعنا نحصل على تفاصيل تأمين سيارتك."
        );

        addMessage(userId, "assistant", formHandoffReply);

        await saveMessage(customerId, sessionId, "bot", formHandoffReply, lang);

        // The form owns quote + payment from here via QuoteService,
        // so clear the LLM-driven flow to avoid stale state.
        endPurchaseFlow(userId);

        return res.json({
            success: true,
            intent: "BUY_POLICY",
            purchaseStage: "BUY_POLICY_FORM",
            product: "MOTOR",
            reply: formHandoffReply,
            requiresLogin: false,
            uiType: "BUY_POLICY_FORM",
            actions: [],
            data: [],
            purchaseData: finalFlow.collectedData || {},
            missingInformation: []
        });
    }

    // --------------------------------------------------
    // Quote can only happen when backend validation
    // says READY.
    // --------------------------------------------------

    if (stage === "READY_FOR_QUOTE") {
        if (!loggedIn || !customerId) {
            const reply = TEXT[lang].loginPurchase;

            return res.json({
                success: true,
                intent: "BUY_POLICY",
                purchaseStage: stage,
                reply,
                requiresLogin: true,
                uiType: "LOGIN_REQUIRED",
                actions: [],
                data: [],
                purchaseData: finalFlow.collectedData || {},
                missingInformation: []
            });
        }

        const quoteResult =
            await processReadyForQuote({
                customerId,
                flow: finalFlow,
                language: lang
            });

        if (quoteResult.reply) {
            addMessage(userId, "assistant", quoteResult.reply);
            await saveMessage(customerId, sessionId, "bot", quoteResult.reply, lang);
        }

        return res.json({
            success: true,
            intent: "BUY_POLICY",
            purchaseStage: getPurchaseFlow(userId)?.stage || stage,
            product: finalFlow.productType || null,
            reply: quoteResult.reply,
            requiresLogin: false,
            uiType: quoteResult.uiType,
            actions: quoteResult.actions || [],
            data: quoteResult.data || [],
            quote: quoteResult.quote || null,
            purchaseData: finalFlow.collectedData || {},
            missingInformation: quoteResult.missingInformation || []
        });
    }

    // --------------------------------------------------
    // Continue purchase conversation (text Q&A for
    // non-Motor types, or before insurance type is known).
    // --------------------------------------------------

    const reply =
        buildPurchaseReply(finalFlow, stage, lang);

    addMessage(userId, "assistant", reply);

    if (loggedIn && customerId) {
        await saveMessage(customerId, sessionId, "bot", reply, lang);
    }

    let actions = [];

    if (stage === "TYPE_IDENTIFICATION") {
        actions = [
            { label: purchaseReply(lang, "Car Insurance", "تأمين السيارة"), action: "MOTOR" },
            { label: purchaseReply(lang, "Health Insurance", "التأمين الصحي"), action: "HEALTH" },
            { label: purchaseReply(lang, "Travel Insurance", "تأمين السفر"), action: "TRAVEL" },
            { label: purchaseReply(lang, "Life Insurance", "التأمين على الحياة"), action: "LIFE" }
        ];
    }

    return res.json({
        success: true,
        intent: "BUY_POLICY",
        purchaseStage: stage,
        product: finalFlow.productType || null,
        reply,
        requiresLogin: false,
        uiType: "TEXT",
        actions,
        data: [],
        purchaseData: finalFlow.collectedData || {},
        missingInformation: missing
    });
}
// Clear chat and purchase flow.

const clearChat = (req, res) => {
    try {
        const userId =
            req.body.customerId || "guest";

        clearHistory(userId);
        endPurchaseFlow(userId);

        return res.json({
            success: true,
            message: "Conversation cleared."
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


module.exports = {
    chat,
    clearChat
};