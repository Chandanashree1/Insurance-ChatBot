const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");

/*
=========================================================
STP THRESHOLD
=========================================================

Claims at or under this amount are auto-approved (STP).
Anything above goes to PENDING for underwriter review.
A single named constant, same spirit as the hardcoded quote
options in quoteService.js - easy to find and change later
once real underwriting rules are involved.
=========================================================
*/

const STP_CLAIM_THRESHOLD = 500;


/*
=========================================================
ADMIN POLICY LOOKUP (UNDERWRITER-ONLY)
=========================================================

IMPORTANT: this is intentionally NOT scoped to a customerId,
because there is no real underwriter account in the DB - the
underwriter dashboard login is frontend-only. Resolving the
policy (and therefore the customer the claim belongs to) is
what makes that acceptable here.

This function must NEVER be called from the customer-facing
chat agent or any customer-reachable route. It is wired only
into the underwriter claim-filing endpoint. The customer-facing
agent continues to use oracleservice.js's getPolicyByNumber,
which IS scoped to customerId.
=========================================================
*/

async function getPolicyByNumberAdmin(policyNumber) {
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
                c.FULL_NAME AS CUSTOMER_NAME,
                c.MOBILE_NUMBER,
                v.MAKE,
                v.MODEL,
                v.YEAR,
                v.PLATE_NUMBER,
                v.PLATE_CODE
            FROM POLICY p
            LEFT JOIN PRODUCT pr ON pr.PRODUCT_ID = p.PRODUCT_ID
            LEFT JOIN CUSTOMER c ON c.CUSTOMER_ID = p.CUSTOMER_ID
            LEFT JOIN VEHICLE v ON v.VEHICLE_ID = p.VEHICLE_ID
            WHERE p.POLICY_NUMBER = :policyNumber
            `,
            { policyNumber },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows[0] || null;

    } finally {
        if (connection) await connection.close();
    }
}


/*
=========================================================
FILE A CLAIM
=========================================================
*/

async function submitClaim({
    policyNumber,
    incidentDate,
    description,
    claimAmount,
    imagePath
}) {
    let connection;

    try {
        connection = await getConnection();

        // --------------------------------------------------
        // 1. RESOLVE POLICY -> CUSTOMER
        // --------------------------------------------------

        const policyResult = await connection.execute(
            `
            SELECT POLICY_ID, CUSTOMER_ID
            FROM POLICY
            WHERE POLICY_NUMBER = :policyNumber
            `,
            { policyNumber },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (policyResult.rows.length === 0) {
            throw new Error(
                `No policy found with number: ${policyNumber}`
            );
        }

        const { POLICY_ID, CUSTOMER_ID } = policyResult.rows[0];


        // --------------------------------------------------
        // 2. DECIDE STP vs NON-STP
        // --------------------------------------------------

        const amount = Number(claimAmount);

        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error("claimAmount must be a positive number");
        }

        const claimStatus =
            amount <= STP_CLAIM_THRESHOLD
                ? "STP_APPROVED"
                : "PENDING";


        // --------------------------------------------------
        // 3. GENERATE CLAIM NUMBER
        // --------------------------------------------------

        const claimNumberResult = await connection.execute(
            `
            SELECT
                'CLM-' || TO_CHAR(SYSDATE, 'YYYY') || '-' ||
                LPAD(CLAIM_SEQ.NEXTVAL, 5, '0') AS CLAIM_NUMBER
            FROM DUAL
            `,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const claimNumber = claimNumberResult.rows[0].CLAIM_NUMBER;


        // --------------------------------------------------
        // 4. INSERT CLAIM
        // --------------------------------------------------

        const decidedAtClause =
            claimStatus === "STP_APPROVED"
                ? "CURRENT_TIMESTAMP"
                : "NULL";

        const result = await connection.execute(
            `
            INSERT INTO CLAIM (
                CLAIM_NUMBER,
                POLICY_ID,
                CUSTOMER_ID,
                INCIDENT_DATE,
                DESCRIPTION,
                CLAIM_AMOUNT,
                IMAGE_PATH,
                CLAIM_STATUS,
                APPROVED_AMOUNT,
                DECIDED_AT
            )
            VALUES (
                :claimNumber,
                :policyId,
                :customerId,
                TO_DATE(:incidentDate, 'YYYY-MM-DD'),
                :description,
                :claimAmount,
                :imagePath,
                :claimStatus,
                :approvedAmount,
                ${decidedAtClause}
            )
            RETURNING CLAIM_ID INTO :claimId
            `,
            {
                claimNumber,
                policyId: POLICY_ID,
                customerId: CUSTOMER_ID,
                incidentDate: incidentDate || null,
                description: description || null,
                claimAmount: amount,
                imagePath: imagePath || null,
                claimStatus,
                approvedAmount:
                    claimStatus === "STP_APPROVED" ? amount : null,
                claimId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            },
            { autoCommit: true }
        );

        return {
            claimId: result.outBinds.claimId[0],
            claimNumber,
            status: claimStatus,
            claimAmount: amount,
            approvedAmount:
                claimStatus === "STP_APPROVED" ? amount : null
        };

    } finally {
        if (connection) await connection.close();
    }
}


/*
=========================================================
UNDERWRITER REVIEW QUEUE
=========================================================
*/

async function getPendingClaims() {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                cl.CLAIM_ID, cl.CLAIM_NUMBER, cl.POLICY_ID,
                cl.INCIDENT_DATE, cl.DESCRIPTION, cl.CLAIM_AMOUNT,
                cl.IMAGE_PATH, cl.CLAIM_STATUS, cl.SUBMITTED_AT,
                p.POLICY_NUMBER,
                c.FULL_NAME AS CUSTOMER_NAME,
                pr.PRODUCT_NAME
            FROM CLAIM cl
            JOIN POLICY p ON p.POLICY_ID = cl.POLICY_ID
            JOIN CUSTOMER c ON c.CUSTOMER_ID = cl.CUSTOMER_ID
            LEFT JOIN PRODUCT pr ON pr.PRODUCT_ID = p.PRODUCT_ID
            WHERE cl.CLAIM_STATUS = 'PENDING'
            ORDER BY cl.SUBMITTED_AT ASC
            `,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows;

    } finally {
        if (connection) await connection.close();
    }
}


