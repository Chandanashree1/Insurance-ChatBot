const express = require("express");
const router = express.Router();

const {processPaymentController} = require("../controllers/paymentController");




// ======================================================
// PROCESS PAYMENT
// ======================================================

router.post("/payments",processPaymentController);


module.exports = router;