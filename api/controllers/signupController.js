const { getConnection } = require("../config/oracle");
const oracledb = require("oracledb");

async function signup(req, res) {
    const { name, email, password } = req.body;
    let connection;

    try {
        connection = await getConnection();

        // Check whether email already exists
        const existing = await connection.execute(
            `SELECT CUSTOMER_ID
             FROM CUSTOMER
             WHERE EMAIL = :email`,
            { email },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        if (existing.rows.length > 0) {
            return res.json({
                success: false,
                userExists: true,
                message: "Account already exists. Please sign in."
            });
        }

        // Create new customer
        const result = await connection.execute(
            `INSERT INTO CUSTOMER (
                FULL_NAME,
                EMAIL,
                PASSWORD
             )
             VALUES (
                :name,
                :email,
                :password
             )
             RETURNING CUSTOMER_ID INTO :customerId`,
            {
                name,
                email,
                password,
                customerId: {
                    type: oracledb.NUMBER,
                    dir: oracledb.BIND_OUT
                }
            },
            {
                autoCommit: true
            }
        );

        res.json({
            success: true,
            customerId: result.outBinds.customerId[0]
        });

    } catch (err) {
        console.error("Signup error:", err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

module.exports = { signup };