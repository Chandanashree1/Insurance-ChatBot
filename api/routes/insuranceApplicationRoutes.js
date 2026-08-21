const express = require("express");
const router = express.Router();

const upload = require("../middlware/upload");
const {
    submitInsuranceApplication
} = require("../controllers/insuranceApplicationController");

router.post(
    "/insurance-application",
    upload.array("documents"),
    submitInsuranceApplication
);

module.exports = router;