const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");
const { createQuote } = require("./quoteService");
const { createPolicyFromQuote } = require("./policyService");

const RENEW_WINDOW_DAYS = 30;   // how early a customer can renew
const GRACE_DAYS = 15;          // how long after expiry they still can
const DAY_MS = 86400000;

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function bizError(message, status = 409, code = null) {
    const e = new Error(message);
    e.status = status;
    e.code = code;
    return e;
}

function daysUntil(date) {
    return Math.round((startOfDay(date) - startOfDay(new Date())) / DAY_MS);
}

function checkEligibility(row) {
    if (row.POLICY_STATUS === "CANCELLED") {
        return { eligible: false, reason: "CANCELLED" };
    }
    if (row.POLICY_STATUS === "RENEWED" || row.ALREADY_RENEWED > 0) {
        return { eligible: false, reason: "ALREADY_RENEWED" };
    }
    const days = daysUntil(row.COVER_TO);
    if (days > RENEW_WINDOW_DAYS) {
        return { eligible: false, reason: "TOO_EARLY", daysToExpiry: days };
    }
    if (days < -GRACE_DAYS) {
        return { eligible: false, reason: "LAPSED", daysToExpiry: days };
    }
    return { eligible: true, reason: null, daysToExpiry: days };
}

const BASE_SELECT = `
    SELECT
        pol.POLICY_ID, pol.POLICY_NUMBER, pol.POLICY_STATUS,
        pol.COVER_FROM, pol.COVER_TO, pol.PREMIUM, pol.PRODUCT_ID,
        prod.PRODUCT_NAME, prod.PRODUCT_TYPE,
        v.VEHICLE_ID, v.PLATE_NUMBER, v.PLATE_CODE, v.MAKE, v.MODEL, v.YEAR,
        q.VEHICLE_VALUE,
        c.FULL_NAME, c.CIVIL_ID_LICENSE_NO, c.MOBILE_NUMBER,
        (SELECT COUNT(*) FROM POLICY r
          WHERE r.RENEWED_FROM_POLICY_ID = pol.POLICY_ID) AS ALREADY_RENEWED
    FROM POLICY pol
    JOIN PRODUCT  prod ON pol.PRODUCT_ID  = prod.PRODUCT_ID
    JOIN VEHICLE  v    ON pol.VEHICLE_ID  = v.VEHICLE_ID
    JOIN QUOTE    q    ON pol.QUOTE_ID    = q.QUOTE_ID
    JOIN CUSTOMER c    ON pol.CUSTOMER_ID = c.CUSTOMER_ID
    WHERE pol.CUSTOMER_ID = :customerId
`;

function toPolicySummary(row) {
    return {
        policyId: row.POLICY_ID,
        policyNumber: row.POLICY_NUMBER,
        status: row.POLICY_STATUS,
        productType: row.PRODUCT_TYPE,
        productName: row.PRODUCT_NAME,
        premium: row.PREMIUM,
        coverFrom: row.COVER_FROM,
        coverTo: row.COVER_TO,
        lastVehicleValue: row.VEHICLE_VALUE,
        needsVehicleValue: row.PRODUCT_TYPE === "COMPREHENSIVE",
        vehicle: {
            make: row.MAKE, model: row.MODEL, year: row.YEAR,
            plateNumber: row.PLATE_NUMBER, plateCode: row.PLATE_CODE
        },
        ...checkEligibility(row)
    };
}


async function lookupPolicies({ customerId, method, plateNumber, plateCode, mobileNumber, civilId, policyNumber }) {

    let sql = BASE_SELECT;
    const binds = { customerId };

    // Plate is always applied when given (the form always gives it)
    if (plateNumber) {
        sql += ` AND v.PLATE_NUMBER = :plateNumber`;
        binds.plateNumber = String(plateNumber).trim();

        if (plateCode) {
            sql += ` AND v.PLATE_CODE = :plateCode`;
            binds.plateCode = String(plateCode).trim();
        }
    }

    if (method === "mobile") {
        sql += ` AND c.MOBILE_NUMBER = :mobileNumber`;
        binds.mobileNumber = String(mobileNumber).trim();
    } else if (method === "civil") {
        sql += ` AND c.CIVIL_ID_LICENSE_NO = :civilId`;
        binds.civilId = String(civilId).trim();
    } else if (method === "policy") {
        sql += ` AND UPPER(pol.POLICY_NUMBER) = :policyNumber`;
        binds.policyNumber = String(policyNumber).trim().toUpperCase();
    } else if (method === "plate") {
        if (!plateNumber) throw new Error("Plate number is required");
    } else {
        throw new Error("Invalid search method");
    }

    sql += ` ORDER BY pol.COVER_TO DESC FETCH FIRST 5 ROWS ONLY`;

    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(sql, binds, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });
        return result.rows.map(toPolicySummary);
    } finally {
        if (connection) await connection.close();
    }
}


