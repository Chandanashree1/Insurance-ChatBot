const {
    submitProposalForUnderwriting,
    getPendingProposals,
    decideProposal,
    getProposalByQuoteId,
    respondToCounterOffer,getProposalByQuoteNumber
} = require("../services/underwritingService");


async function submitProposal(req, res) {
    try {
        const { quoteId, optionId, additionalInfo } = req.body;

        if (!quoteId || !optionId) {
            return res.status(400).json({ success: false, message: "quoteId and optionId are required" });
        }

        const proposal = await submitProposalForUnderwriting(quoteId, optionId, additionalInfo, 'HIGH_VALUE');

        return res.status(201).json({ success: true, data: proposal });

    } catch (err) {
        console.error("Submit Proposal Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}


async function getProposalStatusByQuoteNumber(req, res) {
    try {
        const { quoteNumber } = req.params;

        const proposal = await getProposalByQuoteNumber(quoteNumber);

        if (!proposal) {
            return res.status(404).json({ success: false, message: "No proposal found for this quote number" });
        }

        return res.status(200).json({
            success: true,
            data: {
                proposalId: proposal.PROPOSAL_ID,
                proposalNumber: proposal.PROPOSAL_NUMBER,
                quoteId: proposal.QUOTE_ID,
                quoteNumber: proposal.QUOTE_NUMBER,
                status: proposal.PROPOSAL_STATUS,
                note: proposal.UNDERWRITER_NOTE,
                counterOfferPremium: proposal.COUNTER_OFFER_PREMIUM,
                customerResponse: proposal.CUSTOMER_RESPONSE,
                triggerReason: proposal.TRIGGER_REASON,
                submittedAt: proposal.SUBMITTED_AT,
                decidedAt: proposal.DECIDED_AT
            }
        });

    } catch (err) {
        console.error("Get Proposal Status By Quote Number Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch proposal status" });
    }
}

// ======================================================
// ESCALATE PAYMENT FAILURE
// ======================================================
async function escalatePaymentFailure(req, res) {
    try {
        const { quoteId, optionId } = req.body;

        if (!quoteId || !optionId) {
            return res.status(400).json({ success: false, message: "quoteId and optionId are required" });
        }

        const proposal = await submitProposalForUnderwriting(
            quoteId,
            optionId,
            "Payment could not be processed",
            "PAYMENT_FAILED"
        );

        return res.status(201).json({ success: true, data: proposal });

    } catch (err) {
        console.error("Escalate Payment Failure Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}


async function listProposals(req, res) {
    try {
        const proposals = await getPendingProposals();

        return res.status(200).json({
            success: true,
            data: proposals.map(p => ({
                proposalId: p.PROPOSAL_ID,
                proposalNumber: p.PROPOSAL_NUMBER,
                quoteId: p.QUOTE_ID,
                quoteNumber: p.QUOTE_NUMBER,
                customerName: p.CUSTOMER_NAME,
                planName: p.PLAN_NAME,
                premium: p.PREMIUM,
                vehicleValue: p.VEHICLE_VALUE,
                additionalInfo: p.ADDITIONAL_INFO,
                triggerReason: p.TRIGGER_REASON,
                status: p.PROPOSAL_STATUS,
                submittedAt: p.SUBMITTED_AT
            }))
        });

    } catch (err) {
        console.error("List Proposals Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch proposals" });
    }
}


async function decideProposalController(req, res) {
    try {
        const { proposalId } = req.params;
        const { decision, note, counterOfferPremium } = req.body;

        if (!['APPROVED', 'COUNTER_OFFER', 'DECLINED'].includes(decision)) {
            return res.status(400).json({ success: false, message: "Invalid decision value" });
        }

        const result = await decideProposal(proposalId, decision, note, counterOfferPremium);

        return res.status(200).json({ success: true, data: result });

    } catch (err) {
        console.error("Decide Proposal Error:", err);
        return res.status(500).json({ success: false, message: "Failed to update proposal" });
    }
}


async function getProposalStatus(req, res) {
    try {
        const { quoteId } = req.params;

        const proposal = await getProposalByQuoteId(quoteId);

        if (!proposal) {
            return res.status(404).json({ success: false, message: "No proposal found for this quote" });
        }

        return res.status(200).json({
            success: true,
            data: {
                proposalId: proposal.PROPOSAL_ID,
                proposalNumber: proposal.PROPOSAL_NUMBER,
                optionId: proposal.OPTION_ID,
                planName: proposal.PLAN_NAME,
                premium: proposal.PREMIUM,
                status: proposal.PROPOSAL_STATUS,
                note: proposal.UNDERWRITER_NOTE,
                counterOfferPremium: proposal.COUNTER_OFFER_PREMIUM,
                customerResponse: proposal.CUSTOMER_RESPONSE,
                triggerReason: proposal.TRIGGER_REASON,
                submittedAt: proposal.SUBMITTED_AT,
                decidedAt: proposal.DECIDED_AT
            }
        });

    } catch (err) {
        console.error("Get Proposal Status Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch proposal status" });
    }
}


async function respondToCounterOfferController(req, res) {
    try {
        const { proposalId } = req.params;
        const { response } = req.body;

        if (!['ACCEPTED', 'REJECTED'].includes(response)) {
            return res.status(400).json({ success: false, message: "Invalid response value" });
        }

        const result = await respondToCounterOffer(proposalId, response);

        return res.status(200).json({ success: true, data: result });

    } catch (err) {
        console.error("Respond To Counter Offer Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}


module.exports = {
    submitProposal,
    escalatePaymentFailure,
    listProposals,
    decideProposalController,
    getProposalStatus,
    respondToCounterOfferController,
    getProposalStatusByQuoteNumber
};