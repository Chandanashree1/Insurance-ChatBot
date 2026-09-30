const express = require("express");
const router = express.Router();

const {
    submitProposal,
    escalatePaymentFailure,
    listProposals,
    decideProposalController,
    getProposalStatus,
    respondToCounterOfferController,
    getProposalStatusByQuoteNumber
} = require("../controllers/underwritingController");

router.post("/proposals", submitProposal);
router.post("/proposals/escalate-payment", escalatePaymentFailure);
router.get("/proposals", listProposals);
router.post("/proposals/:proposalId/decide", decideProposalController);
router.post("/proposals/:proposalId/respond", respondToCounterOfferController);
router.get("/proposals/quote/:quoteId", getProposalStatus);
router.get("/proposals/quote-number/:quoteNumber", getProposalStatusByQuoteNumber);

module.exports = router;