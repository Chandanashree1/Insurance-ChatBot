const { getPolicy, getClaims, getFAQ } = require("../services/oracleService");
const { askAI } = require("../services/huggingFaceService");
const { detectIntent } = require("../services/intentService");
const { retrieveRelevantChunks } = require("../services/ragService");
const {
    getHistory,
    addMessage,
    clearHistory
} = require("../services/conversationservice");

const chat = async (req, res) => {

    try {

        const { message, customerId } = req.body;

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

        // Handle non-insurance questions
        if (intent === "OUT_OF_SCOPE") {

            const reply =
                "I am ABC Insurance's virtual assistant and can only assist with insurance-related queries.";

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
            history
        );

        // Save assistant response
        addMessage(userId, "assistant", aiReply);

        return res.json({

            success: true,

            intent,

            reply: aiReply,

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