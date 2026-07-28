const { askAI } = require("../services/openRouterServices");
const connectDB = require("../db"); 
const oracledb = require("oracledb");

const chat = async (req, res) => {
  let connection;
  try {
    const { message, customerId } = req.body; 

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    let databaseContext = "";

    if (customerId) {
      connection = await connectDB();
      
      const query = `
        SELECT 
          c.CUSTOMER_NAME, c.EMAIL, c.PHONE, c.CITY,
          p.POLICY_NUMBER, p.POLICY_TYPE, p.PLAN_NAME, p.PREMIUM, p.SUM_INSURED, p.STATUS
        FROM CUSTOMER c
        LEFT JOIN POLICY p ON c.CUSTOMER_ID = p.CUSTOMER_ID
        WHERE c.CUSTOMER_ID = :id
      `;
      
      const result = await connection.execute(
        query, 
        [customerId], 
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
     
      if (result.rows && result.rows.length > 0) {
        databaseContext = `\n\n[CURRENT USER PROFILE & CLAIMS]: ${JSON.stringify(result.rows)}`;
      }
    }

    // Call the AI utility service
    const aiResponse = await askAI(message, databaseContext); 

    return res.json({ success: true, reply: aiResponse });

  } catch (error) {
    // This makes sure any hidden controller crash gets printed out loud!
    console.error(" Chat Controller Main Crash:", error);
    return res.status(500).json({ success: false, message: error.message || "Something went wrong" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("Error closing DB connection:", closeErr);
      }
    }
  }
};

module.exports = { chat };
