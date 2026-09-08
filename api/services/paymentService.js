const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");


// ======================================================
// PROCESS PAYMENT
// ======================================================

async function processPayment(quoteId) {

    let connection;

    try {

        connection = await getConnection();


        // ==================================================
        // 1. GET QUOTE
        // ==================================================

        const quoteResult = await connection.execute(
            `
            SELECT
                QUOTE_ID,
                QUOTE_NUMBER,
                CUSTOMER_ID,
                VEHICLE_ID,
                PRODUCT_ID,
                QUOTE_STATUS,
                PAYMENT_STATUS
            FROM QUOTE
            WHERE QUOTE_ID = :quoteId
            `,
            {
                quoteId
            },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );


        if (quoteResult.rows.length === 0) {

            throw new Error("Quote not found");

        }


        const quote = quoteResult.rows[0];


        // ==================================================
        // 2. CHECK QUOTE STATUS
        // ==================================================

        if (quote.QUOTE_STATUS === "EXPIRED") {

            throw new Error(
                "This quote has expired"
            );

        }


        if (quote.QUOTE_STATUS === "CONVERTED") {

            throw new Error(
                "This quote has already been converted to a policy"
            );

        }


        // ==================================================
        // 3. CHECK PAYMENT STATUS
        // ==================================================

        if (quote.PAYMENT_STATUS === "PAID") {

            throw new Error(
                "Payment has already been completed for this quote"
            );

        }


        // ==================================================
        // 4. GET SELECTED QUOTE OPTION
        // ==================================================

        const optionResult = await connection.execute(
            `
            SELECT
                OPTION_ID,
                OPTION_NUMBER,
                PLAN_NAME,
                PREMIUM,
                COVERAGE_DETAILS,
                IS_SELECTED
            FROM QUOTE_OPTION
            WHERE QUOTE_ID = :quoteId
            AND IS_SELECTED = 'Y'
            `,
            {
                quoteId
            },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );


        if (optionResult.rows.length === 0) {

            throw new Error(
                "No quote option has been selected"
            );

        }


        const selectedOption =
            optionResult.rows[0];


        // ==================================================
        // 5. PAYMENT PROCESSING
        // ==================================================
        //
        // For now this is a successful payment simulation.
        //
        // Later we can connect the actual payment gateway.
        //
        // ==================================================

        const paymentSuccessful = true;


        if (!paymentSuccessful) {

            await connection.execute(
                `
                UPDATE QUOTE
                SET PAYMENT_STATUS = 'FAILED'
                WHERE QUOTE_ID = :quoteId
                `,
                {
                    quoteId
                }
            );


            await connection.commit();


            return {

                success: false,

                paymentStatus: "FAILED",

                quote: {

                    quoteId:
                        quote.QUOTE_ID,

                    quoteNumber:
                        quote.QUOTE_NUMBER,

                    quoteStatus:
                        quote.QUOTE_STATUS,

                    paymentStatus:
                        "FAILED"

                }

            };

        }


        // ==================================================
        // 6. UPDATE PAYMENT STATUS ONLY
        // ==================================================
        //
        // IMPORTANT:
        // QUOTE_STATUS remains PENDING here.
        //
        // It will become CONVERTED only after
        // the policy is successfully created.
        //
        // ==================================================

        await connection.execute(
            `
            UPDATE QUOTE
            SET PAYMENT_STATUS = 'PAID'
            WHERE QUOTE_ID = :quoteId
            `,
            {
                quoteId
            }
        );


        // ==================================================
        // 7. COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // 8. RETURN RESULT
        // ==================================================

        return {

            success: true,

            paymentStatus: "PAID",

            quote: {

                quoteId:
                    quote.QUOTE_ID,

                quoteNumber:
                    quote.QUOTE_NUMBER,

                quoteStatus:
                    quote.QUOTE_STATUS,

                paymentStatus:
                    "PAID"

            },

            selectedOption: {

                optionId:
                    selectedOption.OPTION_ID,

                optionNumber:
                    selectedOption.OPTION_NUMBER,

                planName:
                    selectedOption.PLAN_NAME,

                premium:
                    selectedOption.PREMIUM,

                coverageDetails:
                    selectedOption.COVERAGE_DETAILS,

                isSelected:
                    selectedOption.IS_SELECTED

            }

        };

    }


    catch (error) {

        if (connection) {

            try {

                await connection.rollback();

            }
            catch (rollbackError) {

                console.error(
                    "Payment Rollback Error:",
                    rollbackError
                );

            }

        }


        console.error(
            "Process Payment Error:",
            error
        );


        throw error;

    }


    finally {

        if (connection) {

            await connection.close();

        }

    }

}


module.exports = {
    processPayment
};