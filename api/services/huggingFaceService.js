const OpenAI = require("openai");
const insurancePrompt = require("../prompts/insurancePrompt");

const client = new OpenAI({
    apiKey: process.env.HF_TOKEN,
    baseURL: "https://router.huggingface.co/v1"
});



async function askAI(
    message,
    databaseContext = "",
    history = [],
    language = "en"
) {

    try {

        let languageInstruction = "";

        if (language === "ar") {

            languageInstruction =
                "Respond ONLY in Arabic. Do not use English.";

        } else {

            languageInstruction =
                "Respond ONLY in English. Do not use Arabic.";

        }


        const messages = [

            {
                role: "system",
                content: `${insurancePrompt}

                Language Rule:
                ${languageInstruction}
                `
            }

        ];


        // Add customer information only if available
        if (databaseContext) {

            messages.push({

                role: "system",

                content: `
                Customer Information:

                ${databaseContext}

                Use this information whenever required.
                Do not say you cannot access customer information.
                If customer information is available, answer using it.
                If it is not available, politely mention that.
                `

            });

        }


        // Previous conversation
        messages.push(...history);


        const response = await client.chat.completions.create({

            model: process.env.HF_MODEL,

            messages,

            temperature: 0.4,

            max_tokens: 500

        });


        return response.choices[0].message.content;


    }

    catch (err) {

        console.error("AI Error:", err);

        throw new Error("Unable to get AI response.");

    }

}


async function detectIntentAI(userMessage) {

    try {

        const response = await client.chat.completions.create({

            model: process.env.HF_MODEL,

            messages: [

                {

                    role: "system",

                    content: `You are an Insurance Intent Classifier.
                        Return ONLY JSON.
                        Allowed intents:
                        GENERAL
                        POLICY
                        CLAIM
                        FAQ
                        Rules:
                        1. Never create new intent names.
                        2. Ignore spelling mistakes.
                        3. Understand user meaning.
                        4. Always return one of:
                        GENERAL
                        POLICY
                        CLAIM
                        FAQ
                        Example:
                        {
                            "intent":"CLAIM",
                            "confidence":0.98
                        }`
                },

                {

                    role: "user",

                    content: userMessage

                }

            ],

            temperature: 0,

            max_tokens: 50

        });

        const content = response.choices[0].message.content;

        const cleanContent = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(cleanContent);

    }

    catch (err) {

        console.error("Intent Detection Error:", err);

        return {

            intent: "GENERAL",

            confidence: 0

        };

    }

}

module.exports = {

    askAI,

    detectIntentAI

};