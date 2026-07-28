const oracledb = require("oracledb");

async function connectDB() {
  try {
    const connection = await oracledb.getConnection({
      user: "system",
      password: "1911",
      connectString: "localhost:1521/FREE"
    });

    console.log("Connected to Oracle Database");
    return connection;

  } catch (err) {
    console.error("Connection Error:", err);
  }
}

module.exports = connectDB;