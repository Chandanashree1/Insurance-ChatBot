const axios = require("axios");
const insurancePrompt = require("../prompts/insurancePrompt");

async function askAI(userMessage) {

    try {

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "poolside/laguna-s-2.1:free",

                messages: [
                    {
                        role: "system",
                        content: insurancePrompt
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data.choices[0].message.content;

    } catch (error) {

        console.log(error.response?.data || error.message);

        throw new Error("Unable to get AI response.");

    }

}

module.exports = { askAI };