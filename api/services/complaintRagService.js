const fs = require("fs");
const path = require("path");

const { generateEmbedding } = require("./embeddingService");


// ============================================================
// RAG FILE
// ============================================================

const RAG_FILE = path.join(
    __dirname,
    "../embeddings/known_issuesEmbadding.json"
);


// ============================================================
// CACHE
// ============================================================
let ragData = null;

// ============================================================
// LOAD RAG DATA
// ============================================================
function loadRagData() {

    if (ragData) {
        return ragData;
    }

    if (!fs.existsSync(RAG_FILE)) {
        throw new Error(
            `Complaint RAG file not found: ${RAG_FILE}`
        );
    }

    try {
        const rawData =
            fs.readFileSync(
                RAG_FILE,
                "utf8"
            );

        ragData =
            JSON.parse(rawData);
    }

    catch (error) {
        throw new Error(
            `Unable to read complaint RAG file: ${error.message}`
        );
    }

    if (!Array.isArray(ragData)) {
        throw new Error(
            "known_issuesEmbadding.json must contain an array."
        );
    }

    console.log(
        `Loaded ${ragData.length} complaint RAG records`
    );

    return ragData;
}


// ============================================================
// COSINE SIMILARITY
// ============================================================

function cosineSimilarity(
    vectorA,
    vectorB
) {

    if (
        !Array.isArray(vectorA) ||
        !Array.isArray(vectorB)
    ) {

        return 0;
    }

    // HuggingFace nested embedding handling
    if (Array.isArray(vectorA[0])) {

        vectorA = vectorA[0];
    }

    if (Array.isArray(vectorB[0])) {

        vectorB = vectorB[0];
    }

    if (
        !vectorA.length ||
        !vectorB.length
    ) {

        return 0;
    }

    if (
        vectorA.length !==
        vectorB.length
    ) {

        console.log(
            `Embedding size mismatch: ${vectorA.length} vs ${vectorB.length}`
        );

        return 0;
    }

    let dotProduct = 0;

    let magnitudeA = 0;

    let magnitudeB = 0;

    for (
        let i = 0;
        i < vectorA.length;
        i++
    ) {

        dotProduct +=
            vectorA[i] *
            vectorB[i];

        magnitudeA +=
            vectorA[i] *
            vectorA[i];

        magnitudeB +=
            vectorB[i] *
            vectorB[i];
    }


    if (
        magnitudeA === 0 ||
        magnitudeB === 0
    ) {
        return 0;
    }

    return (
        dotProduct /
        (
            Math.sqrt(magnitudeA) *
            Math.sqrt(magnitudeB)
        )
    );
}


// ============================================================
// GET TEXT
// ============================================================

function getText(item) {

    return (
        item.text ||
        item.content ||
        item.chunk ||
        item.pageContent ||
        ""
    );
}


// ============================================================
// GET EMBEDDING
// ============================================================

function getEmbedding(item) {

    return (
        item.embedding ||
        item.embeddings ||
        item.vector ||
        null
    );
}


// ============================================================
// GET COMPLAINT ID
// ============================================================

function getComplaintId(
    item,
    index
) {

    return (
        item.complaintId ||
        item.id ||
        item.chunkId ||
        `RAG-${index + 1}`
    );
}


// ============================================================
// EXTRACT TITLE
// ============================================================

function extractTitle(
    text
) {
    if (!text) {
        return "Known Complaint";
    }


    const match =
        text.match(
            /STP\s*-\s*([^\n]+)/i
        );

    if (match) {
        return match[1].trim();
    }

    return "Known Complaint";
}


// ============================================================
// EXTRACT RESOLUTION
// ============================================================

function extractResolution(
    text
) {
    if (!text) {
        return "";
    }

    const match =
        text.match(
            /Resolution\s*:\s*([\s\S]*?)(?=---+|STP\s*-|$)/i
        );

    if (match) {
        return match[1].trim();
    }

    return text.trim();
}


