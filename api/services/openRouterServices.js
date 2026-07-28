const axios = require("axios");
const insurancePrompt = require("../prompts/insurancePrompt");

async function askAI(userMessage, dbContextString = "") {
  try {
    const contextPrompt = `${insurancePrompt}\n\n[CRITICAL CURRENT USER DATA]: ${dbContextString || "No specific database record provided for this session."}`;

    const response = await axios.post(
      "https://openrouter.ai",
      {
        model: "poolside/laguna-s-2.1:free",
        messages: [
          { role: "system", content: contextPrompt },
          { role: "user", content: userMessage }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // FIX HERE: choices is an array, you must access choices[0]
    if (response.data && response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    }
    
    throw new Error("Invalid response format from AI API");

  } catch (error) {
    // Loudly log out the exact error message so you can see it in the terminal
    console.error("OpenRouter Error Details:", error.response?.data || error.message);
    throw new Error("Unable to process request with AI.");
  }
}

module.exports = { askAI };
