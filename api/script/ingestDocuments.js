const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { loadDocuments } = require("../services/documentLoader");
const { chunkDocument } = require("../services/chunkService");
const { generateEmbedding } = require("../services/embeddingService");

(async () => {

    try {

        const docs = await loadDocuments();

        const indexedChunks = [];

        for (const doc of docs) {

            console.log(`\nProcessing ${doc.fileName}`);

            const chunks = chunkDocument(doc);

            for (const chunk of chunks) {

                console.log(`Generating embedding for Chunk ${chunk.chunkId}`);

                const embedding = await generateEmbedding(chunk.text);

                indexedChunks.push({
                    ...chunk,
                    embedding
                });

            }

        }

        const outputPath = path.join(
            __dirname,
            "../embeddings/documentEmbeddings.json"
        );

        fs.writeFileSync(
            outputPath,
            JSON.stringify(indexedChunks, null, 2)
        );

        console.log("\n✅ Embedding index created successfully!");

        console.log(`Total Chunks: ${indexedChunks.length}`);

    } catch (err) {

        console.error(err);

    }

})();