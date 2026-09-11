require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

const { chunkDocument } = require("./services/chunkService")
const { generateEmbedding } = require("./services/embeddingService");

const PDF_PATH = path.join(
    __dirname,
    "document",
    "known_issues.pdf"
);

const OUTPUT_PATH = path.join(
    __dirname,
    "embeddings",
    "known_issuesEmbadding.json"
);

async function generateKnownIssueEmbeddings() {

    try {

        console.log("Reading known-issues PDF...");

        const buffer = fs.readFileSync(PDF_PATH);

        const data = await pdf(buffer);

        console.log("PDF text extracted");
        console.log("Characters:", data.text.length);

        const document = {
            fileName: "known_issues.pdf",
            content: data.text
        };

        const chunks = chunkDocument(document);

        console.log("Total chunks:", chunks.length);

        const embeddedChunks = [];

        for (let i = 0; i < chunks.length; i++) {

            const chunk = chunks[i];

            console.log(
                `\n Embedding chunk ${i + 1}/${chunks.length}`
            );

            console.log(
                "Chunk characters:",
                chunk.text.length
            );

            if (!chunk.text.trim()) {
                console.log("Empty chunk - skipping");
                continue;
            }

            const embedding = await generateEmbedding(
                chunk.text
            );

            embeddedChunks.push({
                fileName: chunk.fileName,
                chunkId: chunk.chunkId,
                text: chunk.text,
                embedding: embedding
            });

            console.log(
                "Embedding generated:",
                embedding.length
            );
        }

        fs.writeFileSync(
            OUTPUT_PATH,
            JSON.stringify(embeddedChunks, null, 2)
        );

        console.log("\n================================");
        console.log("Known issue embeddings created");
        console.log("File:", OUTPUT_PATH);
        console.log("Chunks:", embeddedChunks.length);
        console.log("================================");

    } catch (error) {

        console.error("\n Error:");
        console.error(error.message);

        if (error.status) {
            console.error("HTTP Status:", error.status);
        }

    }
}

generateKnownIssueEmbeddings();