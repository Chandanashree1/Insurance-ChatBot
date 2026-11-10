const express = require("express");
const { lookupRenewal, createRenewal ,payRenewal } = require("../controllers/renewalController");

const {
  createPolicy,
  getPoliciesByCustomer,
  getPolicy,
  downloadPolicyDocument
} = require("../controllers/policyController");

const router = express.Router();


// ======================================================
// CREATE POLICY FROM QUOTE
// ======================================================

router.post("/policies", createPolicy);
router.get("/policies/customer/:customerId", getPoliciesByCustomer);
router.get("/policies/:policyNumber", getPolicy);
router.get("/policies/:policyNumber/document", downloadPolicyDocument);

// Renewal routes
router.post("/renewals/lookup", lookupRenewal);
router.post("/renewals/quote", createRenewal);
router.post("/renewals/pay", payRenewal);

module.exports = router;