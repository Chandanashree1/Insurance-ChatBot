const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");


// ======================================================
// CREATE POLICY FROM PAID QUOTE
// ======================================================

async function createPolicyFromQuote(quoteId) {

    let connection;

    try {

        connection = await getConnection();

        // ==================================================
        // 1. GET QUOTE
        // ==================================================

        const quoteResult = await connection.execute(
            `
            SELECT
                q.QUOTE_ID,
                q.QUOTE_NUMBER,
                q.CUSTOMER_ID,
                q.VEHICLE_ID,
                q.PRODUCT_ID,
                q.VEHICLE_VALUE,
                q.COVER_FROM,
                q.COVER_TO,
                q.QUOTE_STATUS,
                q.PAYMENT_STATUS,

                p.PRODUCT_NAME,
                p.PRODUCT_TYPE

            FROM QUOTE q

            JOIN PRODUCT p
                ON q.PRODUCT_ID = p.PRODUCT_ID

            WHERE q.QUOTE_ID = :quoteId
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
                "Cannot create policy because the quote has expired"
            );

        }


        if (quote.QUOTE_STATUS === "CONVERTED") {

            throw new Error(
                "Policy has already been created for this quote"
            );

        }


        // ==================================================
        // 3. CHECK PAYMENT
        // ==================================================

        if (quote.PAYMENT_STATUS !== "PAID") {

            throw new Error(
                "Payment must be completed before creating the policy"
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
        // 5. GENERATE POLICY NUMBER
        // ==================================================

        const policyNumberResult =
            await connection.execute(
                `
                SELECT
                    'POL-' ||
                    TO_CHAR(SYSDATE, 'YYYY') ||
                    '-' ||
                    LPAD(
                        POLICY_SEQ.NEXTVAL,
                        5,
                        '0'
                    ) AS POLICY_NUMBER
                FROM DUAL
                `,
                [],
                {
                    outFormat:
                        oracledb.OUT_FORMAT_OBJECT
                }
            );


        const policyNumber =
            policyNumberResult.rows[0].POLICY_NUMBER;


        // ==================================================
        // 6. CREATE POLICY
        // ==================================================
        //
        // POLICY table only stores foreign keys + PREMIUM +
        // COVER_FROM/COVER_TO + POLICY_STATUS. Everything else
        // (plan name, product type, sum insured) is derived via
        // JOINs when reading, not stored redundantly here.
        // ==================================================

        const policyResult =
            await connection.execute(
                `
                INSERT INTO POLICY (
                    POLICY_NUMBER,
                    QUOTE_ID,
                    CUSTOMER_ID,
                    VEHICLE_ID,
                    PRODUCT_ID,
                    OPTION_ID,
                    PREMIUM,
                    COVER_FROM,
                    COVER_TO,
                    POLICY_STATUS
                )
                VALUES (
                    :policyNumber,
                    :quoteId,
                    :customerId,
                    :vehicleId,
                    :productId,
                    :optionId,
                    :premium,
                    :coverFrom,
                    :coverTo,
                    'ACTIVE'
                )
                RETURNING POLICY_ID INTO :policyId
                `,
                {
                    policyNumber,

                    quoteId,

                    customerId:
                        quote.CUSTOMER_ID,

                    vehicleId:
                        quote.VEHICLE_ID,

                    productId:
                        quote.PRODUCT_ID,

                    optionId:
                        selectedOption.OPTION_ID,

                    premium:
                        selectedOption.PREMIUM,

                    coverFrom:
                        quote.COVER_FROM,

                    coverTo:
                        quote.COVER_TO,

                    policyId: {
                        dir: oracledb.BIND_OUT,
                        type: oracledb.NUMBER
                    }
                },
                {
                    autoCommit: false
                }
            );


        const policyId =
            policyResult.outBinds.policyId[0];


        // ==================================================
        // 7. CONVERT QUOTE
        // ==================================================

        await connection.execute(
            `
            UPDATE QUOTE

            SET QUOTE_STATUS = 'CONVERTED'

            WHERE QUOTE_ID = :quoteId
            `,
            {
                quoteId
            }
        );


        // ==================================================
        // 8. COMMIT EVERYTHING
        // ==================================================

        await connection.commit();


        // ==================================================
        // 9. RETURN RESULT
        // ==================================================

        return {

            policy: {

                policyId,

                policyNumber,

                quoteId,

                customerId:
                    quote.CUSTOMER_ID,

                vehicleId:
                    quote.VEHICLE_ID,

                productId:
                    quote.PRODUCT_ID,

                policyType:
                    quote.PRODUCT_TYPE,

                productName:
                    quote.PRODUCT_NAME,

                planName:
                    selectedOption.PLAN_NAME,

                premium:
                    selectedOption.PREMIUM,

                sumInsured:
                    quote.VEHICLE_VALUE,

                coverFrom:
                    quote.COVER_FROM,

                coverTo:
                    quote.COVER_TO,

                status:
                    "ACTIVE"

            },

            quote: {

                quoteId:
                    quote.QUOTE_ID,

                quoteNumber:
                    quote.QUOTE_NUMBER,

                quoteStatus:
                    "CONVERTED",

                paymentStatus:
                    quote.PAYMENT_STATUS

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
                    "Policy Rollback Error:",
                    rollbackError
                );

            }

        }


        console.error(
            "Create Policy Error:",
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
/*
    Get all policies belonging to a customer
*/
async function getCustomerPolicies(customerId) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(

            `
            SELECT
                pol.POLICY_ID,
                pol.POLICY_NUMBER,
                pol.QUOTE_ID,
                pol.CUSTOMER_ID,
                pol.VEHICLE_ID,
                pol.PREMIUM,
                pol.COVER_FROM,
                pol.COVER_TO,
                pol.POLICY_STATUS,
                pol.CREATED_AT,

                prod.PRODUCT_TYPE,
                prod.PRODUCT_NAME,

                qo.PLAN_NAME,

                q.VEHICLE_VALUE AS SUM_INSURED

            FROM POLICY pol

            JOIN PRODUCT prod
                ON pol.PRODUCT_ID = prod.PRODUCT_ID

            JOIN QUOTE_OPTION qo
                ON pol.OPTION_ID = qo.OPTION_ID

            JOIN QUOTE q
                ON pol.QUOTE_ID = q.QUOTE_ID

            WHERE pol.CUSTOMER_ID = :customerId

            ORDER BY pol.CREATED_AT DESC
            `,

            {
                customerId
            },

            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }

        );

        return result.rows;

    } finally {

        if (connection) {
            await connection.close();
        }

    }

}


/*
    Get one policy using policy number
*/
async function getPolicyByNumber(policyNumber) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(

            `
            SELECT
                pol.POLICY_ID,
                pol.POLICY_NUMBER,
                pol.QUOTE_ID,
                pol.CUSTOMER_ID,
                pol.VEHICLE_ID,
                pol.PREMIUM,
                pol.COVER_FROM,
                pol.COVER_TO,
                pol.POLICY_STATUS,
                pol.CREATED_AT,

                prod.PRODUCT_TYPE,
                prod.PRODUCT_NAME,

                qo.PLAN_NAME,

                q.VEHICLE_VALUE AS SUM_INSURED

            FROM POLICY pol

            JOIN PRODUCT prod
                ON pol.PRODUCT_ID = prod.PRODUCT_ID

            JOIN QUOTE_OPTION qo
                ON pol.OPTION_ID = qo.OPTION_ID

            JOIN QUOTE q
                ON pol.QUOTE_ID = q.QUOTE_ID

            WHERE pol.POLICY_NUMBER = :policyNumber
            `,

            {
                policyNumber
            },

            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }

        );

        return result.rows[0] || null;

    } finally {

        if (connection) {
            await connection.close();
        }

    }

}


module.exports = { createPolicyFromQuote, getCustomerPolicies, getPolicyByNumber };