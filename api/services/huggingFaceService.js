const axios = require("axios");
const { callLLM } = require("./llmService");
const insurancePrompt = require("../prompts/insurancePrompt");


/*
|--------------------------------------------------------------------------
| GENERAL AI RESPONSE
|--------------------------------------------------------------------------
*/

async function askAI(
    message,
    databaseContext = "",
    ragContext = "",
    history = [],
    language = "en"
) {

    try {

        const languageInstruction =
            language === "ar"
                ? `
Respond entirely in Arabic.

Do not mix Arabic with English unless:
- a proper name requires it
- a policy number requires it
- a vehicle number requires it
- a technical value cannot reasonably be translated.

All explanations must be Arabic.
`
                : `
Respond entirely in English.
Do not switch to Arabic or another language.
`;

        const conversationContext =
            history && history.length > 0
                ? history
                : [];

        const messages = [

            {
                role: "system",

                content: `
${languageInstruction}

${insurancePrompt}

==================================================
CONVERSATIONAL INSURANCE ASSISTANT
==================================================

You are not a menu-driven bot.

Your job is to have a natural conversation with the customer.

IMPORTANT:

Do NOT immediately present insurance product options simply because
the customer mentions:

- insurance
- policy
- buying insurance
- getting insurance
- family insurance
- vehicle insurance
- protection
- coverage

First understand what the customer actually wants.

--------------------------------------------------
CONVERSATION EXAMPLES
--------------------------------------------------

Example 1:

User:
"I am thinking about getting insurance for my family of 5.
What would be suitable?"

Good response:

"Absolutely. I can help you understand what type of coverage
might suit your family. Could you tell me whether you're mainly
looking for medical/health coverage, financial protection for
your family, or something else?"

Do NOT immediately display:

Health
Travel
Motor
Life

--------------------------------------------------

Example 2:

User:
"I want insurance for my family."

Continue the conversation naturally.

Ask a useful clarification question.

Do not immediately start an application.

--------------------------------------------------

Example 3:

User:
"I need insurance for my car."

Now the user has clearly indicated MOTOR insurance.

You may acknowledge that and move toward the motor quotation flow.

--------------------------------------------------

Example 4:

User:
"I want to get a motor insurance quote."

This is a clear purchase/quote request.

The application/quote flow can now be started.

--------------------------------------------------

Example 5:

User:
"Can you explain the difference between health and life
insurance?"

This is an educational question.

Explain the difference.

Do NOT start a purchase flow.

--------------------------------------------------

Example 6:

User:
"Which insurance is best for my family?"

This is advice-seeking.

Have a conversation and ask relevant questions.

Do NOT automatically display product buttons.

--------------------------------------------------
PURCHASE INTENT
--------------------------------------------------

Only consider the customer ready for a purchase flow when the
customer clearly indicates an intention such as:

- wants to get a quote
- wants to apply
- wants to purchase a specific insurance
- wants to buy a specific insurance
- wants to start an application
- wants coverage for a specific asset/person and clearly wants
  to proceed

A vague statement about insurance is NOT enough.

--------------------------------------------------
CONTEXT
--------------------------------------------------

Always use previous conversation messages.

For example:

User:
"I need insurance for my family."

Assistant:
"What kind of protection are you looking for?"

User:
"Mostly medical expenses."

The second message should be interpreted together with the first.

Do not treat the second message as an unrelated question.

--------------------------------------------------
PERSONAL INFORMATION
--------------------------------------------------

If customer information is provided, use it when relevant.

Never invent customer information.

--------------------------------------------------
DATABASE INFORMATION
--------------------------------------------------

If database information is provided, use it as the source of truth
for customer-specific information.

--------------------------------------------------
RAG INFORMATION
--------------------------------------------------

If insurance documents are provided, use them for policy,
coverage, exclusions, claims, renewal and product explanations.

Never invent information that is not available.

--------------------------------------------------
OUT OF SCOPE
--------------------------------------------------

If the user asks something unrelated to insurance, politely explain
that you can only help with insurance-related matters.

--------------------------------------------------
STYLE
--------------------------------------------------

Be:

- conversational
- friendly
- professional
- concise
- helpful

Do not sound like a rigid menu.

Do not repeatedly ask the same question.

Do not dump all insurance products unless the customer specifically
asks what products are available.

`
            }

        ];


        /*
        |--------------------------------------------------------------------------
        | CUSTOMER DATABASE CONTEXT
        |--------------------------------------------------------------------------
        */

        if (databaseContext && databaseContext.trim()) {

            messages.push({

                role: "system",

                content: `
CUSTOMER INFORMATION:

${databaseContext}

Use this information when relevant.

Never say that customer information is unavailable when it has
actually been provided.

Respond in ${language === "ar" ? "Arabic" : "English"}.
`
            });
        }


        /*
        |--------------------------------------------------------------------------
        | RAG DOCUMENT CONTEXT
        |--------------------------------------------------------------------------
        */

        if (ragContext && ragContext.trim()) {

            messages.push({

                role: "system",

                content: `
INSURANCE DOCUMENT INFORMATION:

${ragContext}

Use this information when it is relevant to the customer's
question.

Do not invent information outside these documents when answering
document-specific questions.

Respond in ${language === "ar" ? "Arabic" : "English"}.
`
            });
        }


        /*
        |--------------------------------------------------------------------------
        | PREVIOUS CONVERSATION
        |--------------------------------------------------------------------------
        */

        if (conversationContext.length > 0) {

            messages.push({

                role: "system",

                content: `
PREVIOUS CONVERSATION:

Use the previous conversation to understand the customer's
current intent and context.

Do not repeat questions that the customer has already answered.
`
            });

            messages.push(...conversationContext);
        }


        /*
        |--------------------------------------------------------------------------
        | CURRENT USER MESSAGE
        |--------------------------------------------------------------------------
        */

        messages.push({

            role: "user",

            content: message

        });


        const result = await callLLM(messages);

        return result.trim();

    } catch (error) {

        console.error("AI Response Error:", error);

        throw new Error("Unable to get AI response.");

    }
}
/*
|--------------------------------------------------------------------------
| AI ANALYZE THE FEEDBACK
|--------------------------------------------------------------------------
*/
async function analyzeFeedback(rating, feedback) {
    const content = await callLLM([
        {
            role: "system",
            content: `
You are an AI customer feedback analyzer for ABC Insurance.

Analyze the customer's rating and feedback.

Return ONLY valid JSON.

Rules:

1. If feedback is negative, dissatisfied, unhappy,
   disappointed, frustrated, poor service, issue,
   problem, not satisfied, or similar:

{
    "followUpRequired": true,
    "sentiment": "NEGATIVE"
}

2. If feedback is positive, satisfied, happy, good,
   excellent, resolved, thank you, or similar:

{
    "followUpRequired": false,
    "sentiment": "POSITIVE"
}

3. Rating alone must NOT determine follow-up
   when feedback is available.

4. Even 4 or 5 stars can require follow-up if
   feedback is negative.

5. If feedback is empty:
   - Rating 1 or 2 = followUpRequired true
   - Rating 3, 4 or 5 = followUpRequired false

Return ONLY JSON.
`
        },
        {
            role: "user",
            content: JSON.stringify({
                rating,
                feedback
            })
        }
    ]);

    const cleanContent = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    return JSON.parse(cleanContent);
}

