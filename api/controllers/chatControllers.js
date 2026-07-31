const PROTECTED_INTENTS = ["POLICY", "CLAIM", "PROFILE", "PAYMENT", "DOWNLOAD_POLICY", "RENEW_POLICY"];
const CHAT_RESPONSES = require("../utils/chatResponses")
const { getPolicy, getClaims, getFAQ } = require("../services/oracleService");
const { askAI } = require("../services/huggingFaceService");
const { detectIntent } = require("../services/intentService");
const { retrieveRelevantChunks } = require("../services/ragService");
const { getHistory, addMessage, clearHistory } = require("../services/conversationservice");
const { startFlow, getFlow, updateFlow, endFlow } = require("../services/claimEligibilityService");
const { startFlow: startBuyPolicyFlow, getFlow: getBuyPolicyFlow, updateFlow: updateBuyPolicyFlow, endFlow: endBuyPolicyFlow } = require("../services/buyPoliceService");

// Centralized bilingual out-of-scope reply
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
    },

    ar: {
        greeting: "👋 مرحباً! أهلاً بك في تأمين ABC.كيف يمكنني مساعدتك اليوم؟",
        thanks: "على الرحب والسعة! 😊",
        goodbye: "شكراً لاختيارك تأمين ABC. نتمنى لك يوماً رائعاً! 👋",
        help: "يمكنني مساعدتك في:\n• تفاصيل الوثيقة\n• حالة المطالبة\n• تجديد الوثيقة\n• الأقساط\n• مستندات المطالبة",
        login: "سأكون سعيدًا بمساعدتك بمعلومات التأمين الشخصي الخاصة بك. الرجاء تسجيل الدخول للمتابعة.",
    }
};
const chat = async (req, res) => {

    try {

        const { message, customerId, loggedIn = true, language } = req.body;
        const t = TEXT[language] || TEXT.en;
        if (!message) {

            return res.status(400).json({
                success: false,
                message: "Message is required"
            });

        }

        const userId = customerId || "guest";
        const buyFlow = getBuyPolicyFlow(userId);

        if (buyFlow) {

            switch (buyFlow.step) {

                case 1:

                    updateBuyPolicyFlow(userId, {
                        policyType: message
                    });

                    return res.json({

                        success: true,

                        uiType: "BUY_POLICY",

                        reply: "Please choose a plan.",

                        actions: [
                            {
                                label: "Basic",
                                action: "PLAN_BASIC"
                            },
                            {
                                label: "Standard",
                                action: "PLAN_STANDARD"
                            },
                            {
                                label: "Premium",
                                action: "PLAN_PREMIUM"
                            }
                        ],

                        data: []

                    });

                case 2:

                    updateBuyPolicyFlow(userId, {
                        plan: message
                    });

                    return res.json({

                        success: true,

                        uiType: "BUY_POLICY",

                        reply: "Please enter your age.",

                        actions: [],

                        data: []

                    });

            }

        }
        // Save latest user message
        addMessage(userId, "user", message);

        // Get updated conversation history
        const history = getHistory(userId);

        // Detect intent
        const intent = await detectIntent(message);
        const lang = language === "ar" ? "ar" : "en";
        const staticResponse = CHAT_RESPONSES[lang][intent];

        if (staticResponse) {

            addMessage(userId, "assistant", staticResponse.reply);

            return res.json({
                success: true,
                ...staticResponse,
                data: []
            });

        }
        // Check whether login is required
        if (PROTECTED_INTENTS.includes(intent) && !loggedIn) {

            return res.json({

                success: true,

                requiresLogin: true,

                uiType: "LOGIN_REQUIRED",

                // reply:"I'd be happy to help with your personal insurance information. Please log in to continue.",
                reply:t.login,
                actions: [
                    {
                        label: "Login",
                        action: "LOGIN"
                    }
                ],

                data: []

            });

        }

        // Handle non-insurance questions
        if (intent === "OUT_OF_SCOPE") {

            const reply = OUT_OF_SCOPE_REPLIES[language] || OUT_OF_SCOPE_REPLIES.en;

            addMessage(userId, "assistant", reply);

            return res.json({
                success: true,
                intent,
                reply,
                data: []
            });

        }

        let databaseContext = "";
        let data = [];

        switch (intent) {
            case "BUY_POLICY":

                startBuyPolicyFlow(userId);

                return res.json({

                    success: true,

                    intent,

                    uiType: "BUY_POLICY",

                    reply: "Which type of insurance would you like to purchase?",

                    actions: [
                        {
                            label: "Health Insurance",
                            action: "BUY_HEALTH"
                        },
                        {
                            label: "Motor Insurance",
                            action: "BUY_MOTOR"
                        },
                        {
                            label: "Travel Insurance",
                            action: "BUY_TRAVEL"
                        }
                    ],

                    data: []

                });

            case "POLICY":

                data = await getPolicy(customerId);

                if (data.length > 0) {

                    const policy = data[0];

                    databaseContext = `
                        Customer Name: ${policy.CUSTOMER_NAME}
                        Email: ${policy.EMAIL}
                        Phone: ${policy.PHONE}
                        City: ${policy.CITY}

                        Policy Number: ${policy.POLICY_NUMBER}
                        Policy Type: ${policy.POLICY_TYPE}
                        Plan Name: ${policy.PLAN_NAME}
                        Premium: ${policy.PREMIUM}
                        Sum Insured: ${policy.SUM_INSURED}
                        Status: ${policy.STATUS}
                        `;
                }

                break;

            case "CLAIM":

                data = await getClaims(customerId);
                databaseContext = JSON.stringify(data, null, 2);
                break;

            case "FAQ":

                data = await getFAQ();
                databaseContext = JSON.stringify(data, null, 2);
                break;

            case "INSURANCE_GENERAL":

            default:

                databaseContext = "";
                break;

        }

        // -------------------------
        // RAG Retrieval
        // -------------------------

        const retrievedChunks = await retrieveRelevantChunks(message);

        const ragContext = retrievedChunks
            .map(chunk => `[${chunk.fileName}]\n${chunk.text}`)
            .join("\n\n");

        // Optional Debug Logs
        console.log("\n========== INTENT ==========");
        console.log(intent);

        console.log("\n========== ORACLE CONTEXT ==========");
        console.log(databaseContext);

        console.log("\n========== RAG CONTEXT ==========");
        console.log(ragContext);

        // Generate AI response
        const aiReply = await askAI(
            message,
            databaseContext,
            ragContext,
            history,
            language
        );

        // Save assistant response
        addMessage(userId, "assistant", aiReply);

        return res.json({

            success: true,

            intent,

            reply: aiReply,

            requiresLogin: false,

            uiType: "TEXT",

            actions: [],

            data

        });

    }

    catch (err) {

        console.error("Chat Controller Error:", err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

const clearChat = (req, res) => {

    try {

        const userId = req.body.customerId || "guest";

        clearHistory(userId);

        res.json({

            success: true,

            message: "Conversation cleared."

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

module.exports = {
    chat,
    clearChat
};