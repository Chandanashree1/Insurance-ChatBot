const fs = require("fs");
const path = require("path");
const cosineSimilarity = require("compute-cosine-similarity");

const { generateEmbedding } = require("./embeddingService");

async function retrieveRelevantChunks(
    question,
    topK = 3,
    embeddingFileName = "documentEmbeddings.json"
) {

    // Select the required embedding JSON
    const embeddingFile = path.join(
        __dirname,
        "../embeddings",
        embeddingFileName
    );

    // Read JSON
    if (!fs.existsSync(embeddingFile)) {
        throw new Error(
            `Embedding file not found: ${embeddingFile}`
        );
    }

    const documentChunks = JSON.parse(
        fs.readFileSync(embeddingFile, "utf8")
    );

    // Generate embedding for question
    const questionEmbedding =
        await generateEmbedding(question);

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

    // Sort by similarity
    scoredChunks.sort(
        (a, b) => b.score - a.score
    );

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