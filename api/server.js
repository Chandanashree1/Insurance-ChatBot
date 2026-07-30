const express = require("express");
const cors = require("cors");
require("dotenv").config();

const chatRoutes = require("./routes/chatRoutes");
const loginRoutes = require("./routes/loginRoutes");

// const connectDB = require("./db"); 

const app = express();
app.use(cors());
app.use(cors({
  origin: 'http://localhost:4200', 
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use("/api", chatRoutes);
app.use("/api", loginRoutes);

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