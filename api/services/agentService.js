const { callLLM } = require("./llmService");
const {
    getPolicyByNumber,
    getQuoteByNumber,
    getQuoteOptions,
    getSelectedQuoteOption
} = require("./oracleservice");
const { retrieveRelevantChunks } = require("./ragService");
const { startPurchaseFlow, updatePurchaseFlow } = require("./purchaseFlowService");
const { getProposalByQuoteId } = require("./underwritingService");
const { getClaimByNumber } = require("./Claimservice");


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/*
 * The LLM host has occasionally returned a transient 5xx/gateway
 * timeout (e.g. Cloudflare 504) on a call that otherwise would
 * have succeeded. One short, silent retry absorbs that without
 * making the customer see an error for a blip that self-resolves.
 */
async function callLLMWithRetry(messages) {

    try {
        return await callLLM(messages);
    } catch (firstError) {

        console.warn(
            "Agent LLM call failed, retrying once:",
            firstError.message
        );

        await sleep(1000);

        return await callLLM(messages);

    }

}

/*
=========================================================
POLICY STATUS AGENT
=========================================================

Unlike the purchase flow (LLM extracts, backend decides),
this agent is intentionally allowed to decide WHICH tool to
call and WHEN, and can chain multiple calls before answering.
That's safe here because:

  1. Every tool is either read-only, or - for
     resumeIncompleteQuote - only re-seeds in-memory purchase
     flow state (collectedData) using values pulled straight
     from the customer's own DB row. No tool here ever selects
     an option, takes payment, or creates a policy; those still
     only happen through the existing deterministic
     handlePurchaseFlow once the customer confirms.
  2. getPolicyDetails / getQuoteDetails / resumeIncompleteQuote
     are all scoped server-side to the logged-in customerId, so
     the agent cannot be steered into touching someone else's
     policy or quote.

This must NOT be extended with a tool that writes payment or
policy data directly.
=========================================================
*/


const MAX_AGENT_STEPS = 4;


/*
=========================================================
AWAITING-CONFIRMATION STATE
=========================================================

Every message is intent-classified on its own, so a bare "yes"
after the agent asked "Would you like to continue?" looks like
BUY_POLICY and never reaches the agent. When a turn ends with the
agent waiting for the customer's answer, we remember that here so
the controller can route the very next short reply back to the
agent. It is one-shot and expires, so it can't hijack later,
unrelated messages.
=========================================================
*/

const AWAITING_TTL_MS = 10 * 60 * 1000;

const awaitingConfirmation = new Map();

function setAgentAwaiting(userId, awaiting) {

    if (awaiting) {
        awaitingConfirmation.set(userId, Date.now());
    } else {
        awaitingConfirmation.delete(userId);
    }

}

function isAgentAwaiting(userId) {

    const startedAt = awaitingConfirmation.get(userId);

    if (!startedAt) {
        return false;
    }

    if (Date.now() - startedAt > AWAITING_TTL_MS) {
        awaitingConfirmation.delete(userId);
        return false;
    }

    return true;

}


/*
=========================================================
TOOL DEFINITIONS
=========================================================
*/

const TOOLS = {

    getPolicyDetails: {
        description:
            "Look up the logged-in customer's own policy by policy number. Returns null if no such policy exists for this customer.",
        parameters: {
            policyNumber:
                "string - the policy number, e.g. POL-1234567890-1234"
        }
    },

    searchPolicyTerms: {
        description:
            "Search insurance terms & conditions / coverage documents for clauses relevant to a question.",
        parameters: {
            productType:
                "string - MOTOR, HEALTH, TRAVEL, LIFE, or UNKNOWN if not known",
            query:
                "string - what the customer wants to know, e.g. 'windshield damage coverage'"
        }
    },

    getQuoteDetails: {
        description:
            "Look up the logged-in customer's own quote by quote number (not yet a policy). Returns its product, vehicle, premium options, and payment status. Returns null if no such quote exists for this customer.",
        parameters: {
            quoteNumber:
                "string - the quote number, e.g. QT-2026-00101"
        }
    },

    getClaimStatus: {
        description:
            "Look up the logged-in customer's own claim by claim number. Returns its status (STP_APPROVED, PENDING, APPROVED, DECLINED), amount, and adjuster note if any. Returns null if no such claim exists for this customer.",
        parameters: {
            claimNumber:
                "string - the claim number, e.g. CLM-2026-00012"
        }
    },

    resumeIncompleteQuote: {
        description:
            "Re-open an unpaid quote so the customer can pick an option and/or pay. Only call this AFTER getQuoteDetails has confirmed the quote exists and is not yet paid, and the customer has said they want to continue/complete/pay for it. Do not call this for quotes that are already paid.",
        parameters: {
            quoteNumber:
                "string - the quote number to resume, e.g. QT-2026-00101"
        }
    }

};


