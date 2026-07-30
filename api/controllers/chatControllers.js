const PROTECTED_INTENTS = ["POLICY", "CLAIM", "PROFILE", "PAYMENT", "DOWNLOAD_POLICY", "RENEW_POLICY"];
const { getPolicy, getClaims, getFAQ } = require("../services/oracleService");
const { askAI } = require("../services/huggingFaceService");
const { detectIntent } = require("../services/intentService");
const { retrieveRelevantChunks } = require("../services/ragService");
const {
    getHistory,
    addMessage,
    clearHistory
} = require("../services/conversationservice");

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

        // Save latest user message
        addMessage(userId, "user", message);

        // Get updated conversation history
        const history = getHistory(userId);

        // Detect intent
        const intent = await detectIntent(message);
        switch (intent) {

            case "GREETING":

                return res.json({

                    success: true,

                    // reply: "👋 Hello! Welcome to ABC Insurance.\n\nHow can I assist you today?",
                    reply: t.greeting,

                    uiType: "GREETING",

                    actions: [
                        {
                            label: "📄 My Policy",
                            action: "POLICY"
                        },
                        {
                            label: "📋 Claim Status",
                            action: "CLAIM"
                        },
                        {
                            label: "🔄 Renew Policy",
                            action: "RENEW_POLICY"
                        },
                        {
                            label: "📑 Claim Documents",
                            action: "CLAIM_DOCUMENTS"
                        }
                    ]

                });

            case "THANKS":

                return res.json({

                    success: true,

                    // reply: "You're welcome! 😊",
                    reply: t.thanks,

                    uiType: "TEXT"

                });

            case "GOODBYE":

                return res.json({

                    success: true,

                    // reply: "Thank you for choosing ABC Insurance. Have a wonderful day! 👋",
                    reply: t.goodbye,

                    uiType: "TEXT"

                });

            case "HELP":

                return res.json({

                    success: true,

                    // reply: "I can help you with:\n• Policy Details\n• Claim Status\n• Renewals\n• Premiums\n• Claim Documents",
                    reply: t.help,
                    uiType: "HELP"

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