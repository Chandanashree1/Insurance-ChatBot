const { createQuote,selectQuoteOption} = require("../services/quoteService");


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


module.exports = {
    createMotorQuote,selectOption
};