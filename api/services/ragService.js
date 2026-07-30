const fs = require("fs");
const path = require("path");
const cosineSimilarity = require("compute-cosine-similarity");

const { generateEmbedding } = require("./embeddingService");

const embeddingFile = path.join(
    __dirname,
    "../embeddings/documentEmbeddings.json"
);

const documentChunks = JSON.parse(
    fs.readFileSync(embeddingFile, "utf8")
);

async function retrieveRelevantChunks(question, topK = 3) {

    // Generate embedding for user question
    const questionEmbedding = await generateEmbedding(question);

    // Calculate similarity
    const scoredChunks = documentChunks.map(chunk => {

        const score = cosineSimilarity(
            questionEmbedding,
            chunk.embedding
        );

        return {
            ...chunk,
            score
        };

    });

    // Sort by score
    scoredChunks.sort((a, b) => b.score - a.score);

    // Return top K
    return scoredChunks
    .slice(0, topK)
    .map(chunk => ({
        fileName: chunk.fileName,
        chunkId: chunk.chunkId,
        text: chunk.text,
        score: chunk.score
    }));

}

module.exports = {
    retrieveRelevantChunks
};