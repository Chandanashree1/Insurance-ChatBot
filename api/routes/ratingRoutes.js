const express = require("express");

const router = express.Router();

const {
    submitRating
} = require("../controllers/ratingController");

router.post("/rating", submitRating);

module.exports = router;