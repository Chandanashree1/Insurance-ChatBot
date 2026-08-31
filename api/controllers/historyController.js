const { getSessionList, getSessionMessages } = require("../services/historyService");

async function listSessions(req, res) {
    try {
        const { customerId } = req.params;
        const sessions = await getSessionList(customerId);
        res.json({ success: true, sessions });
    } catch (err) {
        console.error("List sessions error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
}

async function getSession(req, res) {
    try {
        const { customerId, sessionId } = req.params;
        const messages = await getSessionMessages(customerId, sessionId);
        res.json({ success: true, messages });
    } catch (err) {
        console.error("Get session error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { listSessions, getSession };