function buildToolsDescription() {

    return Object.entries(TOOLS)
        .map(([name, tool]) =>
            `- ${name}(${JSON.stringify(tool.parameters)}): ${tool.description}`
        )
        .join("\n");

}


/*
=========================================================
SYSTEM PROMPT
=========================================================
*/

function buildAgentSystemPrompt(language) {

    const languageRule =
        language === "ar"
            ? `The "reply" field in your final answer must be entirely in Arabic.`
            : `The "reply" field in your final answer must be entirely in English.`;

    return `
You are ABC Insurance's policy assistant agent.

You help the currently logged-in customer understand the status
and terms of their OWN policies, in-progress quotes, and claims.
You do
not have any other capability.

==================================================
AVAILABLE TOOLS
==================================================

${buildToolsDescription()}

==================================================
RULES
==================================================

1. You do NOT have direct database or document access. The
   only way to get real information is to request a tool call.

2. Never invent policy details, dates, premiums, coverage terms,
   or numbers. If a tool has not returned it, you do not have it.

3. Only ever look up the policy number the customer themselves
   provided in this conversation. Never ask for, accept, or act
   on a policy number as belonging to someone else.

4. If getPolicyDetails returns null, tell the customer you
   couldn't find a policy with that number under their account.
   Do not guess or retry with a different number you were not
   given.

5. A number starting with "POL-" is a policy number; a number
   starting with "QT-" is a quote number (an in-progress
   purchase that has not become a policy yet); a number starting
   with "CLM-" is a claim number. If a lookup with the wrong tool
   fails, try another matching tool before telling the customer
   nothing was found.

6. getQuoteDetails may return a "proposal" - this means the quote
   was escalated to underwriting (KYC failure, high value, etc).
   Check its status before saying anything about continuing or
   paying:
     - No proposal at all, or proposal.status is "APPROVED": the
       quote is a normal in-progress purchase. If paymentStatus
       is not "PAID", tell the customer it's still incomplete and
       ask if they'd like to continue/complete it. Only call
       resumeIncompleteQuote after they confirm - never resume a
       quote the customer hasn't asked to continue, and never on
       a quote that is already paid. A short reply such as "yes",
       "ok", "continue" or "proceed" answers the last question you
       asked - take the quote number from earlier in the
       conversation and call resumeIncompleteQuote right away,
       never asking for the quote number or insurance type again.
     - proposal.status is "PENDING": tell the customer it's still
       under underwriting review and they'll be notified once a
       decision is made. Do not ask if they want to continue, and
       do not call resumeIncompleteQuote - it will be refused.
     - proposal.status is "DECLINED": tell the customer plainly
       that this quote was declined during underwriting review,
       and share the underwriter's note if one is present. Do not
       offer to continue or resume it - it cannot be paid for.
     - proposal.status is "COUNTER_OFFER": tell the customer the
       underwriter offered a revised premium (state the amount)
       and that they need to respond to the counter-offer before
       payment can proceed. Do not call resumeIncompleteQuote.

7. getClaimStatus returns a claim with one of these statuses -
   explain it plainly rather than just repeating the raw value:
     - "STP_APPROVED": the claim was automatically approved
       (straight-through processing) for the full claimed amount.
     - "PENDING": the claim is still under underwriter review -
       no decision yet.
     - "APPROVED": an underwriter approved it. State the
       approvedAmount (it may differ from the original claimed
       amount) and the adjuster's note if present.
     - "DECLINED": an underwriter declined it. Share the
       adjuster's note if present, without being asked to.
   Never guess a claim's outcome before calling the tool.

8. Call at most ONE tool per step.

9. Use searchPolicyTerms when the customer asks about coverage,
   exclusions, terms, or conditions. Prefer using the product
   type from an already-fetched policy/quote when you have one.

10. Once you have enough information, or if no tool can help,
    give a final answer. Do not call tools you don't need.

${languageRule}

==================================================
OUTPUT FORMAT
==================================================

Return ONLY JSON. Nothing before or after it. Exactly one of:

To call a tool:
{
  "action": "call_tool",
  "tool": "TOOL_NAME",
  "args": { }
}

To answer the customer:
{
  "action": "final_answer",
  "reply": "..."
}
`;

}


