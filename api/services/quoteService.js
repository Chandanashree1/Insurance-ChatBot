const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");

// const { checkStpEligibility } = require("./underwritingService");


// ======================================================
// 1. FIND OR CREATE CUSTOMER
// ======================================================

async function findOrCreateCustomer(
    connection,
    mobileNumber,
    fullName,
    civilIdLicenseNo
) {

    const existingCustomer = await connection.execute(
        `
        SELECT CUSTOMER_ID
        FROM CUSTOMER
        WHERE MOBILE_NUMBER = :mobileNumber
        `,
        {
            mobileNumber
        },
        {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        }
    );


    // Customer already exists
    if (existingCustomer.rows.length > 0) {

        return existingCustomer.rows[0].CUSTOMER_ID;

    }


    // Create new customer
    const result = await connection.execute(
        `
        INSERT INTO CUSTOMER (
            MOBILE_NUMBER,
            FULL_NAME,
            CIVIL_ID_LICENSE_NO
        )
        VALUES (
            :mobileNumber,
            :fullName,
            :civilIdLicenseNo
        )
        RETURNING CUSTOMER_ID INTO :customerId
        `,
        {
            mobileNumber,
            fullName,
            civilIdLicenseNo,

            customerId: {
                dir: oracledb.BIND_OUT,
                type: oracledb.NUMBER
            }
        }
    );


    return result.outBinds.customerId[0];

}



// ======================================================
// 2. FIND VEHICLE
// ======================================================

async function findVehicle(
    connection,
    plateNumber,
    plateCode
) {

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

        throw new Error(
            "Vehicle not found for the provided plate number and plate code"
        );

    }


    return result.rows[0];

}



// ======================================================
// 3. GET PRODUCT
// ======================================================

async function getProduct(
    connection,
    productType
) {

    const normalized =
        String(productType || "")
            .trim()
            .toUpperCase()
            .replace(/-/g, "_")
            .replace(/\s+/g, "_");

    const result = await connection.execute(
        `
        SELECT
            PRODUCT_ID,
            PRODUCT_NAME,
            PRODUCT_TYPE
        FROM PRODUCT
        WHERE UPPER(PRODUCT_TYPE) = :productType
        `,
        {
            productType: normalized
        },
        {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        }
    );


    if (result.rows.length === 0) {

        throw new Error(
            `Product not found for type: ${productType}`
        );

    }


    return result.rows[0];

}


// ======================================================
// 4. CREATE QUOTE
// ======================================================

