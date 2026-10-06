const express = require("express");
const router = express.Router();
const {getNonStpComplaints,getComplaintById,updateComplaintFollowUp} = require("../controllers/complaintFollowUpController");

// ============================================================
// GET ALL NON-STP COMPLAINTS
// ============================================================

router.get("/",getNonStpComplaints);

// ============================================================
// GET SINGLE COMPLAINT
// ============================================================

router.get("/:complaintId",getComplaintById);

// ============================================================
// UPDATE FOLLOW-UP
// ============================================================

router.put("/:complaintId",updateComplaintFollowUp);


module.exports = router;