/*
|--------------------------------------------------------------------------
| AI INTENT DETECTION
|--------------------------------------------------------------------------
*/

async function detectIntentAI(userMessage, history = []) {

    try {

        const intentPrompt = `
You are the intent understanding engine for ABC Insurance.

Your job is to understand the customer's CURRENT intention.

You MUST consider the conversation history.

Do not rely only on exact keywords.

Understand natural language, paraphrasing, incomplete sentences,
indirect requests, advanced wording and conversational context.

==================================================
ALLOWED INTENTS
==================================================

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

==================================================
IMPORTANT BUY POLICY RULE
==================================================

BUY_POLICY should ONLY be returned when the customer is clearly
ready to purchase, apply for, or obtain a quote for insurance.

Do NOT return BUY_POLICY for general discussion or advice.

Examples:

"I am thinking about getting insurance for my family."

=> INSURANCE_GENERAL

"Which insurance would be suitable for my family?"

=> INSURANCE_GENERAL

"Can you explain health and life insurance?"

=> INSURANCE_GENERAL

"I am interested in insurance for my family."

=> INSURANCE_GENERAL

"I want to understand what insurance I should get."

=> INSURANCE_GENERAL

"I want health insurance for my family."

=> BUY_POLICY

"I want to buy motor insurance."

=> BUY_POLICY

"I need a quote for my car."

=> BUY_POLICY

"I want to apply for motor insurance."

=> BUY_POLICY

"How much will motor insurance cost?"

=> BUY_POLICY

==================================================
CONVERSATIONAL CONTEXT
==================================================

The same sentence can have different meanings depending on the
previous conversation.

Example:

Assistant:
"What type of insurance are you interested in?"

User:
"Something for my car."

=> BUY_POLICY

But:

User:
"What types of insurance do you offer?"

=> INSURANCE_GENERAL

==================================================
POLICY
==================================================

Use POLICY when the customer asks about an existing policy.

Examples:

"Show my policy."

"What is my policy number?"

"Is my policy active?"

"When does my policy expire?"

==================================================
CLAIM
==================================================

Use CLAIM for an existing claim.

Examples:

"Track my claim."

"What is my claim status?"

"Show my claim."

==================================================
CLAIM_ELIGIBILITY
==================================================

Use CLAIM_ELIGIBILITY when asking whether something is covered
or whether they can make a claim.

Examples:

"Can I claim for an accident?"

"Will insurance cover surgery?"

"Is this covered?"

==================================================
CLAIM_DOCUMENTS
==================================================

Use CLAIM_DOCUMENTS when asking what documents are required
for a claim.

==================================================
RENEW_POLICY
==================================================

Use RENEW_POLICY when the customer wants to renew an existing
policy.

==================================================
PREMIUM
==================================================

Use PREMIUM for questions specifically about premium/cost when
there is no clear new-policy purchase action.

==================================================
PAYMENT
==================================================

Use PAYMENT for payment status, payment failure, receipts,
or paying an existing premium.

==================================================
FAQ
==================================================

Use FAQ for common insurance questions.

==================================================
INSURANCE_GENERAL
==================================================

Use INSURANCE_GENERAL for insurance education, comparison,
recommendations, general discussion, and advice.

==================================================
OUT_OF_SCOPE
==================================================

Use OUT_OF_SCOPE when the request is unrelated to insurance.

==================================================
RULES
==================================================

1. Return exactly ONE intent.

2. Never create a new intent.

3. Return ONLY valid JSON.

4. Include confidence from 0 to 1.

5. Consider previous conversation.

6. Do not classify every mention of "insurance" as BUY_POLICY.

7. Advice/discussion = INSURANCE_GENERAL.

8. Clear purchase/quote/application request = BUY_POLICY.

9. Existing customer policy questions = POLICY.

10. Existing claims = CLAIM.

==================================================
OUTPUT
==================================================

Return exactly:

{
  "intent": "INTENT_NAME",
  "confidence": 0.95
}
`;


        const messages = [

            {
                role: "system",
                content: intentPrompt
            }

        ];


        /*
        |--------------------------------------------------------------------------
        | ADD HISTORY FOR CONTEXT
        |--------------------------------------------------------------------------
        */

        if (history && history.length > 0) {

            messages.push({

                role: "system",

                content: `
PREVIOUS CONVERSATION:

${history
    .map(item => `${item.role}: ${item.content}`)
    .join("\n")}
`
            });

        }


        /*
        |--------------------------------------------------------------------------
        | CURRENT MESSAGE
        |--------------------------------------------------------------------------
        */

        messages.push({

            role: "user",

            content: userMessage

        });


        const content = await callLLM(messages);


        /*
        |--------------------------------------------------------------------------
        | CLEAN JSON
        |--------------------------------------------------------------------------
        */

        let cleanContent = content
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();


        /*
        |--------------------------------------------------------------------------
        | HANDLE EXTRA TEXT AROUND JSON
        |--------------------------------------------------------------------------
        */

        const jsonStart = cleanContent.indexOf("{");
        const jsonEnd = cleanContent.lastIndexOf("}");

        if (jsonStart !== -1 && jsonEnd !== -1) {

            cleanContent =
                cleanContent.substring(
                    jsonStart,
                    jsonEnd + 1
                );

        }


        const result = JSON.parse(cleanContent);


        /*
        |--------------------------------------------------------------------------
        | VALIDATE INTENT
        |--------------------------------------------------------------------------
        */

        const allowedIntents = [

            "GREETING",
            "THANKS",
            "GOODBYE",
            "HELP",

            "POLICY",
            "CLAIM",
            "CLAIM_ELIGIBILITY",
            "CLAIM_DOCUMENTS",

            "RENEW_POLICY",
            "BUY_POLICY",

            "PREMIUM",
            "PAYMENT",

            "FAQ",
            "INSURANCE_GENERAL",

            "OUT_OF_SCOPE"

        ];


        if (!allowedIntents.includes(result.intent)) {

            return {

                intent: "INSURANCE_GENERAL",

                confidence: 0.5

            };

        }


        return {

            intent: result.intent,

            confidence:
                typeof result.confidence === "number"
                    ? result.confidence
                    : 0.8

        };


    } catch (error) {

        console.error(
            "Intent Detection Error:",
            error.response?.data || error.message
        );


        /*
        |--------------------------------------------------------------------------
        | SAFE FALLBACK
        |--------------------------------------------------------------------------
        */

        return {

            intent: "INSURANCE_GENERAL",

            confidence: 0.3

        };

    }

}


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {

    askAI,

    detectIntentAI,
    
    analyzeFeedback

};