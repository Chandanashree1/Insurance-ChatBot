const { saveRating } = require("../services/ratingService");

async function submitRating(req, res) {
    try {
        console.log("Rating request body:", req.body);

        const {
            customerId,
            sessionId,
            rating,
            feedback,
            language
        } = req.body;

        // -------------------------
        // Validate session ID
        // -------------------------
        if (
            sessionId === undefined ||
            sessionId === null ||
            sessionId === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Session ID is required"
            });
        }

        // -------------------------
        // Validate rating
        // -------------------------
        const ratingNum = Number(rating);

        if (
            !Number.isInteger(ratingNum) ||
            ratingNum < 1 ||
            ratingNum > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "Rating must be an integer between 1 and 5"
            });
        }

        // -------------------------
        // Validate customer ID
        // -------------------------
        let customerIdValue = null;

        if (
            customerId !== undefined &&
            customerId !== null &&
            customerId !== ""
        ) {
            const customerIdNum = Number(customerId);

            if (!Number.isInteger(customerIdNum)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid customer ID"
                });
            }

            customerIdValue = customerIdNum;
        }

        // -------------------------
        // Save rating
        // -------------------------
        await saveRating(
            customerIdValue,
            sessionId,
            ratingNum,
            feedback,
            language || "en"
        );

        return res.status(201).json({
            success: true,
            message: "Rating submitted successfully"
        });

    }

 catch (err) {
    console.error("Submit rating error:", err);

    if (err.errorNum === 1) { // ORA-00001 unique constraint
        return res.status(409).json({
            success: false,
            message: "This session has already been rated."
        });
    }

    return res.status(500).json({
        success: false,
        message: err.message || "Failed to submit rating"
    });
}}

module.exports = {
    submitRating
};
