const express = require("express");
const cors = require("cors");
require("dotenv").config();

const chatRoutes = require("./routes/chatRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", chatRoutes);

app.get("/", (req, res) => {
    res.send("Insurance Chatbot Backend is Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});