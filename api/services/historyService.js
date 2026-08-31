const { getConnection } = require("../config/oracle");
const oracledb = require("oracledb");

async function saveMessage(customerId, sessionId, role, content, language = "en") {
    if (!customerId) return; // guests are never persisted

    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `INSERT INTO CHAT_HISTORY (CUSTOMER_ID, SESSION_ID, ROLE, CONTENT, LANGUAGE)
             VALUES (:customerId, :sessionId, :role, :content, :language)`,
            { customerId, sessionId, role, content, language },
            { autoCommit: true }
        );
    } catch (err) {
        console.error("Failed to save chat history:", err);
    } finally {
        if (connection) await connection.close();
    }
}

async function getSessionList(customerId) {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT SESSION_ID,
                    MIN(CREATED_AT) AS STARTED_AT,
                    MAX(CREATED_AT) AS LAST_MESSAGE_AT,
                    (SELECT CONTENT FROM CHAT_HISTORY c2
                     WHERE c2.SESSION_ID = c1.SESSION_ID
                       AND c2.ROLE = 'user'
                       AND ROWNUM = 1
                     ORDER BY c2.CREATED_AT ASC) AS PREVIEW
             FROM CHAT_HISTORY c1
             WHERE CUSTOMER_ID = :customerId
             GROUP BY SESSION_ID
             ORDER BY MAX(CREATED_AT) DESC`,
            { customerId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return result.rows;
    } finally {
        if (connection) await connection.close();
    }
}

async function getSessionMessages(customerId, sessionId) {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT ROLE, CONTENT, LANGUAGE, CREATED_AT
             FROM CHAT_HISTORY
             WHERE CUSTOMER_ID = :customerId AND SESSION_ID = :sessionId
             ORDER BY CREATED_AT ASC`,
            { customerId, sessionId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return result.rows;
    } finally {
        if (connection) await connection.close();
    }
}

module.exports = { saveMessage, getSessionList, getSessionMessages };