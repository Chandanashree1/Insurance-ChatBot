const express = require("express");
const {createMotorQuote,selectOption} = require("../controllers/quoteController");
const router = express.Router();
// Create Motor Insurance Quote
router.post("/quotes",createMotorQuote);
router.post("/quotes/select-option",selectOption);

module.exports = router;