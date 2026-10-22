const { getConnection } = require("../config/oracle");
const oracledb = require("oracledb");
const { analyzeFeedback } = require("../services/huggingFaceService")
// ==========================================
// CORE SAVE LOGIC
// ==========================================

async function saveRating(
    customerId,
    sessionId,
    rating,
    feedback,
    language = "en"
) {
    let connection;

    try {
        connection = await getConnection();

        // CUSTOMER ID
        let customerIdValue = null;

        if (
            customerId !== undefined &&
            customerId !== null &&
            customerId !== ""
        ) {
            const parsedCustomerId = Number(customerId);

            if (!Number.isInteger(parsedCustomerId)) {
                throw new Error("Invalid customerId");
            }

            customerIdValue = parsedCustomerId;
        }

        // SESSION ID
        if (!sessionId || typeof sessionId !== "string") {
            throw new Error("Invalid sessionId");
        }

        if (sessionId.length > 100) {
            throw new Error(
                "Session ID cannot exceed 100 characters"
            );
        }

        // RATING
        const ratingValue = Number(rating);

        if (
            !Number.isInteger(ratingValue) ||
            ratingValue < 1 ||
            ratingValue > 5
        ) {
            throw new Error(
                "Rating must be an integer between 1 and 5"
            );
        }

        // FEEDBACK
        const feedbackValue =
            typeof feedback === "string" &&
                feedback.trim()
                ? feedback.trim()
                : null;


        // ==========================================
        // AI FEEDBACK ANALYSIS
        // ==========================================

        const feedbackAnalysis = await analyzeFeedback(
            ratingValue,
            feedbackValue
        );

        console.log("--------------------------------");
        console.log("Rating:", ratingValue);
        console.log("Feedback:", feedbackValue);
        console.log(
            "AI Sentiment:",
            feedbackAnalysis.sentiment
        );
        console.log(
            "AI Follow-up Required:",
            feedbackAnalysis.followUpRequired
        );
        console.log("--------------------------------");


        // ==========================================
        // FOLLOW-UP DECISION
        // ==========================================

        const followUpRequired =
            feedbackAnalysis.followUpRequired;

        const followUpStatus =
            followUpRequired
                ? "PENDING"
                : "NOT_REQUIRED";


        // ==========================================
        // SAVE TO ORACLE
        // ==========================================

        const result = await connection.execute(
            `INSERT INTO CHAT_RATINGS
            (
                CUSTOMER_ID,
                SESSION_ID,
                RATING,
                FEEDBACK,
                LANGUAGE,
                FOLLOW_UP_STATUS
            )
            VALUES
            (
                :customerId,
                :sessionId,
                :rating,
                :feedback,
                :language,
                :followUpStatus
            )
            RETURNING RATING_ID INTO :ratingId`,
            {
                customerId: customerIdValue,
                sessionId: sessionId,
                rating: ratingValue,
                feedback: feedbackValue,
                language: language || "en",
                followUpStatus: followUpStatus,

                ratingId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            },
            {
                autoCommit: true
            }
        );


        const ratingId =
            result.outBinds.ratingId[0];


        console.log(
            "Rating inserted successfully:",
            ratingId
        );


        // ==========================================
        // FOLLOW-UP LOG
        // ==========================================

        if (followUpRequired) {

            console.log("⚠️ FOLLOW-UP REQUIRED");
            console.log("Rating:", ratingValue);
            console.log("Feedback:", feedbackValue);
            console.log("Status:", "PENDING");

        }


        return {
            success: true,
            ratingId,
            rating: ratingValue,
            feedback: feedbackValue,
            sentiment: feedbackAnalysis.sentiment,
            followUpRequired,
            followUpStatus
        };

    } catch (err) {

        console.error("Failed to save rating");
        console.error("Oracle error:", err);
        console.error("Oracle message:", err.message);

        throw err;

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error(
                    "Connection close error:",
                    closeErr
                );
            }
        }
    }
}

// ==========================================
// GET PENDING FOLLOW-UPS (LIST)
// ==========================================



