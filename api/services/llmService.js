const axios = require("axios");

async function callLLM(messages) {
    try {
        const response = await axios.post(
            process.env.LLM_API_URL,
            {
                model: process.env.LLM_MODEL,
                messages,
                stream: false
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // Support common OpenAI-compatible response formats
        if (response.data?.choices?.[0]?.message?.content) {
            return response.data.choices[0].message.content.trim();
        }

        if (response.data?.message?.content) {
            return response.data.message.content.trim();
        }

        throw new Error("Invalid LLM response format");

    } catch (error) {
        console.error(
            "LLM Error:",
            error.response?.data || error.message
        );

        throw new Error("Unable to get AI response.");
    }
}

module.exports = {
    callLLM
};