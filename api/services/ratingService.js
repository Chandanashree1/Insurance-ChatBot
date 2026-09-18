const { getConnection } = require("../config/oracle");

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

        // ==========================================
        // CUSTOMER ID VALIDATION
        // ==========================================

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

        // ==========================================
        // SESSION ID VALIDATION
        // ==========================================

        if (!sessionId || typeof sessionId !== "string") {
            throw new Error("Invalid sessionId");
        }

        if (sessionId.length > 100) {
            throw new Error("Session ID cannot exceed 100 characters");
        }

        // ==========================================
        // RATING VALIDATION
        // ==========================================

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

        // ==========================================
        // LOW RATING BUSINESS RULE
        // ==========================================

        const followUpRequired = ratingValue <= 2;

        const followUpStatus = followUpRequired
            ? "PENDING"
            : "NOT_REQUIRED";

        console.log("--------------------------------");
        console.log("Rating:", ratingValue);
        console.log("Follow-up required:", followUpRequired);
        console.log("Follow-up status:", followUpStatus);
        console.log("--------------------------------");

        // ==========================================
        // SAVE RATING
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
            )`,
            {
                customerId: customerIdValue,
                sessionId: sessionId,
                rating: ratingValue,
                feedback: feedback || null,
                language: language || "en",
                followUpStatus,

        ratingId: {
            dir: oracledb.BIND_OUT,
            type: oracledb.NUMBER
        }
            },
            {
                autoCommit: true
            }
        );

        console.log(
            "Rating inserted successfully:",
            result.rowsAffected
        );

        // ==========================================
        // FOLLOW-UP BUSINESS LOGIC
        // ==========================================

        if (followUpRequired) {

            console.log(
                "⚠️ LOW RATING DETECTED"
            );

            console.log(
                "⚠️ Agent follow-up is required"
            );

            /*
             * NEXT STEP:
             *
             * Create AGENT_FOLLOW_UP record here.
             *
             * Example:
             *
             * await createFollowUp({
             *     customerId: customerIdValue,
             *     sessionId,
             *     ratingId: result.outBinds?.ratingId,
             *     rating: ratingValue,
             *     feedback,
             *     language
             * });
             */
        }

        // ==========================================
        // RETURN RESULT
        // ==========================================

        return {
            success: true,
            followUpRequired,
            followUpStatus
        };

    } catch (err) {

        console.error("Failed to save rating");
        console.error("Oracle error:", err);
        console.error("Oracle error code:", err.errorNum);
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

module.exports = {
    saveRating
};