const { getConnection } = require("../config/oracle");

async function login(req, res) {

    const { email, password } = req.body;

    let connection;

    try {

        connection = await getConnection();

        // Check email & password
        const result = await connection.execute(
            `SELECT CUSTOMER_ID
             FROM CUSTOMER
             WHERE EMAIL = :email
             AND PASSWORD = :password`,
            { email, password },
            { outFormat: require("oracledb").OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.json({
                success: false,
                message: "Invalid Email or Password"
            });
        }

        const customerId = result.rows[0].CUSTOMER_ID;

        // Update login status
        await connection.execute(
            `UPDATE CUSTOMER
             SET LOGIN_STATUS = 'TRUE'
             WHERE CUSTOMER_ID = :customerId`,
            { customerId },
            { autoCommit: true }
        );

        res.json({
            success: true,
            customerId: customerId
        });

    } catch (err) {

        console.error(err);

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

module.exports = { login };