/*
=========================================================
TOOL EXECUTION
=========================================================

The LLM only ever picks a tool name + args. This function is
the only thing that actually touches the database/RAG index,
and it's where access control lives (see customerId scoping).
=========================================================
*/

async function executeTool(toolName, args, context) {

    if (toolName === "getPolicyDetails") {

        const policyNumber =
            String(args?.policyNumber || "").trim();

        if (!policyNumber) {
            return { error: "No policy number was provided." };
        }

        if (!context.customerId) {
            return { error: "No logged-in customer to look up a policy for." };
        }

        const policy =
            await getPolicyByNumber(
                policyNumber,
                context.customerId
            );

        if (!policy) {
            return {
                error:
                    "No policy with that number was found for this customer."
            };
        }

        return { policy };

    }


    if (toolName === "searchPolicyTerms") {

        const query =
            String(args?.query || "").trim();

        if (!query) {
            return { error: "No search query was provided." };
        }

        const productType =
            String(args?.productType || "").trim();

        const scopedQuery =
            productType && productType !== "UNKNOWN"
                ? `${productType} insurance - ${query}`
                : query;

        const chunks =
            await retrieveRelevantChunks(scopedQuery);

        return { chunks };

    }


    if (toolName === "getQuoteDetails") {

        const quoteNumber =
            String(args?.quoteNumber || "").trim();

        if (!quoteNumber) {
            return { error: "No quote number was provided." };
        }

        if (!context.customerId) {
            return { error: "No logged-in customer to look up a quote for." };
        }

        const quote =
            await getQuoteByNumber(
                quoteNumber,
                context.customerId
            );

        if (!quote) {
            return {
                error:
                    "No quote with that number was found for this customer."
            };
        }

        const selectedOption =
            await getSelectedQuoteOption(quote.QUOTE_ID);

        const availableOptions =
            selectedOption
                ? []
                : await getQuoteOptions(quote.QUOTE_ID);

        const proposal =
            await getProposalByQuoteId(quote.QUOTE_ID);

        return {
            quote,
            selectedOption: selectedOption || null,
            availableOptions,
            // Present only when this quote was escalated to
            // underwriting (KYC failure, high value, etc). Its
            // status governs what you should tell the customer -
            // see the rules above.
            proposal: proposal || null
        };

    }


    if (toolName === "getClaimStatus") {

        const claimNumber =
            String(args?.claimNumber || "").trim();

        if (!claimNumber) {
            return { error: "No claim number was provided." };
        }

        if (!context.customerId) {
            return { error: "No logged-in customer to look up a claim for." };
        }

        const claim =
            await getClaimByNumber(
                claimNumber,
                context.customerId
            );

        if (!claim) {
            return {
                error:
                    "No claim with that number was found for this customer."
            };
        }

        return { claim };

    }


    if (toolName === "resumeIncompleteQuote") {

        const quoteNumber =
            String(args?.quoteNumber || "").trim();

        if (!quoteNumber) {
            return { error: "No quote number was provided." };
        }

        if (!context.customerId) {
            return { error: "No logged-in customer to resume a quote for." };
        }

        const quote =
            await getQuoteByNumber(
                quoteNumber,
                context.customerId
            );

        if (!quote) {
            return {
                error:
                    "No quote with that number was found for this customer."
            };
        }

        if (quote.PAYMENT_STATUS === "PAID") {
            return {
                error:
                    "This quote has already been paid and converted to a policy. Look it up as a policy instead."
            };
        }

        // Same gate as the actual payment step (processPayment in
        // chatControllers.js) - checked here too so the agent never
        // even offers to continue a quote that can't be paid for.
        const proposal =
            await getProposalByQuoteId(quote.QUOTE_ID);

        if (proposal && proposal.PROPOSAL_STATUS === "DECLINED") {
            return {
                error:
                    `This quote was declined during underwriting review (proposal ${proposal.PROPOSAL_NUMBER}). It cannot be resumed or paid for.` +
                    (proposal.UNDERWRITER_NOTE ? ` Underwriter note: ${proposal.UNDERWRITER_NOTE}` : "")
            };
        }

        if (proposal && proposal.PROPOSAL_STATUS === "PENDING") {
            return {
                error:
                    `This quote is still under underwriting review (proposal ${proposal.PROPOSAL_NUMBER}). It cannot be paid for until a decision is made.`
            };
        }

        if (proposal && proposal.PROPOSAL_STATUS === "COUNTER_OFFER") {
            return {
                error:
                    `The underwriter has made a counter-offer of ${proposal.COUNTER_OFFER_PREMIUM} for this quote (proposal ${proposal.PROPOSAL_NUMBER}). The customer must respond to the counter-offer before this can be resumed for payment.`
            };
        }

        // Re-open the flow. This mirrors exactly what the
        // deterministic quote-creation/quote-selection steps in
        // chatControllers.js already store in collectedData - the
        // agent only re-seeds state, it never selects an option or
        // takes payment itself. The NEXT message from this customer
        // will be picked up by the existing active-flow check at the
        // top of chat() and routed straight into handlePurchaseFlow.
        startPurchaseFlow(context.customerId);

        updatePurchaseFlow(
            context.customerId,
            {
                extractedData: {
                    quoteId: quote.QUOTE_ID,
                    quoteNumber: quote.QUOTE_NUMBER,
                    vehicleId: quote.VEHICLE_ID,
                    productId: quote.PRODUCT_ID,
                    coverFrom: quote.COVER_FROM,
                    coverTo: quote.COVER_TO
                },
                missingInformation: []
            }
        );

        const selectedOption =
            await getSelectedQuoteOption(quote.QUOTE_ID);

        if (selectedOption) {

            // Option already chosen last time - go straight to payment.
            return {
                resumed: true,
                quote,
                selectedOption,
                ui: {
                    uiType: "PAYMENT",
                    actions: [
                        {
                            label: "Pay Now",
                            action: "PAY_QUOTE"
                        }
                    ],
                    data: [selectedOption]
                }
            };

        }

        const options =
            await getQuoteOptions(quote.QUOTE_ID);

        return {
            resumed: true,
            quote,
            availableOptions: options,
            ui: {
                uiType: "QUOTE_OPTIONS",
                actions: options.map(option => ({
                    label: option.PLAN_NAME,
                    action: `SELECT_QUOTE_OPTION_${option.OPTION_NUMBER}`
                })),
                data: options
            }
        };

    }


    return { error: `Unknown tool: ${toolName}` };

}


