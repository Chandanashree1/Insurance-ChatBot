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


/*
=========================================================
SESSION TITLES (new)
=========================================================

A short title per chat session, shown in Chat History instead
of the first message (which is often just "hi"). Stored in
CHAT_SESSION_TITLE - see chat_session_title.sql.
=========================================================
*/

async function hasSessionTitle(customerId, sessionId) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT 1 AS FOUND
             FROM CHAT_SESSION_TITLE
             WHERE CUSTOMER_ID = :customerId
               AND SESSION_ID = :sessionId`,
            { customerId, sessionId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows.length > 0;

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


async function saveSessionTitle(customerId, sessionId, title) {
    let connection;

    try {
        connection = await getConnection();

        // Insert only if this chat has no title yet. Distinct bind names
        // are used on purpose (sessionId / sessionIdCheck, etc.).
        await connection.execute(
            `INSERT INTO CHAT_SESSION_TITLE (SESSION_ID, CUSTOMER_ID, TITLE)
             SELECT :sessionId, :customerId, :title
             FROM DUAL
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM CHAT_SESSION_TITLE
                 WHERE CUSTOMER_ID = :customerIdCheck
                   AND SESSION_ID = :sessionIdCheck
             )`,
            {
                sessionId,
                customerId,
                title,
                customerIdCheck: customerId,
                sessionIdCheck: sessionId
            },
            { autoCommit: true }
        );

    } catch (err) {

        // ORA-00001: two messages raced to title the same session.
        // The other one won - nothing to do.
        if (err && err.errorNum === 1) {
            return;
        }

        throw err;

    } finally {
        if (connection) {
            await connection.close();
        }
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

        // Titles written by sessionTitleService, in one query.
        // If the CHAT_SESSION_TITLE table doesn't exist yet, history must
        // keep working exactly as before, so a failure here is not fatal.
        const titles = new Map();

        try {
            const titleResult = await connection.execute(
                `SELECT SESSION_ID, TITLE
                 FROM CHAT_SESSION_TITLE
                 WHERE CUSTOMER_ID = :customerId`,
                { customerId },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            for (const row of titleResult.rows) {
                titles.set(row.SESSION_ID, row.TITLE);
            }
        } catch (titleErr) {
            console.error(
                "Session titles unavailable, using first message:",
                titleErr.message
            );
        }

        for (const session of sessions) {

            // A generated title wins; no extra query needed for this session.
            if (titles.has(session.SESSION_ID)) {
                session.PREVIEW = titles.get(session.SESSION_ID);
                continue;
            }

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
module.exports = {
    saveMessage,
    getSessionList,
    getSessionMessages,
    hasSessionTitle,
    saveSessionTitle
};