// ============================================================
// SEARCH COMPLAINT RAG
//
// IMPORTANT:
//
// This function DOES NOT decide STP / NON_STP.
//
// analyzeComplaint() in huggingFaceService.js decides
// STP / NON_STP.
//
// This function is ONLY called after STP is decided.
//
// RAG responsibility:
//
// Customer complaint
//        ↓
// Embedding
//        ↓
// Search known issue PDF embeddings
//        ↓
// Return matching resolution
//
// ============================================================

async function searchComplaint(
    complaintText
) {
    if (
        !complaintText ||
        typeof complaintText !== "string"
    ) {
        return {
            found: false,
            message:
                "Complaint text is empty."
        };
    }


    console.log("");
    console.log("========================================");
    console.log("SEARCHING COMPLAINT RAG");
    console.log("========================================");


    console.log(complaintText);

    // ========================================================
    // LOAD RAG DATA
    // ========================================================

    const records = loadRagData();


    console.log("RAG records:",records.length);

    // ========================================================
    // CREATE QUERY EMBEDDING
    // ========================================================

    const queryEmbedding =
        await generateEmbedding(
            complaintText
        );

    if (
        !Array.isArray(queryEmbedding)
    ) {
        console.error("Invalid query embedding.");

        return {
            found: false,
            message:
                "Unable to generate complaint embedding."};
    }

    console.log(
        "Query embedding generated."
    );

    // ========================================================
    // FIND BEST RAG DOCUMENT
    //
    // NOTE:
    //
    // Similarity is used ONLY to retrieve the most
    // relevant document.
    //
    // It is NOT used to decide STP/NON_STP.
    //
    // ========================================================

    let bestMatch = null;

    let bestSimilarity = -1;

    let bestIndex = -1;


    records.forEach(
        (item, index) => {

            const embedding =
                getEmbedding(item);

            if (!embedding) {
                console.log(
                    `Record ${index + 1} has no embedding`
                );
                return;
            }

            const similarity =
                cosineSimilarity(
                    queryEmbedding,
                    embedding
                );

            console.log(
                `Record ${index + 1} similarity: ${similarity.toFixed(4)}`
            );


            if (
                similarity >
                bestSimilarity
            ) {

                bestSimilarity =
                    similarity;

                bestMatch =
                    item;

                bestIndex =
                    index;
            }
        }
    );


    // ========================================================
    // NO RAG DOCUMENT
    // ========================================================

    if (!bestMatch) {

        console.log(
            "No RAG document found."
        );

        return {

            found: false,

            message:
                "No matching known issue was found."

        };
    }


    // ========================================================
    // BEST MATCH
    // ========================================================

    const bestText =
        getText(
            bestMatch
        );

    const complaintId =
        getComplaintId(
            bestMatch,
            bestIndex
        );

    const title =
        extractTitle(
            bestText
        );

    const resolution =
        extractResolution(
            bestText
        );

    console.log("");
    console.log("========================================");
    console.log("BEST RAG DOCUMENT");
    console.log("========================================");

    console.log(
        "Complaint ID:",
        complaintId
    );

    console.log(
        "Similarity:",
        bestSimilarity.toFixed(4)
    );

    console.log(
        "Title:",
        title
    );

    console.log(
        "Resolution:",
        resolution
    );

    // ========================================================
    // RETURN RAG RESULT
    //
    // IMPORTANT:
    //
    // Do NOT return route: STP here.
    //
    // Qwen already decided STP.
    //
    // ========================================================

    return {

        found: true,
        complaintId,
        title,
        resolution,
        similarity:
            Number(
                bestSimilarity.toFixed(4)
            )
    };
}


// ============================================================
// CLEAR CACHE
// ============================================================

function clearComplaintCache() {

    ragData = null;

    console.log(
        "Complaint RAG cache cleared."
    );
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    searchComplaint,

    clearComplaintCache

};