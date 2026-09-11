const { getConnection } = require("../config/oracle");
const oracledb = require("oracledb");

async function login(req, res) {
  let connection;

  try {
    connection = await getConnection();

    // Case 1: Login request
    if (req.body.email && req.body.password) {
      const { email, password } = req.body;

      const result = await connection.execute(
        `SELECT CUSTOMER_ID, FULL_NAME, EMAIL, MOBILE_NUMBER, CIVIL_ID_LICENSE_NO, PASSWORD
         FROM CUSTOMER
         WHERE EMAIL = :email`,
        { email },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows.length === 0 || result.rows[0].PASSWORD !== password) {
        return res.json({ success: false, message: "Invalid Email or Password" });
      }

      const user = result.rows[0];
      return res.json({
        success: true,
        customerId: user.CUSTOMER_ID,
        fullName: user.FULL_NAME,
        email: user.EMAIL,
        mobileNumber: user.MOBILE_NUMBER,
        civilId: user.CIVIL_ID_LICENSE_NO
      });
    }

    // Case 2: Profile update request
    if (req.body.customerId) {
      const { customerId, fullName, email, mobileNumber, civilId } = req.body;

      await connection.execute(
        `UPDATE CUSTOMER
         SET FULL_NAME = :fullName,
             EMAIL = :email,
             MOBILE_NUMBER = :mobileNumber,
             CIVIL_ID_LICENSE_NO = :civilId
         WHERE CUSTOMER_ID = :customerId`,
        { fullName, email, mobileNumber, civilId, customerId },
        { autoCommit: true }
      );

      return res.json({ success: true, message: "Profile updated successfully" });
    }

    // If neither case matches
    res.status(400).json({ success: false, message: "Invalid request" });

  } catch (err) {
    console.error("Controller error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { login };
