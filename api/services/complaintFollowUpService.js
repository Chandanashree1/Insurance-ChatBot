const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");


// ============================================================
// CONVERT CLOB TO STRING
// ============================================================

async function convertClob(value) {

    if (!value) {
        return null;
    }

    // Normal string
    if (typeof value === "string") {
        return value;
    }

    // Oracle CLOB
    if (
        typeof value === "object" &&
        typeof value.on === "function"
    ) {

        return await new Promise(
            (resolve, reject) => {

                let data = "";

                value.setEncoding("utf8");

                value.on(
                    "data",
                    chunk => {
                        data += chunk;
                    }
                );

                value.on(
                    "end",
                    () => {
                        resolve(data);
                    }
                );

                value.on(
                    "error",
                    error => {
                        reject(error);
                    }
                );

            }
        );

    }

    return String(value);
}


// ============================================================
// CONVERT COMPLAINT ROW
// ============================================================

async function formatComplaint(row) {

    if (!row) {
        return null;
    }

    return {

        COMPLAINT_ID:
            row.COMPLAINT_ID,

        CUSTOMER_ID:
            row.CUSTOMER_ID,

        SUBJECT:
            row.SUBJECT,

        FULL_NAME:
            row.FULL_NAME,

        EMAIL:
            row.EMAIL,

        MOBILE:
            row.MOBILE,

        PRODUCT:
            row.PRODUCT,

        POLICY_NUMBER:
            row.POLICY_NUMBER,

        COMPLAINT_MESSAGE:
            await convertClob(
                row.COMPLAINT_MESSAGE
            ),

        ROUTE:
            row.ROUTE,

        STATUS:
            row.STATUS,

        AI_REASON:
            row.AI_REASON,

        AGENT_NOTE:
            row.AGENT_NOTE,

        CREATED_AT:
            row.CREATED_AT,

        UPDATED_AT:
            row.UPDATED_AT

    };

}


// ============================================================
// GET NON-STP COMPLAINTS
// ============================================================

async function getNonStpComplaints() {

    let connection;

    try {

        connection =
            await getConnection();


        const result =
            await connection.execute(

                `
                SELECT
                    COMPLAINT_ID,
                    CUSTOMER_ID,
                    SUBJECT,
                    FULL_NAME,
                    EMAIL,
                    MOBILE,
                    PRODUCT,
                    POLICY_NUMBER,
                    COMPLAINT_MESSAGE,
                    ROUTE,
                    STATUS,
                    AI_REASON,
                    AGENT_NOTE,
                    CREATED_AT,
                    UPDATED_AT
                FROM COMPLAINTS
                WHERE ROUTE = 'NON_STP'
                ORDER BY CREATED_AT DESC
                `,

                {},

                {
                    outFormat:
                        oracledb.OUT_FORMAT_OBJECT
                }

            );


        const complaints = [];

        for (
            const row of result.rows
        ) {

            const complaint =
                await formatComplaint(row);

            complaints.push(
                complaint
            );

        }


        return complaints;


    } catch (error) {

        console.error(
            "Get Non-STP Complaints Error:",
            error.message
        );

        throw error;

    } finally {

        if (connection) {

            try {

                await connection.close();

            } catch (error) {

                console.error(
                    "Connection Close Error:",
                    error.message
                );

            }

        }

    }

}


// ============================================================
// GET COMPLAINT BY ID
// ============================================================

async function getComplaintById(
    complaintId
) {

    let connection;

    try {

        connection =
            await getConnection();


        const result =
            await connection.execute(

                `
                SELECT
                    COMPLAINT_ID,
                    CUSTOMER_ID,
                    SUBJECT,
                    FULL_NAME,
                    EMAIL,
                    MOBILE,
                    PRODUCT,
                    POLICY_NUMBER,
                    COMPLAINT_MESSAGE,
                    ROUTE,
                    STATUS,
                    AI_REASON,
                    AGENT_NOTE,
                    CREATED_AT,
                    UPDATED_AT
                FROM COMPLAINTS
                WHERE COMPLAINT_ID = :complaintId
                AND ROUTE = 'NON_STP'
                `,

                {
                    complaintId
                },

                {
                    outFormat:
                        oracledb.OUT_FORMAT_OBJECT
                }

            );


        if (
            !result.rows ||
            result.rows.length === 0
        ) {

            return null;

        }


        return await formatComplaint(
            result.rows[0]
        );


    } catch (error) {

        console.error(
            "Get Complaint By ID Error:",
            error.message
        );

        throw error;

    } finally {

        if (connection) {

            try {

                await connection.close();

            } catch (error) {

                console.error(
                    "Connection Close Error:",
                    error.message
                );

            }

        }

    }

}


// ============================================================
// UPDATE COMPLAINT FOLLOW-UP
// ============================================================

async function updateComplaint(
    complaintId,
    status,
    agentNote
) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(

            `
            UPDATE COMPLAINTS
            SET
                STATUS = :status,
                AGENT_NOTE = :agentNote,
                UPDATED_AT = CURRENT_TIMESTAMP
            WHERE COMPLAINT_ID = :complaintId
            `,

            {
                complaintId,
                status,
                agentNote: agentNote || null
            },

            {
                autoCommit: true
            }
        );


        if (result.rowsAffected === 0) {

            return {
                success: false,
                message: "Complaint not found."
            };

        }


        return {
            success: true,
            message: "Complaint updated successfully."
        };

    }

    finally {

        if (connection) {
            await connection.close();
        }

    }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {

    getNonStpComplaints,

    getComplaintById,

    updateComplaint

};