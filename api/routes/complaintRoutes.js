const express = require("express");

const { registerComplaint } = require("../controllers/complaintController");

const router = express.Router();

router.post("/", registerComplaint);

module.exports = router;