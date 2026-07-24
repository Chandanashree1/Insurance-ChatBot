const { askAI } = require("../services/openRouterServices");

const chat = async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Message is required"
            });
        }

        const aiResponse = await askAI(message);

        res.json({
            success: true,
            reply: aiResponse
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

module.exports = { chat };