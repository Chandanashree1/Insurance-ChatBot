const express = require("express");

const { registerComplaint,getComplaintStatus } = require("../controllers/complaintController");

const router = express.Router();

router.post("/", registerComplaint);
router.get("/status/:complaintId", getComplaintStatus);

module.exports = router;