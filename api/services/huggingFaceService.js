const OpenAI = require("openai");
const insurancePrompt = require("../prompts/insurancePrompt");

const client = new OpenAI({
    apiKey: process.env.HF_TOKEN,
    baseURL: "https://router.huggingface.co/v1"
});


async function askAI(message, databaseContext = "", ragContext = "", history = [], language = "en") {

    try {

       const messages = [

{
 role:"system",
 content:
 `${insurancePrompt}

Language Rules:

${language === "ar" 
? 
"Reply only in Arabic language. Do not use English."
:
"Reply only in English language."
}

`
}

];

        // Customer Information from Oracle
        if (databaseContext && databaseContext.trim() !== "") {

            messages.push({

                role: "system",

                content: `Customer Information

${databaseContext}

Use this customer information whenever applicable.
If customer information is available, answer using it.
Do not say you cannot access customer information.`

            });

        }

        // RAG Context from PDF documents
        if (ragContext && ragContext.trim() !== "") {

            messages.push({

                role: "system",

                content: `Insurance Documents

${ragContext}

Use ONLY this document information whenever it helps answer the user's insurance question.
If the answer is not present in these documents, say you couldn't find it in the available insurance documents.`

            });

        }

        // Previous Conversation
        if (history && history.length > 0) {

            messages.push(...history);

        }

        // Current User Question
        messages.push({

            role: "user",

            content: message

        });

        const response = await client.chat.completions.create({

            model: process.env.HF_MODEL,

            messages,

            temperature: 0.3,

            max_tokens: 500

        });

        return response.choices[0].message.content.trim();

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

                    content: `You are an AI Intent Classifier for ABC Insurance.

                    Your ONLY job is to classify the user's message.

                    Return ONLY valid JSON.

                    Allowed intents:

                    POLICY
                    CLAIM
                    FAQ
                    INSURANCE_GENERAL
                    OUT_OF_SCOPE

                    Definitions:

                    POLICY
                    - Policy details
                    - Policy status
                    - Policy number
                    - Premium
                    - Sum insured
                    - Coverage
                    - Renewal
                    - Policy benefits

                    CLAIM
                    - Claim status
                    - Claim amount
                    - Claim settlement
                    - Claim approval
                    - Claim rejection
                    - Claim history

                    FAQ
                    - Frequently asked insurance questions
                    - Insurance process
                    - Documents required
                    - Eligibility
                    - Payment methods

                    INSURANCE_GENERAL
                    - General insurance concepts
                    - What is insurance?
                    - What is health insurance?
                    - Difference between life and health insurance
                    - Insurance terminology
                    - Insurance guidance

                    OUT_OF_SCOPE

                    Return OUT_OF_SCOPE for ANY message that is NOT related to insurance.

                    Examples include:

                    - Weather
                    - News
                    - Politics
                    - Religion
                    - Sports
                    - Movies
                    - Music
                    - Celebrities
                    - Programming
                    - Java
                    - Python
                    - SQL
                    - Cooking
                    - Travel
                    - Shopping
                    - Banking
                    - Mathematics
                    - Science
                    - Homework
                    - General knowledge
                    - Jokes
                    - Casual conversation
                    - Greetings with unrelated follow-up
                    - Abusive language
                    - Offensive language
                    - Sensitive topics
                    - Harmful requests
                    - Personal advice
                    - Medical advice
                    - Legal advice
                    - Relationship advice

                    Rules:

                    1. Never invent new intent names.
                    2. Always return exactly one intent.
                    3. Return ONLY JSON.
                    4. Do not explain your reasoning.

                    Example:

                    {
                    "intent":"POLICY",
                    "confidence":0.99
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

            intent: "INSURANCE_GENERAL",

            confidence: 0

        };

    }

}

module.exports = {

    askAI,

    detectIntentAI

};