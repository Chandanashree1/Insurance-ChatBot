const express = require("express");
const cors = require("cors");
require("dotenv").config();

const chatRoutes = require("./routes/chatRoutes");
// const loginRoutes = require("./routes/loginRoutes");
const historyRoutes = require("./routes/history.routes");
const ratingRoutes = require("./routes/ratingRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const customerRoutes = require("./routes/customerRoutes");
const quoteRoutes = require("./routes/quoteRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const policyRoutes = require("./routes/policyRoutes");
const authRoutes = require("./routes/authRoutes");
// const insuranceApplicationRoutes = require("./routes/insuranceApplicationRoutes");

// const connectDB = require("./db"); 

const app = express();
app.use(cors({
  origin: 'http://localhost:4200', 
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use("/api", chatRoutes);
// app.use("/api", loginRoutes);
// app.use("/api", insuranceApplicationRoutes);
// app.use("/api", require("./routes/history.routes"));

app.use("/api", historyRoutes);
app.use("/api", ratingRoutes);
app.use("/api", vehicleRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api", quoteRoutes);
app.use("/api", paymentRoutes);
app.use("/api", policyRoutes);
 
app.use("/api", authRoutes);
app.get("/", (req, res) => {
    res.send("Insurance Chatbot Backend is Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // // connectDB()
    // .then(() => {
    //   console.log("Database connection sequence finished.");
    // })
    // .catch((error) => {
    //   console.error(" Failed to initiate database connection:", error.message);
    // });
});