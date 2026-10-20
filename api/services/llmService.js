const axios = require("axios");

async function callLLM(messages) {
    try {
        const body = {
            model: process.env.LLM_MODEL || "qwen2.5:7b",
            messages,
            stream: false
        };

        // Optional, only sent when set in .env (Ollama request options):
        //   LLM_KEEP_ALIVE=30m   keep the model loaded after a request,
        //                        so the first message after an idle
        //                        period doesn't pay the model load time.
        //   LLM_NUM_PREDICT=512  cap the reply length, which bounds how
        //                        long one generation can run.
        if (process.env.LLM_KEEP_ALIVE) {
            body.keep_alive = process.env.LLM_KEEP_ALIVE;
        }

        const numPredict = Number(process.env.LLM_NUM_PREDICT);

        if (Number.isFinite(numPredict) && numPredict > 0) {
            body.options = { num_predict: numPredict };
        }

        const response = await axios.post(
            process.env.LLM_API_URL,
            body,
            {
                headers: {
                    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 120000
            }
        );

        // OpenAI-compatible response
        if (response.data?.choices?.[0]?.message?.content) {
            return response.data.choices[0].message.content.trim();
        }

        // Ollama response format
        if (response.data?.message?.content) {
            return response.data.message.content.trim();
        }

        console.error("Unexpected LLM response:", response.data);
        throw new Error("Invalid LLM response format");

    } catch (error) {
        console.error(
            "LLM Error:",
            error.response?.data || error.message
        );

        throw new Error("Unable to get AI response.");
    }
}

module.exports = { callLLM };