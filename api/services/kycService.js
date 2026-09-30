const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");

async function verifyKycAgainstDb(civilIdLicenseNo) {

    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT CUSTOMER_ID, FULL_NAME
            FROM CUSTOMER
            WHERE CIVIL_ID_LICENSE_NO = :civilIdLicenseNo
            `,
            { civilIdLicenseNo },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return {
                verified: false,
                reason: "The Civil ID / License number does not match any record in our system."
            };
        }

        return { verified: true, reason: null };

    } finally {
        if (connection) await connection.close();
    }
}

module.exports = { verifyKycAgainstDb };