/*
=========================================================
NORMALIZE NEAR-MISS SHAPES
=========================================================

Smaller/local models reliably follow the JSON contract on the
first turn, then drift slightly once there's a tool result in
context (e.g. {"final": "..."} instead of
{"action":"final_answer","reply":"..."}). Rather than failing
the whole request on a near-miss, recognize the common variants.
=========================================================
*/

function normalizeAgentAction(parsed) {

    if (!parsed || typeof parsed !== "object") {
        return parsed;
    }

    // Already correct.
    if (parsed.action === "call_tool" || parsed.action === "final_answer") {
        return parsed;
    }

    // {"final_answer": "..."} or {"final_answer": {"reply": "..."}}
    if (typeof parsed.final_answer !== "undefined") {
        const inner = parsed.final_answer;

        return {
            action: "final_answer",
            reply:
                typeof inner === "string"
                    ? inner
                    : inner?.reply || ""
        };
    }

    // {"tool": "...", "args": {...}} with no/wrong action label.
    if (parsed.tool) {
        return {
            action: "call_tool",
            tool: parsed.tool,
            args: parsed.args || {}
        };
    }

    // {"reply": "..."} or {"answer": "..."} with no/wrong action label.
    if (typeof parsed.reply === "string" || typeof parsed.answer === "string") {
        return {
            action: "final_answer",
            reply: parsed.reply || parsed.answer
        };
    }

    // {"action": "final"} / "answer" / "respond" variants.
    if (
        typeof parsed.action === "string" &&
        ["final", "answer", "respond", "reply"].includes(
            parsed.action.toLowerCase()
        )
    ) {
        return {
            action: "final_answer",
            reply: parsed.reply || parsed.message || ""
        };
    }

    return parsed;

}


/*
=========================================================
PARSE AGENT JSON
=========================================================
*/

function parseAgentJson(rawResponse) {

    let clean =
        String(rawResponse || "")
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");

    if (start === -1 || end === -1) {
        throw new Error("Agent did not return JSON.");
    }

    clean = clean.substring(start, end + 1);

    return JSON.parse(clean);

}


/*
=========================================================
RUN AGENT
=========================================================

customerId is required for getPolicyDetails to work at all -
this should only be called from a path that already confirmed
the user is logged in (e.g. the POLICY intent branch, which is
already a PROTECTED_INTENTS entry in the controller).
=========================================================
*/

