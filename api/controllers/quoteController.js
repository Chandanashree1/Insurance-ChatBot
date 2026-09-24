const { createQuote,selectQuoteOption} = require("../services/quoteService");
const { submitProposalForUnderwriting } = require("../services/underwritingService");
const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");
const { verifyKycAgainstDb } = require("../services/kycService");


// ======================================================
// CREATE MOTOR INSURANCE QUOTE
// ======================================================

async function createMotorQuote(req, res) {

    try {

        const {
            mobileNumber,
            fullName,
            civilIdLicenseNo,
            plateNumber,
            plateCode,
            productId,
            vehicleValue
        } = req.body;


        // --------------------------------------------------
        // BASIC VALIDATION
        // --------------------------------------------------

        if (!mobileNumber) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required"
            });
        }

        if (!fullName) {
            return res.status(400).json({
                success: false,
                message: "Full name is required"
            });
        }

        if (!civilIdLicenseNo) {
            return res.status(400).json({
                success: false,
                message: "Civil ID / License number is required"
            });
        }

        if (!plateNumber) {
            return res.status(400).json({
                success: false,
                message: "Plate number is required"
            });
        }

        if (!plateCode) {
            return res.status(400).json({
                success: false,
                message: "Plate code is required"
            });
        }

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product is required"
            });
        }


        // --------------------------------------------------
        // CREATE QUOTE
        // --------------------------------------------------

        const result = await createQuote({

            mobileNumber,
            fullName,
            civilIdLicenseNo,

            plateNumber,
            plateCode,

            productId,

            vehicleValue

        });


        // --------------------------------------------------
        // SUCCESS RESPONSE
        // --------------------------------------------------

        return res.status(201).json({

            success: true,

            message: "Quote generated successfully",

            data: result

        });

    }

    catch (error) {

        console.error(
            "Quote Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}



async function verifyKyc(req, res) {
    try {
        const { civilIdLicenseNo } = req.body;

        if (!civilIdLicenseNo) {
            return res.status(400).json({ success: false, message: "civilIdLicenseNo is required" });
        }

        const result = await verifyKycAgainstDb(civilIdLicenseNo);

        return res.status(200).json({
            success: true,
            verified: result.verified,
            reason: result.reason
        });

    } catch (err) {
        console.error("Verify KYC Error:", err);
        return res.status(500).json({ success: false, message: "KYC verification failed" });
    }
}
// ======================================================
// SELECT QUOTE OPTION
// ======================================================

async function selectOption(req, res) {

    try {

        const {
            quoteId,
            optionId
        } = req.body;


        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        if (!quoteId) {

            return res.status(400).json({

                success: false,

                message: "Quote ID is required"

            });

        }


        if (!optionId) {

            return res.status(400).json({

                success: false,

                message: "Option ID is required"

            });

        }


        // --------------------------------------------------
        // SELECT OPTION
        // --------------------------------------------------

        const result =
            await selectQuoteOption(
                quoteId,
                optionId
            );


        return res.status(200).json({

            success: true,

            message:
                "Quote option selected successfully",

            data: result

        });

    }

    catch (error) {

        console.error(
            "Select Option Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}

// controllers/quoteController.js


async function escalateKycFailure(req, res) {
    try {
        const quoteResult = await createQuote(req.body);
        const quoteId = quoteResult.quote.quoteId;
        const firstOption = quoteResult.options[0];

        await selectQuoteOption(quoteId, firstOption.optionId);

        const proposal = await submitProposalForUnderwriting(
            quoteId,
            firstOption.optionId,
            "KYC verification failed",
            "KYC_FAILED"
        );

        return res.status(201).json({
            success: true,
            data: {
                quoteId,
                quoteNumber: quoteResult.quote.quoteNumber,
                proposal
            }
        });

    } catch (err) {
        console.error("Escalate KYC Failure Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}


async function getAllQuotes(req, res) {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                q.QUOTE_ID,
                q.QUOTE_NUMBER,
                q.QUOTE_STATUS,
                q.PAYMENT_STATUS,
                c.FULL_NAME AS CUSTOMER_NAME,
                qo.PLAN_NAME,
                qo.PREMIUM
            FROM QUOTE q
            JOIN CUSTOMER c ON q.CUSTOMER_ID = c.CUSTOMER_ID
            LEFT JOIN QUOTE_OPTION qo ON qo.QUOTE_ID = q.QUOTE_ID AND qo.IS_SELECTED = 'Y'
            ORDER BY q.CREATED_AT DESC
            `,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return res.status(200).json({
            success: true,
            data: result.rows.map(row => ({
                quoteId: row.QUOTE_ID,
                quoteNumber: row.QUOTE_NUMBER,
                customerName: row.CUSTOMER_NAME,
                planName: row.PLAN_NAME,
                premium: row.PREMIUM,
                status: row.QUOTE_STATUS
            }))
        });

    } catch (err) {
        console.error("Get All Quotes Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch quotes" });
    } finally {
        if (connection) await connection.close();
    }
}




module.exports = {
    createMotorQuote,selectOption, getAllQuotes,escalateKycFailure,verifyKyc
};