// ---------- API 2: create the renewal quote ----------

async function createRenewalQuote({ customerId, policyId, vehicleValue, mobileNumber }) {

    let connection;
    try {
        connection = await getConnection();

        // Re-check everything here. Never trust the eligibility the client saw.
        const found = await connection.execute(
            BASE_SELECT + ` AND pol.POLICY_ID = :policyId`,
            { customerId, policyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (found.rows.length === 0) {
            throw bizError("Policy not found for this customer", 404);
        }

        const old = found.rows[0];
        const eligibility = checkEligibility(old);

        if (!eligibility.eligible) {
            throw bizError(`This policy cannot be renewed (${eligibility.reason})`);
        }

        if (old.PRODUCT_TYPE === "COMPREHENSIVE" &&
            (!vehicleValue || Number(vehicleValue) <= 0)) {
            throw bizError("Vehicle value is required to renew a Comprehensive policy");
        }

        // New period starts the day after the old one ends (or today if it already ended)
        const oldEnd = startOfDay(old.COVER_TO);
        const coverFrom = daysUntil(oldEnd) >= 0
            ? new Date(oldEnd.getTime() + DAY_MS)
            : startOfDay(new Date());
        const coverTo = new Date(coverFrom);
        coverTo.setFullYear(coverTo.getFullYear() + 1);

        // Reuse the existing quote + 4 plans logic
        const result = await createQuote({
            mobileNumber: old.MOBILE_NUMBER || mobileNumber,
            fullName: old.FULL_NAME,
            civilIdLicenseNo: old.CIVIL_ID_LICENSE_NO,
            plateNumber: old.PLATE_NUMBER,
            plateCode: old.PLATE_CODE,
            productId: old.PRODUCT_TYPE,
            vehicleValue: old.PRODUCT_TYPE === "COMPREHENSIVE" ? Number(vehicleValue) : undefined
        });

        // Mark it as a renewal, tie it to this customer, and set the renewal dates
        await connection.execute(
            `UPDATE QUOTE
                SET QUOTE_TYPE = 'RENEWAL',
                    ORIGINAL_POLICY_ID = :policyId,
                    CUSTOMER_ID = :customerId,
                    COVER_FROM = :coverFrom,
                    COVER_TO = :coverTo
              WHERE QUOTE_ID = :quoteId`,
            {
                policyId, customerId, coverFrom, coverTo,
                quoteId: result.quote.quoteId
            },
            { autoCommit: true }
        );

        result.quote.quoteType = "RENEWAL";
        result.quote.originalPolicyNumber = old.POLICY_NUMBER;
        result.quote.coverFrom = coverFrom;
        result.quote.coverTo = coverTo;

        return result;

    } finally {
        if (connection) await connection.close();
    }
}

async function payRenewalQuote({ customerId, quoteId, optionId }) {

    let connection;
    try {
        connection = await getConnection();
        const opts = { outFormat: oracledb.OUT_FORMAT_OBJECT };

        const q = await connection.execute(
            `SELECT QUOTE_TYPE, QUOTE_STATUS FROM QUOTE
              WHERE QUOTE_ID = :quoteId AND CUSTOMER_ID = :customerId`,
            { quoteId, customerId }, opts
        );
        if (q.rows.length === 0) throw bizError("Quote not found for this customer", 404);
        if (q.rows[0].QUOTE_TYPE !== "RENEWAL") throw bizError("This is not a renewal quote", 400);
        if (q.rows[0].QUOTE_STATUS !== "PENDING") throw bizError("This quote has already been used", 409);

        const o = await connection.execute(
            `SELECT OPTION_ID FROM QUOTE_OPTION WHERE OPTION_ID = :optionId AND QUOTE_ID = :quoteId`,
            { optionId, quoteId }, opts
        );
        if (o.rows.length === 0) throw bizError("Invalid plan for this quote", 400);

        await connection.execute(
            `UPDATE QUOTE_OPTION
                SET IS_SELECTED = CASE WHEN OPTION_ID = :optionId THEN 'Y' ELSE 'N' END
              WHERE QUOTE_ID = :quoteId`,
            { optionId, quoteId }
        );
        await connection.execute(
            `UPDATE QUOTE SET PAYMENT_STATUS = 'PAID' WHERE QUOTE_ID = :quoteId`,
            { quoteId }
        );
        await connection.commit();
    } finally {
        if (connection) await connection.close();
    }

    // creates the policy, saves RENEWED_FROM_POLICY_ID, marks the old policy RENEWED
    return await createPolicyFromQuote(quoteId);
}

module.exports = { lookupPolicies, createRenewalQuote, payRenewalQuote };