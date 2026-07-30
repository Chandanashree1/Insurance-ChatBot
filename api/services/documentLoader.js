const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

const DOCUMENTS_FOLDER = path.join(__dirname, "../document");

async function loadDocuments() {
    const documents = [];

    const files = fs.readdirSync(DOCUMENTS_FOLDER);

    for (const file of files) {

        if (!file.endsWith(".pdf")) continue;

        try {

            const filePath = path.join(DOCUMENTS_FOLDER, file);

            const buffer = fs.readFileSync(filePath);

            const data = await pdf(buffer);

            documents.push({
                fileName: file,
                content: data.text
            });

            console.log(`✅ Loaded ${file}`);

        } catch (err) {

            console.error(`❌ Failed to load ${file}`);
            console.error(err.message);

        }
    }

    return documents;
}

module.exports = { loadDocuments };