const express = require("express");

const {createPolicy,getPoliciesByCustomer,getPolicy} = require("../controllers/policyController");

const router = express.Router();


// ======================================================
// CREATE POLICY FROM QUOTE
// ======================================================

router.post("/policies",createPolicy);
router.get("/policies/customer/:customerId",getPoliciesByCustomer);
router.get("/policies/:policyNumber",getPolicy);


module.exports = router;