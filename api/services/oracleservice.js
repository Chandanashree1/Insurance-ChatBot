const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");

async function getPolicy(customerId) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(

            `SELECT
                c.CUSTOMER_NAME,
                c.EMAIL,
                c.PHONE,
                c.CITY,
                p.POLICY_NUMBER,
                p.POLICY_TYPE,
                p.PLAN_NAME,
                p.PREMIUM,
                p.SUM_INSURED,
                p.STATUS
            FROM CUSTOMER c
            LEFT JOIN POLICY p
            ON c.CUSTOMER_ID = p.CUSTOMER_ID
            WHERE c.CUSTOMER_ID = :id`,

            [customerId],

            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }

        );

        return result.rows;

    }

    finally {

        if (connection)
            await connection.close();

    }

}

async function getClaims(customerId) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(

            `SELECT
                c.CLAIM_NUMBER,
                c.CLAIM_DATE,
                c.CLAIM_TYPE,
                c.CLAIM_AMOUNT,
                c.APPROVED_AMOUNT,
                c.STATUS,
                p.POLICY_NUMBER,
                p.POLICY_TYPE,
                p.PLAN_NAME
            FROM CLAIM c
            JOIN POLICY p
            ON c.POLICY_ID = p.POLICY_ID
            WHERE p.CUSTOMER_ID = :id`,

            [customerId],

            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }

        );

        return result.rows;

    }

    finally {

        if (connection)
            await connection.close();

    }

}

async function getFAQ() {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(

            `SELECT
                QUESTION,
                ANSWER
            FROM FAQ`,

            [],

            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }

        );

        return result.rows;

    }

    finally {

        if (connection)
            await connection.close();

    }

}

module.exports = {

    getPolicy,
    getClaims,
    getFAQ

};