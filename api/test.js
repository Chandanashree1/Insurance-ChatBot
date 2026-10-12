require("dotenv").config();

const { generateEmbedding } = require("./services/embeddingService");


async function test() {
    try {
        const embedding = await generateEmbedding(
            "Health insurance waiting period"
        );

        console.log("Embedding generated successfully!");
        console.log("Vector dimensions:", embedding.length);
        console.log("First five values:", embedding.slice(0, 5));
    } catch (error) {
        console.error("Test failed:", error.message);
    }
}

test();