async function createQuote(data) {

    let connection;

    try {

        connection = await getConnection();


        const {
            mobileNumber,
            fullName,
            civilIdLicenseNo,
            plateNumber,
            plateCode,
            productId,
            vehicleValue
        } = data;



        // ==================================================
        // STEP 1 — FIND / CREATE CUSTOMER
        // ==================================================

        const customerId = await findOrCreateCustomer(
            connection,
            mobileNumber,
            fullName,
            civilIdLicenseNo
        );



        // ==================================================
        // STEP 2 — FIND VEHICLE
        // ==================================================

        const vehicle = await findVehicle(
            connection,
            plateNumber,
            plateCode
        );



        // ==================================================
        // STEP 3 — GET PRODUCT
        // ==================================================

        const product = await getProduct(
            connection,
            productId
        );



        // ==================================================
        // STEP 4 — VALIDATE VEHICLE VALUE
        // ==================================================

        let finalVehicleValue = null;


        if (
            product.PRODUCT_TYPE &&
            product.PRODUCT_TYPE.toUpperCase() === "COMPREHENSIVE"
        ) {

            if (
                vehicleValue === undefined ||
                vehicleValue === null ||
                vehicleValue === ""
            ) {

                throw new Error(
                    "Vehicle value is required for Comprehensive Insurance"
                );

            }


            finalVehicleValue = Number(vehicleValue);


            if (
                Number.isNaN(finalVehicleValue) ||
                finalVehicleValue <= 0
            ) {

                throw new Error(
                    "Vehicle value must be a valid positive number"
                );

            }

        }



        // ==================================================
        // STEP 5 — COVER PERIOD
        // ==================================================

        const coverFrom = new Date();

        const coverTo = new Date(coverFrom);

        coverTo.setFullYear(
            coverTo.getFullYear() + 1
        );



        // ==================================================
        // STEP 6 — CREATE QUOTE
        // ==================================================
        //
        // IMPORTANT:
        //
        // We DON'T try to calculate QUOTE_NUMBER before
        // inserting the quote.
        //
        // Oracle generates QUOTE_ID first.
        //
        // Example:
        //
        // QUOTE_ID = 5
        //
        // Then:
        //
        // QT-2026-00005
        //
        // This avoids ORA-01722.
        //
        // ==================================================
        const quoteInsert = await connection.execute(
            `
            INSERT INTO QUOTE (
                QUOTE_NUMBER,
                CUSTOMER_ID,
                VEHICLE_ID,
                PRODUCT_ID,
                VEHICLE_VALUE,
                COVER_FROM,
                COVER_TO,
                QUOTE_STATUS,
                PAYMENT_STATUS
            )
            VALUES (
                'TEMP',
                :customerId,
                :vehicleId,
                :productId,
                :vehicleValue,
                :coverFrom,
                :coverTo,
                'PENDING',
                'NOT_PAID'
            )
            RETURNING QUOTE_ID INTO :quoteId
            `,
            {
                customerId,

                vehicleId:
                    vehicle.VEHICLE_ID,

                productId:product.PRODUCT_ID,

                vehicleValue:
                    finalVehicleValue,

                coverFrom,

                coverTo,

                quoteId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            },
            {
                autoCommit: false
            }
        );


        const quoteId =
            quoteInsert.outBinds.quoteId[0];



        // ==================================================
        // STEP 7 — GENERATE QUOTE NUMBER
        // ==================================================

        const currentYear =
            new Date().getFullYear();


        const quoteNumber =
            `QT-${currentYear}-${String(quoteId).padStart(5, "0")}`;



        // ==================================================
        // STEP 8 — UPDATE QUOTE NUMBER
        // ==================================================

        await connection.execute(
            `
            UPDATE QUOTE
            SET QUOTE_NUMBER = :quoteNumber
            WHERE QUOTE_ID = :quoteId
            `,
            {
                quoteNumber,
                quoteId
            },
            {
                autoCommit: false
            }
        );



        // ==================================================
        // STEP 9 — GENERATE 4 PREMIUM OPTIONS
        // ==================================================

        let options;



        // --------------------------------------------------
        // THIRD PARTY
        // --------------------------------------------------

        if (
            product.PRODUCT_TYPE &&
            product.PRODUCT_TYPE.toUpperCase() === "THIRD_PARTY"
        ) {

            options = [

                {
                    number: 1,

                    planName:
                        "Basic + Driver + Family (PAB) + UAE + RSA",

                    premium:
                        65.600,

                    details:
                        "Basic coverage with Driver, Family (PAB), UAE and RSA"
                },

                {
                    number: 2,

                    planName:
                        "Basic + Driver + Family (PAB) + UAE",

                    premium:
                        62.500,

                    details:
                        "Basic coverage with Driver, Family (PAB) and UAE"
                },

                {
                    number: 3,

                    planName:
                        "Basic + Driver + Family (PAB)",

                    premium:
                        60.400,

                    details:
                        "Basic coverage with Driver and Family (PAB)"
                },

                {
                    number: 4,

                    planName:
                        "Basic + Driver + Family (PAB) + RSA",

                    premium:
                        63.500,

                    details:
                        "Basic coverage with Driver, Family (PAB) and RSA"
                }

            ];

        }



        // --------------------------------------------------
        // COMPREHENSIVE
        // --------------------------------------------------

        else if (
            product.PRODUCT_TYPE &&
            product.PRODUCT_TYPE.toUpperCase() === "COMPREHENSIVE"
        ) {

            const baseValue =
                Number(finalVehicleValue);


            options = [

                {
                    number: 1,

                    planName:
                        "Comprehensive + UAE + RSA",

                    premium:
                        Number(
                            (baseValue * 0.035).toFixed(3)
                        ),

                    details:
                        "Comprehensive coverage with UAE and RSA"
                },

                {
                    number: 2,

                    planName:
                        "Comprehensive + UAE",

                    premium:
                        Number(
                            (baseValue * 0.032).toFixed(3)
                        ),

                    details:
                        "Comprehensive coverage with UAE"
                },

                {
                    number: 3,

                    planName:
                        "Comprehensive + RSA",

                    premium:
                        Number(
                            (baseValue * 0.030).toFixed(3)
                        ),

                    details:
                        "Comprehensive coverage with RSA"
                },

                {
                    number: 4,

                    planName:
                        "Comprehensive Basic",

                    premium:
                        Number(
                            (baseValue * 0.028).toFixed(3)
                        ),

                    details:
                        "Basic comprehensive coverage"
                }

            ];

        }



        // --------------------------------------------------
        // UNKNOWN PRODUCT TYPE
        // --------------------------------------------------

        else {

            throw new Error(
                `Unsupported product type: ${product.PRODUCT_TYPE}`
            );

        }



        // ==================================================
        // STEP 10 — INSERT 4 QUOTE OPTIONS
        // ==================================================

       // ==================================================
// STEP 10 — INSERT 4 QUOTE OPTIONS
// ==================================================

const savedOptions = [];

for (const option of options) {

    const optionInsert = await connection.execute(
        `
        INSERT INTO QUOTE_OPTION (
            QUOTE_ID,
            OPTION_NUMBER,
            PLAN_NAME,
            PREMIUM,
            COVERAGE_DETAILS,
            IS_SELECTED
        )
        VALUES (
            :quoteId,
            :optionNumber,
            :planName,
            :premium,
            :coverageDetails,
            'N'
        )
        RETURNING OPTION_ID INTO :optionId
        `,
        {
            quoteId,

            optionNumber:
                option.number,

            planName:
                option.planName,

            premium:
                option.premium,

            coverageDetails:
                option.details,

            optionId: {
                dir: oracledb.BIND_OUT,
                type: oracledb.NUMBER
            }
        },
        {
            autoCommit: false
        }
    );

    savedOptions.push({
        optionId: optionInsert.outBinds.optionId[0],

        optionNumber: option.number,

        planName: option.planName,

        premium: option.premium,

        details: option.details
    });
}



        // ==================================================
        // STEP 11 — COMMIT
        // ==================================================

        await connection.commit();



        // ==================================================
        // STEP 12 — RETURN COMPLETE RESULT
        // ==================================================

        return {

            quote: {

                quoteId,

                quoteNumber,

                customerId,

                vehicleId:
                    vehicle.VEHICLE_ID,

                productId:product.PRODUCT_ID,

                productName:
                    product.PRODUCT_NAME,

                productType:
                    product.PRODUCT_TYPE,

                vehicleValue:
                    finalVehicleValue,

                coverFrom,

                coverTo,

                quoteStatus:
                    "PENDING",

                paymentStatus:
                    "NOT_PAID"

            },


            vehicle: {

                vehicleId:
                    vehicle.VEHICLE_ID,

                plateNumber:
                    vehicle.PLATE_NUMBER,

                plateCode:
                    vehicle.PLATE_CODE,

                plateType:
                    vehicle.PLATE_TYPE,

                make:
                    vehicle.MAKE,

                model:
                    vehicle.MODEL,

                year:
                    vehicle.YEAR,

                chassisNumber:
                    vehicle.CHASSIS_NUMBER,

                bodyType:
                    vehicle.BODY_TYPE,

                usageType:
                    vehicle.USAGE_TYPE

            },


            options: savedOptions

        };

    }


    catch (error) {

        if (connection) {

            try {

                await connection.rollback();

            }
            catch (rollbackError) {

                console.error(
                    "Rollback Error:",
                    rollbackError
                );

            }

        }


        console.error(
            "Create Quote Error:",
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
// ======================================================
// SELECT QUOTE OPTION
// ======================================================


async function selectQuoteOption(quoteId, optionId) {

    let connection;

    try {

        connection = await getConnection();

        // --------------------------------------------------
        // 1. CHECK QUOTE
        // --------------------------------------------------

        const quoteResult = await connection.execute(
            `
            SELECT
                QUOTE_ID,
                QUOTE_NUMBER,
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


        // --------------------------------------------------
        // 2. CHECK QUOTE OPTION
        // --------------------------------------------------

        const optionResult = await connection.execute(
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
            WHERE OPTION_ID = :optionId
            AND QUOTE_ID = :quoteId
            `,
            {
                optionId,
                quoteId
            },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );


        if (optionResult.rows.length === 0) {

            throw new Error(
                "Quote option not found for this quote"
            );

        }


        const selectedOption = optionResult.rows[0];


        // --------------------------------------------------
        // 3. RESET ALL OPTIONS
        // --------------------------------------------------

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


        // --------------------------------------------------
        // 4. SELECT THE CUSTOMER'S OPTION
        // --------------------------------------------------

        await connection.execute(
            `
            UPDATE QUOTE_OPTION
            SET IS_SELECTED = 'Y'
            WHERE OPTION_ID = :optionId
            AND QUOTE_ID = :quoteId
            `,
            {
                optionId,
                quoteId
            }
        );


        // --------------------------------------------------
        // 5. KEEP QUOTE PENDING
        // --------------------------------------------------

        await connection.execute(
            `
            UPDATE QUOTE
            SET
                QUOTE_STATUS = 'PENDING',
                PAYMENT_STATUS = 'NOT_PAID'
            WHERE QUOTE_ID = :quoteId
            `,
            {
                quoteId
            }
        );


        // --------------------------------------------------
        // 6. COMMIT
        // --------------------------------------------------

        await connection.commit();


        // --------------------------------------------------
        // 7. RETURN SELECTED OPTION
        // --------------------------------------------------

        return {

            stp: true,

            quote: {
                quoteId: quote.QUOTE_ID,
                quoteNumber: quote.QUOTE_NUMBER,
                quoteStatus: "PENDING",
                paymentStatus: "NOT_PAID"
            },

            selectedOption: {
                optionId: selectedOption.OPTION_ID,
                optionNumber: selectedOption.OPTION_NUMBER,
                planName: selectedOption.PLAN_NAME,
                premium: selectedOption.PREMIUM,
                coverageDetails: selectedOption.COVERAGE_DETAILS,
                isSelected: "Y"
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
                    "Rollback Error:",
                    rollbackError
                );

            }

        }


        console.error(
            "Select Quote Option Error:",
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
    createQuote,selectQuoteOption
};