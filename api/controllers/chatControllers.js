const { getPolicy, getClaims, getFAQ } = require("../services/oracleService");
const { askAI } = require("../services/huggingFaceService");
const { detectIntent } = require("../services/intentService");
const { getHistory, addMessage, clearHistory } = require("../services/conversationservice");

const chat = async (req, res) => {

    try {

        const { message, customerId , language } = req.body;

        if (!message) {

            return res.status(400).json({
                success: false,
                message: "Message is required"
            });

        }

        const userId = customerId || "guest";

        const history = getHistory(userId);

        // Save user message
        addMessage(userId, "user", message);

        // Detect Intent
        const intent = await detectIntent(message);

        let databaseContext = "";
        let data = [];

        switch (intent) {

            case "POLICY":

                data = await getPolicy(customerId);

                databaseContext = JSON.stringify(data);

                break;

            case "CLAIM":

                data = await getClaims(customerId);

                databaseContext = JSON.stringify(data);

                break;

            case "FAQ":

                data = await getFAQ();

                databaseContext = JSON.stringify(data);

                break;

            case "GENERAL":

            default:

                databaseContext = "";

                break;

        }

        const aiReply = await askAI(
            message,
            databaseContext,
            history,
             language
        );

        // Save AI reply
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

module.exports = { chat, clearChat };