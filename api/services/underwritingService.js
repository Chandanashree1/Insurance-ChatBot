const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");


// ======================================================
// SUBMIT PROPOSAL — now takes a triggerReason
// ======================================================
async function submitProposalForUnderwriting(quoteId, optionId, additionalInfo, triggerReason = 'HIGH_VALUE') {

    let connection;

    try {
        connection = await getConnection();

        const proposalNumberResult = await connection.execute(
            `
            SELECT
                'PRP-' || TO_CHAR(SYSDATE, 'YYYY') || '-' ||
                LPAD(PROPOSAL_SEQ.NEXTVAL, 5, '0') AS PROPOSAL_NUMBER
            FROM DUAL
            `,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const proposalNumber = proposalNumberResult.rows[0].PROPOSAL_NUMBER;

        const result = await connection.execute(
            `
            INSERT INTO PROPOSAL (
                PROPOSAL_NUMBER,
                QUOTE_ID,
                OPTION_ID,
                PROPOSAL_STATUS,
                ADDITIONAL_INFO,
                TRIGGER_REASON
            )
            VALUES (
                :proposalNumber,
                :quoteId,
                :optionId,
                'PENDING',
                :additionalInfo,
                :triggerReason
            )
            RETURNING PROPOSAL_ID INTO :proposalId
            `,
            {
                proposalNumber,
                quoteId,
                optionId,
                additionalInfo: additionalInfo || null,
                triggerReason,
                proposalId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            },
            { autoCommit: true }
        );

        return {
            proposalId: result.outBinds.proposalId[0],
            proposalNumber,
            status: 'PENDING',
            triggerReason
        };

    } finally {
        if (connection) await connection.close();
    }
}


// ======================================================
// GET PROPOSAL STATUS BY QUOTE NUMBER (customer-facing)
// ======================================================
async function getProposalByQuoteNumber(quoteNumber) {

    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                p.PROPOSAL_ID, p.PROPOSAL_NUMBER, p.QUOTE_ID,
                p.PROPOSAL_STATUS, p.UNDERWRITER_NOTE, p.COUNTER_OFFER_PREMIUM,
                p.CUSTOMER_RESPONSE, p.TRIGGER_REASON, p.SUBMITTED_AT, p.DECIDED_AT,
                q.QUOTE_NUMBER
            FROM PROPOSAL p
            JOIN QUOTE q ON p.QUOTE_ID = q.QUOTE_ID
            WHERE q.QUOTE_NUMBER = :quoteNumber
            `,
            { quoteNumber },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows[0] || null;

    } finally {
        if (connection) await connection.close();
    }
}


async function getPendingProposals() {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                p.PROPOSAL_ID, p.PROPOSAL_NUMBER, p.QUOTE_ID, p.OPTION_ID,
                p.PROPOSAL_STATUS, p.ADDITIONAL_INFO, p.TRIGGER_REASON, p.SUBMITTED_AT,
                q.QUOTE_NUMBER, q.VEHICLE_VALUE,
                c.FULL_NAME AS CUSTOMER_NAME,
                qo.PLAN_NAME, qo.PREMIUM
            FROM PROPOSAL p
            JOIN QUOTE q ON p.QUOTE_ID = q.QUOTE_ID
            JOIN CUSTOMER c ON q.CUSTOMER_ID = c.CUSTOMER_ID
            JOIN QUOTE_OPTION qo ON p.OPTION_ID = qo.OPTION_ID
            WHERE p.PROPOSAL_STATUS = 'PENDING'
            ORDER BY p.SUBMITTED_AT ASC
            `,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows;
    } finally {
        if (connection) await connection.close();
    }
}


async function decideProposal(proposalId, decision, note, counterOfferPremium) {
    let connection;
    try {
        connection = await getConnection();

        await connection.execute(
            `
            UPDATE PROPOSAL
            SET
                PROPOSAL_STATUS = :decision,
                UNDERWRITER_NOTE = :note,
                COUNTER_OFFER_PREMIUM = :counterOfferPremium,
                DECIDED_AT = CURRENT_TIMESTAMP
            WHERE PROPOSAL_ID = :proposalId
            `,
            {
                decision,
                note: note || null,
                counterOfferPremium: counterOfferPremium || null,
                proposalId
            },
            { autoCommit: true }
        );

        return { proposalId, status: decision };
    } finally {
        if (connection) await connection.close();
    }
}


async function getProposalByQuoteId(quoteId) {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                p.PROPOSAL_ID, p.PROPOSAL_NUMBER, p.QUOTE_ID, p.OPTION_ID,
                p.PROPOSAL_STATUS, p.UNDERWRITER_NOTE, p.COUNTER_OFFER_PREMIUM,
                p.CUSTOMER_RESPONSE, p.TRIGGER_REASON, p.SUBMITTED_AT, p.DECIDED_AT,
                qo.PLAN_NAME, qo.PREMIUM
            FROM PROPOSAL p
            JOIN QUOTE_OPTION qo ON p.OPTION_ID = qo.OPTION_ID
            WHERE p.QUOTE_ID = :quoteId
            `,
            { quoteId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows[0] || null;
    } finally {
        if (connection) await connection.close();
    }
}


async function respondToCounterOffer(proposalId, response) {

    let connection;

    try {
        connection = await getConnection();

        const proposalResult = await connection.execute(
            `
            SELECT PROPOSAL_ID, OPTION_ID, PROPOSAL_STATUS, COUNTER_OFFER_PREMIUM
            FROM PROPOSAL
            WHERE PROPOSAL_ID = :proposalId
            `,
            { proposalId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (proposalResult.rows.length === 0) {
            throw new Error("Proposal not found");
        }

        const proposal = proposalResult.rows[0];

        if (proposal.PROPOSAL_STATUS !== 'COUNTER_OFFER') {
            throw new Error("This proposal has no active counter-offer");
        }

        await connection.execute(
            `
            UPDATE PROPOSAL
            SET CUSTOMER_RESPONSE = :response
            WHERE PROPOSAL_ID = :proposalId
            `,
            { response, proposalId },
            { autoCommit: false }
        );

        if (response === 'ACCEPTED') {
            await connection.execute(
                `
                UPDATE QUOTE_OPTION
                SET PREMIUM = :premium
                WHERE OPTION_ID = :optionId
                `,
                { premium: proposal.COUNTER_OFFER_PREMIUM, optionId: proposal.OPTION_ID },
                { autoCommit: false }
            );
        }

        await connection.commit();

        return { proposalId, response };

    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) await connection.close();
    }
}


module.exports = {
    submitProposalForUnderwriting,
    getPendingProposals,
    decideProposal,
    getProposalByQuoteId,
    respondToCounterOffer,
    getProposalByQuoteNumber
};