async function decideClaim(claimId, decision, note, approvedAmount) {
    let connection;

    try {
        connection = await getConnection();

        await connection.execute(
            `
            UPDATE CLAIM
            SET
                CLAIM_STATUS = :decision,
                ADJUSTER_NOTE = :note,
                APPROVED_AMOUNT = :approvedAmount,
                DECIDED_AT = CURRENT_TIMESTAMP
            WHERE CLAIM_ID = :claimId
            `,
            {
                decision,
                note: note || null,
                approvedAmount: approvedAmount || null,
                claimId
            },
            { autoCommit: true }
        );

        return { claimId, status: decision };

    } finally {
        if (connection) await connection.close();
    }
}


/*
=========================================================
CUSTOMER-FACING STATUS LOOKUP (SCOPED)
=========================================================

Used by the customer agent's getClaimStatus tool. Scoped to
customerId - same reasoning as getPolicyByNumber/getQuoteByNumber
in oracleservice.js.
=========================================================
*/

async function getClaimByNumber(claimNumber, customerId) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                cl.CLAIM_ID, cl.CLAIM_NUMBER, cl.POLICY_ID, cl.CUSTOMER_ID,
                cl.INCIDENT_DATE, cl.DESCRIPTION, cl.CLAIM_AMOUNT,
                cl.CLAIM_STATUS, cl.ADJUSTER_NOTE, cl.APPROVED_AMOUNT,
                cl.SUBMITTED_AT, cl.DECIDED_AT,
                p.POLICY_NUMBER,
                pr.PRODUCT_NAME
            FROM CLAIM cl
            JOIN POLICY p ON p.POLICY_ID = cl.POLICY_ID
            LEFT JOIN PRODUCT pr ON pr.PRODUCT_ID = p.PRODUCT_ID
            WHERE cl.CLAIM_NUMBER = :claimNumber
              AND cl.CUSTOMER_ID = :customerId
            `,
            { claimNumber, customerId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows[0] || null;

    } finally {
        if (connection) await connection.close();
    }
}


module.exports = {
    STP_CLAIM_THRESHOLD,
    getPolicyByNumberAdmin,
    submitClaim,
    getPendingClaims,
    decideClaim,
    getClaimByNumber
};