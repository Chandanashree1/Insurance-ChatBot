const OpenAI = require("openai");
const insurancePrompt = require("../prompts/insurancePrompt");

const client = new OpenAI({
    apiKey: process.env.HF_TOKEN,
    baseURL: "https://router.huggingface.co/v1"
});

async function askAI(userMessage) {

    try {

        const response = await client.chat.completions.create({

            model: process.env.HF_MODEL,

            messages: [
                {
                    role: "system",
                    content: insurancePrompt
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],

            temperature: 0.7,
            max_tokens: 500

        });

        return response.choices[0].message.content;

    } catch (err) {

        console.log(err);

        throw new Error("Unable to get AI response.");

    }

}

module.exports = { askAI };