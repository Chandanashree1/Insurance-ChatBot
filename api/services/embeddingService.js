
const axios = require("axios");

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "all-minilm";

async function generateEmbedding(text) {
    try {
        const response = await axios.post(
            EMBEDDING_API_URL,
            {
                model: EMBEDDING_MODEL,
                input: text
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 60000
            }
        );

        const embedding = response.data?.embeddings?.[0];

        if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error("Invalid embedding response from Ollama");
        }

        return embedding;

    } catch (error) {
        console.error(
            "Embedding Error:",
            error.response?.data || error.message
        );
        throw error;
    }
}

module.exports = { generateEmbedding };