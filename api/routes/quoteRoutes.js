const express = require("express");
const { createMotorQuote, selectOption, getAllQuotes, escalateKycFailure,verifyKyc} = require("../controllers/quoteController");
const router = express.Router();

// Create Motor Insurance Quote
router.post("/quotes", createMotorQuote);
router.post("/quotes/select-option", selectOption);
router.get("/quotes", getAllQuotes);
router.post("/quotes/escalate-kyc", escalateKycFailure);
router.post("/quotes/verify-kyc", verifyKyc);
module.exports = router;