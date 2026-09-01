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

        // Convert customerId safely
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

        // Validate session ID
        if (!sessionId || typeof sessionId !== "string") {
            throw new Error("Invalid sessionId");
        }

        if (sessionId.length > 100) {
            throw new Error("Session ID cannot exceed 100 characters");
        }

        // Validate rating
        const ratingValue = Number(rating);

        if (
            !Number.isInteger(ratingValue) ||
            ratingValue < 1 ||
            ratingValue > 5
        ) {
            throw new Error("Rating must be an integer between 1 and 5");
        }

        const result = await connection.execute(
            `INSERT INTO CHAT_RATINGS
                (
                    CUSTOMER_ID,
                    SESSION_ID,
                    RATING,
                    FEEDBACK,
                    LANGUAGE
                )
             VALUES
                (
                    :customerId,
                    :sessionId,
                    :rating,
                    :feedback,
                    :language
                )`,
            {
                customerId: customerIdValue,
                sessionId: sessionId,
                rating: ratingValue,
                feedback: feedback || null,
                language: language || "en"
            },
            {
                autoCommit: true
            }
        );

        console.log("Rating inserted successfully:", result.rowsAffected);

        return {
            success: true
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
                console.error("Connection close error:", closeErr);
            }
        }
    }
}

module.exports = {
    saveRating
};
