// const OpenAI = require("openai");
// const insurancePrompt = require("../prompts/insurancePrompt");

// const client = new OpenAI({
//     apiKey: process.env.HF_TOKEN,
//     baseURL: "https://router.huggingface.co/v1"
// });
const axios = require("axios");
const insurancePrompt = require("../prompts/insurancePrompt");

async function callLLM(messages) {

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

    return response.data.message.content;
    // console.log("LLM URL:", process.env.LLM_API_URL);

}
async function askAI(message, databaseContext = "", ragContext = "", history = [], language = "en") {

    try {

        const messages = [

            {
                role: "system",
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

        // const response = await client.chat.completions.create({

        //     model: process.env.HF_MODEL,

        //     messages,

        //     temperature: 0.3,

        //     max_tokens: 500

        // });

        // return response.choices[0].message.content.trim();
        return await callLLM(messages);
        console.log("===== Messages Sent to LLM =====");
        console.log(JSON.stringify(messages, null, 2));
    }

    catch (err) {

        console.error("AI Error:", err);

        throw new Error("Unable to get AI response.");

    }

}


async function detectIntentAI(userMessage) {

    try {

        // const response = await client.chat.completions.create({

        //     model: process.env.HF_MODEL,

        //     messages: [

        //         {

        //             role: "system",

        //             content: `You are an AI Intent Classifier for ABC Insurance.

        //             Your ONLY job is to classify the user's message.

        //             Return ONLY valid JSON.

        //             Allowed intents:

        //             GREETING
        //             THANKS
        //             GOODBYE
        //             HELP

        //             POLICY
        //             CLAIM
        //             CLAIM_ELIGIBILITY
        //             CLAIM_DOCUMENTS
        //             RENEW_POLICY
        //             BUY_POLICY
        //             PREMIUM
        //             PAYMENT

        //             FAQ
        //             INSURANCE_GENERAL

        //             OUT_OF_SCOPE

        //             Definitions:

        //             GREETING
        //             - hi
        //             - hello
        //             - good morning
        //             - good evening

        //             THANKS
        //             - thanks
        //             - thank you
        //             - appreciate it

        //             GOODBYE
        //             - bye
        //             - goodbye
        //             - see you later

        //             HELP
        //             - help
        //             - what can you do
        //             - assist me

        //             POLICY
        //             User wants:
        //             - my policy
        //             - policy details
        //             - policy status
        //             - policy number
        //             - coverage
        //             - benefits
        //             - renewal date

        //             CLAIM
        //             User wants:
        //             - claim status
        //             - track my claim
        //             - existing claim
        //             - claim amount
        //             - claim history
        //             - claim approval
        //             - claim rejection

        //             CLAIM_ELIGIBILITY
        //             User wants to know whether something is covered or whether they can make a claim.

        //             Examples:
        //             - Can I claim?
        //             - Am I eligible?
        //             - Will insurance cover this?
        //             - Can I claim for surgery?
        //             - Can I claim after hospitalization?
        //             - Can I claim for an accident?
        //             - Will my insurance pay?
        //             - Is my treatment covered?
        //             - Is this covered under my policy?
        //             - Can I get reimbursement?

        //             CLAIM_DOCUMENTS
        //             User asks about documents.

        //             Examples:
        //             - What documents do I need?
        //             - Required documents
        //             - Documents for claim
        //             - Claim checklist
        //             - What should I upload?

        //             RENEW_POLICY
        //             User wants to renew an existing policy.

        //             BUY_POLICY
        //             User wants to purchase insurance.

        //             Examples:
        //             - Buy insurance
        //             - New policy
        //             - Purchase health insurance
        //             - Suggest a policy

        //             PREMIUM
        //             Questions about premium.

        //             Examples:
        //             - Premium amount
        //             - EMI
        //             - Monthly payment
        //             - Policy cost

        //             PAYMENT
        //             Payment related.

        //             Examples:
        //             - Pay premium
        //             - Payment failed
        //             - Payment status
        //             - Payment receipt

        //             FAQ
        //             General insurance FAQs.

        //             Examples:
        //             - How long does claim approval take?
        //             - How can I contact customer support?
        //             - What is the waiting period?

        //             INSURANCE_GENERAL
        //             General insurance education.

        //             Examples:
        //             - What is insurance?
        //             - Difference between health and life insurance.
        //             - Explain deductible.
        //             - Explain co-payment.

        //             OUT_OF_SCOPE

        //             Return OUT_OF_SCOPE for ANY message that is NOT related to insurance.

        //             Examples include:

        //             - Weather
        //             - News
        //             - Politics
        //             - Religion
        //             - Sports
        //             - Movies
        //             - Music
        //             - Celebrities
        //             - Programming
        //             - Java
        //             - Python
        //             - SQL
        //             - Cooking
        //             - Travel
        //             - Shopping
        //             - Banking
        //             - Mathematics
        //             - Science
        //             - Homework
        //             - General knowledge
        //             - Jokes
        //             - Casual conversation
        //             - Greetings with unrelated follow-up
        //             - Abusive language
        //             - Offensive language
        //             - Sensitive topics
        //             - Harmful requests
        //             - Personal advice
        //             - Medical advice
        //             - Legal advice
        //             - Relationship advice

        //             Rules:

        //             1. Never invent new intent names.
        //             2. Always return exactly one intent.
        //             3. Return ONLY JSON.
        //             4. Do not explain your reasoning.

        //             Example:

        //             {
        //             "intent":"POLICY",
        //             "confidence":0.99
        //             }
        //             User: Show my policy
        //             Output:
        //             {"intent":"POLICY","confidence":0.99}

        //             User: Track my claim
        //             Output:
        //             {"intent":"CLAIM","confidence":0.99}

        //             User: Can I claim for surgery?
        //             Output:
        //             {"intent":"CLAIM_ELIGIBILITY","confidence":0.99}

        //             User: What documents are required for a claim?
        //             Output:
        //             {"intent":"CLAIM_DOCUMENTS","confidence":0.99}

        //             User: Renew my policy
        //             Output:
        //             {"intent":"RENEW_POLICY","confidence":0.99}

        //             User: My payment failed
        //             Output:
        //             {"intent":"PAYMENT","confidence":0.99}`
        //         },

        //         {

        //             role: "user",

        //             content: userMessage

        //         }

        //     ],

        //     temperature: 0,

        //     max_tokens: 50

        // });

        // const content = response.choices[0].message.content;
        const content = await callLLM([
            {
                role: "system",
                content: `You are an AI Intent Classifier for ABC Insurance.

                    Your ONLY job is to classify the user's message.

                    Return ONLY valid JSON.

                    Allowed intents:

                    GREETING
                    THANKS
                    GOODBYE
                    HELP

                    POLICY
                    CLAIM
                    CLAIM_ELIGIBILITY
                    CLAIM_DOCUMENTS
                    RENEW_POLICY
                    BUY_POLICY
                    PREMIUM
                    PAYMENT

                    FAQ
                    INSURANCE_GENERAL

                    OUT_OF_SCOPE

                    Definitions:

                    GREETING
                    - hi
                    - hello
                    - good morning
                    - good evening

                    THANKS
                    - thanks
                    - thank you
                    - appreciate it

                    GOODBYE
                    - bye
                    - goodbye
                    - see you later

                    HELP
                    - help
                    - what can you do
                    - assist me

                    POLICY
                    User wants:
                    - my policy
                    - policy details
                    - policy status
                    - policy number
                    - coverage
                    - benefits
                    - renewal date

                    CLAIM
                    User wants:
                    - claim status
                    - track my claim
                    - existing claim
                    - claim amount
                    - claim history
                    - claim approval
                    - claim rejection

                    CLAIM_ELIGIBILITY
                    User wants to know whether something is covered or whether they can make a claim.

                    Examples:
                    - Can I claim?
                    - Am I eligible?
                    - Will insurance cover this?
                    - Can I claim for surgery?
                    - Can I claim after hospitalization?
                    - Can I claim for an accident?
                    - Will my insurance pay?
                    - Is my treatment covered?
                    - Is this covered under my policy?
                    - Can I get reimbursement?

                    CLAIM_DOCUMENTS
                    User asks about documents.

                    Examples:
                    - What documents do I need?
                    - Required documents
                    - Documents for claim
                    - Claim checklist
                    - What should I upload?

                    RENEW_POLICY
                    User wants to renew an existing policy.

                    BUY_POLICY
                    User wants to purchase insurance.

                    Examples:
                    - Buy insurance
                    - New policy
                    - Purchase health insurance
                    - Suggest a policy

                    PREMIUM
                    Questions about premium.

                    Examples:
                    - Premium amount
                    - EMI
                    - Monthly payment
                    - Policy cost

                    PAYMENT
                    Payment related.

                    Examples:
                    - Pay premium
                    - Payment failed
                    - Payment status
                    - Payment receipt

                    FAQ
                    General insurance FAQs.

                    Examples:
                    - How long does claim approval take?
                    - How can I contact customer support?
                    - What is the waiting period?

                    INSURANCE_GENERAL
                    General insurance education.

                    Examples:
                    - What is insurance?
                    - Difference between health and life insurance.
                    - Explain deductible.
                    - Explain co-payment.

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
                    }
                    User: Show my policy
                    Output:
                    {"intent":"POLICY","confidence":0.99}

                    User: Track my claim
                    Output:
                    {"intent":"CLAIM","confidence":0.99}

                    User: Can I claim for surgery?
                    Output:
                    {"intent":"CLAIM_ELIGIBILITY","confidence":0.99}

                    User: What documents are required for a claim?
                    Output:
                    {"intent":"CLAIM_DOCUMENTS","confidence":0.99}

                    User: Renew my policy
                    Output:
                    {"intent":"RENEW_POLICY","confidence":0.99}

                    User: My payment failed
                    Output:
                    {"intent":"PAYMENT","confidence":0.99}`
            },
            {
                role: "user",
                content: userMessage
            }
        ]);
        const cleanContent = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(cleanContent);

    }

    catch (err) {
        console.error("Intent Detection Error:", err);

        // Temporary fallback while AI service is unavailable
        const text = userMessage.toLowerCase();

        if (
            text.includes("claim") &&
            (text.includes("eligible") ||
                text.includes("eligibility") ||
                text.includes("surgery") ||
                text.includes("hospital") ||
                text.includes("accident"))
        ) {
            return {
                intent: "CLAIM_ELIGIBILITY",
                confidence: 1
            };
        }

        return {
            intent: "OUT_OF_SCOPE",
            confidence: 0
        };
    }

}

module.exports = {

    askAI,

    detectIntentAI

};