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
    }
    catch (err) {
         console.error("Failed to save chat history:", err);
    throw err;
}
finally {
        if (connection) await connection.close();
    }
}

async function getSessionList(customerId) {
    let connection;

    try {
        connection = await getConnection();

        const sessionResult = await connection.execute(
            `SELECT
                SESSION_ID,
                MIN(CREATED_AT) AS STARTED_AT,
                MAX(CREATED_AT) AS LAST_MESSAGE_AT
             FROM CHAT_HISTORY
             WHERE CUSTOMER_ID = :customerId
             GROUP BY SESSION_ID
             ORDER BY MAX(CREATED_AT) DESC`,
            {
                customerId
            },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        const sessions = sessionResult.rows;

        for (const session of sessions) {

            const previewResult = await connection.execute(
                `SELECT DBMS_LOB.SUBSTR(CONTENT, 500, 1) AS PREVIEW
                 FROM (
                     SELECT CONTENT
                     FROM CHAT_HISTORY
                     WHERE CUSTOMER_ID = :customerId
                       AND SESSION_ID = :sessionId
                       AND ROLE = 'user'
                     ORDER BY CREATED_AT ASC
                 )
                 WHERE ROWNUM = 1`,
                {
                    customerId,
                    sessionId: session.SESSION_ID
                },
                {
                    outFormat: oracledb.OUT_FORMAT_OBJECT
                }
            );

            if (previewResult.rows.length > 0) {
                session.PREVIEW = previewResult.rows[0].PREVIEW;
            } else {
                session.PREVIEW = "New conversation";
            }
        }

        return sessions;

    } catch (err) {
        console.error("getSessionList Oracle error:", err);
        throw err;

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}
async function getSessionMessages(customerId, sessionId) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT
                ROLE,
                DBMS_LOB.SUBSTR(CONTENT, 4000, 1) AS CONTENT,
                LANGUAGE,
                CREATED_AT
             FROM CHAT_HISTORY
             WHERE CUSTOMER_ID = :customerId
               AND SESSION_ID = :sessionId
             ORDER BY CREATED_AT ASC`,
            {
                customerId,
                sessionId
            },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        return result.rows;

    } catch (err) {
        console.error("getSessionMessages Oracle error:", err);
        throw err;

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}
module.exports = { saveMessage, getSessionList, getSessionMessages };