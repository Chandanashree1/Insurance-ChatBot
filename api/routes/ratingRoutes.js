const express = require("express");

const router = express.Router();

const {
    submitRating,
    getAgentFollowUps,
    updateAgentFollowUp
} = require("../controllers/ratingController");

// Customer submits a rating
router.post("/rating", submitRating);

// Agent dashboard — list pending follow-ups
router.get("/rating/follow-ups", getAgentFollowUps);

// Agent updates a follow-up's status
router.patch("/rating/follow-ups/:ratingId", updateAgentFollowUp);

module.exports = router;