async function fetchAgentFollowUps() {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT
                RATING_ID,
                CUSTOMER_ID,
                SESSION_ID,
                RATING,
                FEEDBACK,
                LANGUAGE,
                FOLLOW_UP_STATUS,
                CREATED_AT
             FROM CHAT_RATINGS
             WHERE FOLLOW_UP_STATUS = 'PENDING'
             ORDER BY CREATED_AT DESC`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const followUps = await Promise.all(
            result.rows.map(async row => {
                let feedback = row.FEEDBACK;

                if (feedback && typeof feedback.getData === "function") {
                    feedback = await feedback.getData();
                } else if (feedback && typeof feedback.on === "function") {
                    feedback = await new Promise((resolve, reject) => {
                        let text = "";

                        feedback.setEncoding("utf8");
                        feedback.on("data", chunk => text += chunk);
                        feedback.on("end", () => resolve(text));
                        feedback.on("error", reject);
                    });
                }

                return {
                    ratingId: row.RATING_ID,
                    customerId: row.CUSTOMER_ID,
                    sessionId: row.SESSION_ID,
                    rating: row.RATING,
                    feedback: feedback ?? null,
                    language: row.LANGUAGE,
                    followUpStatus: row.FOLLOW_UP_STATUS,
                    createdAt: row.CREATED_AT instanceof Date
                        ? row.CREATED_AT.toISOString()
                        : row.CREATED_AT ?? null
                };
            })
        );

        return followUps;

    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Connection close error:", err);
            }
        }
    }
}



// ==========================================
// UPDATE A FOLLOW-UP'S STATUS
// ==========================================

const VALID_FOLLOW_UP_STATUSES = ["PENDING", "IN_PROGRESS", "RESOLVED", "NOT_REQUIRED"];

async function setAgentFollowUpStatus(ratingId, status) {
    let connection;

    try {
        const parsedRatingId = Number(ratingId);

        if (!Number.isInteger(parsedRatingId)) {
            throw new Error("Invalid ratingId");
        }

        if (!VALID_FOLLOW_UP_STATUSES.includes(status)) {
            throw new Error(
                `Status must be one of: ${VALID_FOLLOW_UP_STATUSES.join(", ")}`
            );
        }

        connection = await getConnection();

        const result = await connection.execute(
            `UPDATE CHAT_RATINGS
             SET FOLLOW_UP_STATUS = :status
             WHERE RATING_ID = :ratingId`,
            {
                status: status,
                ratingId: parsedRatingId
            },
            {
                autoCommit: true
            }
        );

        if (result.rowsAffected === 0) {
            throw new Error("Rating not found");
        }

        return {
            success: true,
            ratingId: parsedRatingId,
            followUpStatus: status
        };

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error("Connection close error:", closeErr);
            }
        }
    }
}

// ==========================================
// GET ALL FEEDBACK (GOOD / BAD SPLIT)
// ==========================================


async function fetchAllFeedback() {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT
                RATING_ID,
                CUSTOMER_ID,
                SESSION_ID,
                RATING,
                FEEDBACK,
                LANGUAGE,
                FOLLOW_UP_STATUS,
                CREATED_AT
             FROM CHAT_RATINGS
             ORDER BY CREATED_AT DESC
             FETCH FIRST 200 ROWS ONLY`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const rows = await Promise.all(
            result.rows.map(async r => {
                let feedback = r.FEEDBACK;

                // Convert an Oracle CLOB to a plain string.
                if (feedback && typeof feedback.getData === "function") {
                    feedback = await feedback.getData();
                } else if (feedback && typeof feedback.on === "function") {
                    feedback = await new Promise((resolve, reject) => {
                        let data = "";

                        feedback.setEncoding("utf8");
                        feedback.on("data", chunk => data += chunk);
                        feedback.on("end", () => resolve(data));
                        feedback.on("error", reject);
                    });
                }

                return {
                    ratingId: r.RATING_ID,
                    customerId: r.CUSTOMER_ID,
                    sessionId: r.SESSION_ID,
                    rating: r.RATING,
                    feedback: feedback ?? null,
                    language: r.LANGUAGE,
                    followUpStatus: r.FOLLOW_UP_STATUS,
                    createdAt: r.CREATED_AT instanceof Date
                        ? r.CREATED_AT.toISOString()
                        : r.CREATED_AT ?? null
                };
            })
        );

        return rows;

    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error("Connection close error:", closeErr);
            }
        }
    }
}




async function getFeedbackOverview(req, res) {
    try {
        const all = await fetchAllFeedback();

        const isBad = f =>
            Number(f.rating) <= 2 ||
            f.followUpStatus !== "NOT_REQUIRED";

        const bad = all.filter(isBad);
        const good = all.filter(f => !isBad(f));

        const response = {
            success: true,
            counts: {
                good: good.length,
                bad: bad.length,
                pendingBad: bad.filter(
                    f => f.followUpStatus === "PENDING"
                ).length
            },
            good,
            bad
        };
        return res.status(200).json(response);

    } catch (err) {
        console.error(
            "Failed to fetch feedback overview:",
            err.stack || err.message
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch feedback"
        });
    }
}



// ==========================================
// EXPRESS HANDLERS
// ==========================================

async function submitRating(req, res) {
    try {
        const { customerId, sessionId, rating, feedback, language } = req.body;

        const result = await saveRating(
            customerId,
            sessionId,
            rating,
            feedback,
            language
        );

        res.status(201).json(result);

    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
}


async function getAgentFollowUps(req, res) {
    try {
        const followUps = await fetchAgentFollowUps();

        console.log("Follow-ups is array:", Array.isArray(followUps));
        console.log("Follow-up count:", followUps.length);

        for (const [index, item] of followUps.entries()) {
            try {
                JSON.stringify(item);
            } catch (err) {
                console.error(`Circular data in follow-up ${index}:`);
                console.error(err.message);
                console.dir(item, { depth: 3 });
            }
        }

        return res.status(200).json({
            success: true,
            count: followUps.length,
            followUps
        });

    } catch (err) {
        console.error(
            "Failed to fetch follow-ups:",
            err.stack || err.message
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch follow-ups"
        });
    }
}


async function updateAgentFollowUp(req, res) {
    try {
        const { ratingId } = req.params;
        const { status } = req.body;

        const result = await setAgentFollowUpStatus(ratingId, status);

        res.status(200).json(result);

    } catch (err) {
        const statusCode = err.message === "Rating not found" ? 404 : 400;
        res.status(statusCode).json({
            success: false,
            message: err.message
        });
    }
}

module.exports = {
    submitRating,
    getAgentFollowUps,
    updateAgentFollowUp,
    getFeedbackOverview,

};