const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");

/*
=========================================================
CUSTOMER
=========================================================
*/

/**
 * Find an existing customer using mobile number or
 * Civil ID / License number.
 */
async function findCustomer(mobileNumber, civilIdLicenseNo) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                CUSTOMER_ID,
                MOBILE_NUMBER,
                FULL_NAME,
                CIVIL_ID_LICENSE_NO,
                EMAIL,
                CREATED_AT
            FROM CUSTOMER
            WHERE MOBILE_NUMBER = :mobileNumber
               OR CIVIL_ID_LICENSE_NO = :civilIdLicenseNo
            `,
            {
                mobileNumber,
                civilIdLicenseNo
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


/**
 * Create a new customer.
 */
async function createCustomer({
    mobileNumber,
    fullName,
    civilIdLicenseNo,
    email
}) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            INSERT INTO CUSTOMER (
                MOBILE_NUMBER,
                FULL_NAME,
                CIVIL_ID_LICENSE_NO,
                EMAIL
            )
            VALUES (
                :mobileNumber,
                :fullName,
                :civilIdLicenseNo,
                :email
            )
            RETURNING CUSTOMER_ID INTO :customerId
            `,
            {
                mobileNumber,
                fullName,
                civilIdLicenseNo,
                email: email || null,
                customerId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            },
            {
                autoCommit: true
            }
        );

        return {
            customerId: result.outBinds.customerId[0]
        };

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/*
=========================================================
VEHICLE
=========================================================
*/

/**
 * Find vehicle using plate number + plate code.
 *
 * This is the first API operation we will test.
 */
async function getVehicle(plateNumber, plateCode) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                VEHICLE_ID,
                CUSTOMER_ID,
                PLATE_NUMBER,
                PLATE_CODE,
                PLATE_TYPE,
                MAKE,
                MODEL,
                YEAR,
                CHASSIS_NUMBER,
                BODY_TYPE,
                USAGE_TYPE
            FROM VEHICLE
            WHERE PLATE_NUMBER = :plateNumber
              AND PLATE_CODE = :plateCode
            `,
            {
                plateNumber,
                plateCode
            },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/*
=========================================================
PRODUCT
=========================================================
*/

/**
 * Get available insurance products.
 *
 * Example:
 * Comprehensive Insurance
 * Third Party Insurance
 */
async function getProducts() {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                PRODUCT_ID,
                PRODUCT_NAME,
                PRODUCT_TYPE
            FROM PRODUCT
            ORDER BY PRODUCT_ID
            `,
            [],
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
=========================================================
QUOTE
=========================================================
*/

/**
 * Create a new quote.
 */
async function createQuote({
    quoteNumber,
    customerId,
    vehicleId,
    productId,
    vehicleValue,
    coverFrom,
    coverTo
}) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            INSERT INTO QUOTE (
                QUOTE_NUMBER,
                CUSTOMER_ID,
                VEHICLE_ID,
                PRODUCT_ID,
                VEHICLE_VALUE,
                COVER_FROM,
                COVER_TO
            )
            VALUES (
                :quoteNumber,
                :customerId,
                :vehicleId,
                :productId,
                :vehicleValue,
                :coverFrom,
                :coverTo
            )
            RETURNING QUOTE_ID INTO :quoteId
            `,
            {
                quoteNumber,
                customerId,
                vehicleId,
                productId,
                vehicleValue: vehicleValue || null,
                coverFrom,
                coverTo,
                quoteId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            },
            {
                autoCommit: true
            }
        );

        return {
            quoteId: result.outBinds.quoteId[0],
            quoteNumber
        };

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/**
 * Look up a quote by its quote number, scoped to the customer
 * for the same reason as getPolicyByNumber above.
 */
async function getQuoteByNumber(quoteNumber, customerId) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
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
                pr.PRODUCT_NAME,
                pr.PRODUCT_TYPE,
                v.MAKE,
                v.MODEL,
                v.YEAR,
                v.PLATE_NUMBER,
                v.PLATE_CODE
            FROM QUOTE q
            LEFT JOIN PRODUCT pr ON pr.PRODUCT_ID = q.PRODUCT_ID
            LEFT JOIN VEHICLE v ON v.VEHICLE_ID = q.VEHICLE_ID
            WHERE q.QUOTE_NUMBER = :quoteNumber
              AND q.CUSTOMER_ID = :customerId
            `,
            {
                quoteNumber,
                customerId
            },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/**
 * Get the four premium options for a quote.
 */
