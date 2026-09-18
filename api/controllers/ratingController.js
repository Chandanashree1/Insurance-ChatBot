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
            ORDER BY CREATED_AT ASC`,
            {},
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        return result.rows;

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

        res.status(200).json({
            success: true,
            count: followUps.length,
            followUps: followUps
        });

    } catch (err) {
        console.error("Failed to fetch follow-ups:", err);
        res.status(500).json({
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
    updateAgentFollowUp
};