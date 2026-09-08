const {
    processPayment
} = require("../services/paymentService");


// ======================================================
// PROCESS PAYMENT
// ======================================================

async function processPaymentController(req, res) {

    try {

        const {
            quoteId
        } = req.body;


        if (!quoteId) {

            return res.status(400).json({

                success: false,

                message: "Quote ID is required"

            });

        }


        const result =
            await processPayment(quoteId);


        return res.status(200).json({

            success: true,

            message:
                "Payment completed successfully",

            data: result

        });

    }


    catch (error) {

        console.error(
            "Payment Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}


module.exports = {
    processPaymentController
};