async function getQuoteOptions(quoteId) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                OPTION_ID,
                QUOTE_ID,
                OPTION_NUMBER,
                PLAN_NAME,
                PREMIUM,
                COVERAGE_DETAILS,
                IS_SELECTED
            FROM QUOTE_OPTION
            WHERE QUOTE_ID = :quoteId
            ORDER BY OPTION_NUMBER
            `,
            {
                quoteId
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


/**
 * Select exactly one quote option.
 */
async function selectQuoteOption(quoteId, optionNumber) {
    let connection;

    try {
        connection = await getConnection();

        // First unselect all options for this quote.
        await connection.execute(
            `
            UPDATE QUOTE_OPTION
            SET IS_SELECTED = 'N'
            WHERE QUOTE_ID = :quoteId
            `,
            {
                quoteId
            }
        );

        // Select the requested option.
        const result = await connection.execute(
            `
            UPDATE QUOTE_OPTION
            SET IS_SELECTED = 'Y'
            WHERE QUOTE_ID = :quoteId
              AND OPTION_NUMBER = :optionNumber
            `,
            {
                quoteId,
                optionNumber
            }
        );

        if (result.rowsAffected === 0) {
            await connection.rollback();

            return null;
        }

        await connection.commit();

        return {
            success: true,
            quoteId,
            optionNumber
        };

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        throw error;

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/**
 * Get the selected option for a quote.
 */
async function getSelectedQuoteOption(quoteId) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                OPTION_ID,
                QUOTE_ID,
                OPTION_NUMBER,
                PLAN_NAME,
                PREMIUM,
                COVERAGE_DETAILS
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

        return result.rows.length > 0
            ? result.rows[0]
            : null;

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/*
=========================================================
PAYMENT
=========================================================
*/

/**
 * Update quote payment status.
 *
 * For Demo 2 we are simulating payment.
 */
async function updatePaymentStatus(quoteId, paymentStatus) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            UPDATE QUOTE
            SET PAYMENT_STATUS = :paymentStatus
            WHERE QUOTE_ID = :quoteId
            `,
            {
                quoteId,
                paymentStatus
            },
            {
                autoCommit: true
            }
        );

        return {
            success: result.rowsAffected > 0
        };

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/*
=========================================================
POLICY
=========================================================
*/

/**
 * Look up a policy by its policy number.
 *
 * IMPORTANT: scoped to customerId on purpose. This is what
 * the policy-status agent calls, so it must be impossible
 * for it to return a policy belonging to someone else, even
 * if the caller supplies (or the LLM hallucinates) a
 * different customer's real policy number.
 *
 * NOTE: joins PRODUCT / QUOTE_OPTION / VEHICLE for a richer
 * status view. Verify these column names against your actual
 * schema (POLICY_STATUS / CREATED_AT etc. aren't in the INSERT
 * list above, so they're left out here — add them if they exist).
 */
async function getPolicyByNumber(policyNumber, customerId) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                p.POLICY_ID,
                p.POLICY_NUMBER,
                p.CUSTOMER_ID,
                p.PREMIUM,
                p.COVER_FROM,
                p.COVER_TO,
                pr.PRODUCT_NAME,
                pr.PRODUCT_TYPE,
                qo.PLAN_NAME,
                qo.COVERAGE_DETAILS,
                v.MAKE,
                v.MODEL,
                v.YEAR,
                v.PLATE_NUMBER,
                v.PLATE_CODE
            FROM POLICY p
            LEFT JOIN PRODUCT pr ON pr.PRODUCT_ID = p.PRODUCT_ID
            LEFT JOIN QUOTE_OPTION qo ON qo.OPTION_ID = p.OPTION_ID
            LEFT JOIN VEHICLE v ON v.VEHICLE_ID = p.VEHICLE_ID
            WHERE p.POLICY_NUMBER = :policyNumber
              AND p.CUSTOMER_ID = :customerId
            `,
            {
                policyNumber,
                customerId
            },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/**
 * Create policy after successful payment.
 */
async function createPolicy({
    policyNumber,
    quoteId,
    customerId,
    vehicleId,
    productId,
    optionId,
    premium,
    coverFrom,
    coverTo
}) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
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
                COVER_TO
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
                :coverTo
            )
            RETURNING POLICY_ID INTO :policyId
            `,
            {
                policyNumber,
                quoteId,
                customerId,
                vehicleId,
                productId,
                optionId,
                premium,
                coverFrom,
                coverTo,
                policyId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            },
            {
                autoCommit: true
            }
        );

        return {
            policyId: result.outBinds.policyId[0],
            policyNumber
        };

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/**
 * Update quote after successful payment.
 */
async function convertQuote(quoteId) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            UPDATE QUOTE
            SET
                QUOTE_STATUS = 'CONVERTED',
                PAYMENT_STATUS = 'PAID'
            WHERE QUOTE_ID = :quoteId
            `,
            {
                quoteId
            },
            {
                autoCommit: true
            }
        );

        return {
            success: result.rowsAffected > 0
        };

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    // Customer
    findCustomer,
    createCustomer,

    // Vehicle
    getVehicle,

    // Product
    getProducts,

    // Quote
    getQuoteByNumber,
    createQuote,
    getQuoteOptions,
    selectQuoteOption,
    getSelectedQuoteOption,

    // Payment
    updatePaymentStatus,

    // Policy
    getPolicyByNumber,
    createPolicy,
    convertQuote

};