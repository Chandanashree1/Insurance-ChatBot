const express = require("express");

const router = express.Router();

const {
    listSessions,
    getSession
} = require("../controllers/historyController");

router.get("/history/:customerId", listSessions);

router.get(
    "/history/:customerId/:sessionId",
    getSession
);

module.exports = router;