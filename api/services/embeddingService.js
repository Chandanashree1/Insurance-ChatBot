const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_TOKEN);
// console.log(process.env.HF_TOKEN);

// Free embedding model
const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";

async function generateEmbedding(text) {

    try {

        const embedding = await hf.featureExtraction({
            model: EMBEDDING_MODEL,
            inputs: text
        });

        return embedding;

    } catch (error) {

        console.error("Embedding Error:", error.message);
        throw error;

    }

}

module.exports = {
    generateEmbedding
};