async function runAgent({
    message,
    history = [],
    language = "en",
    customerId = null
}) {

    const messages = [
        {
            role: "system",
            content: buildAgentSystemPrompt(language)
        }
    ];


    if (Array.isArray(history) && history.length > 0) {

        messages.push({
            role: "system",
            content:
                `PREVIOUS CONVERSATION:\n\n` +
                history
                    .slice(-12)
                    .map(item => `${item.role}: ${item.content}`)
                    .join("\n")
        });

    }


    messages.push({
        role: "user",
        content: message
    });


    const trace = [];
    let lastUi = null;
    let awaiting = false;


    function finish(reply) {
        return {
            reply,
            trace,
            awaitingConfirmation: awaiting,
            uiType: lastUi?.uiType || "TEXT",
            actions: lastUi?.actions || [],
            data: lastUi?.data || []
        };
    }


    for (let step = 0; step < MAX_AGENT_STEPS; step++) {

        let raw;

        try {
            raw = await callLLMWithRetry(messages);
        } catch (error) {
            console.error("Agent LLM Error:", error.message);

            // If a tool already produced something useful (e.g. the
            // quote options) before the LLM call failed, don't waste
            // that - point the customer at what's already on screen
            // instead of a bare error.
            if (lastUi) {
                return finish(
                    language === "ar"
                        ? "إليك الخيارات المتاحة - يمكنك الاختيار من الأزرار أدناه."
                        : "Here are the available options below - go ahead and pick one."
                );
            }

            return finish(
                language === "ar"
                    ? "عذرًا، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى."
                    : "Sorry, something went wrong while processing that. Please try again."
            );
        }

        console.log(
            "\n========== AGENT RAW RESPONSE (step " + step + ") =========="
        );
        console.log(raw);


        let parsed;

        try {
            parsed = parseAgentJson(raw);
        } catch (error) {
            // Model didn't follow the JSON contract - fall back to
            // treating its raw text as the final answer rather than
            // failing the whole request.
            return finish(raw.trim());
        }

        parsed = normalizeAgentAction(parsed);


        if (parsed.action === "final_answer") {

            return finish(
                typeof parsed.reply === "string"
                    ? parsed.reply.trim()
                    : ""
            );

        }


        if (parsed.action === "call_tool") {

            const toolName = parsed.tool;
            const args = parsed.args || {};

            console.log(
                "\n========== AGENT TOOL CALL =========="
            );
            console.log(JSON.stringify({ step, toolName, args }, null, 2));

            const result =
                await executeTool(
                    toolName,
                    args,
                    { customerId }
                );

            console.log(
                "\n========== AGENT TOOL RESULT =========="
            );
            console.log(JSON.stringify(result, null, 2));

            trace.push({ tool: toolName, args, result });

            if (result && result.ui) {
                lastUi = result.ui;
            }

            // An unpaid, resumable quote was just described: the
            // agent will end this turn by asking whether to continue,
            // so the next reply ("yes") must come back to the agent.
            // A quote with a DECLINED/PENDING/COUNTER_OFFER proposal
            // is NOT resumable - resumeIncompleteQuote will refuse it
            // anyway, so there's nothing to wait for an answer to.
            if (
                toolName === "getQuoteDetails" &&
                result?.quote &&
                result.quote.PAYMENT_STATUS !== "PAID" &&
                !(result?.proposal && result.proposal.PROPOSAL_STATUS !== "APPROVED")
            ) {
                awaiting = true;
            }

            if (toolName === "resumeIncompleteQuote" && result?.resumed) {
                awaiting = false;
            }

            messages.push({
                role: "assistant",
                content: JSON.stringify(parsed)
            });

            messages.push({
                role: "system",
                content:
                    `TOOL RESULT for ${toolName}:\n\n` +
                    `${JSON.stringify(result, null, 2)}\n\n` +
                    `Use this to decide your next step. If it contains ` +
                    `an "error", do not retry the same call with the ` +
                    `same arguments.\n\n` +
                    `Reminder: respond with ONLY JSON, in exactly one of ` +
                    `these two shapes - nothing else:\n` +
                    `{"action": "call_tool", "tool": "...", "args": {}}\n` +
                    `{"action": "final_answer", "reply": "..."}`
            });

            continue;

        }


        // Unrecognized action shape from the model.
        return finish(
            language === "ar"
                ? "عذرًا، لم أتمكن من معالجة ذلك. هل يمكنك إعادة الصياغة؟"
                : "Sorry, I couldn't process that. Could you rephrase?"
        );

    }


    // Hit the step limit without a final_answer.
    return finish(
        language === "ar"
            ? "أحتاج توضيحًا أكثر للإجابة على ذلك. هل يمكنك إعادة صياغة سؤالك؟"
            : "I need a bit more detail to answer that. Could you rephrase your question?"
    );

}


module.exports = {
    runAgent,
    setAgentAwaiting,
    isAgentAwaiting
};