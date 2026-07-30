function chunkDocument(document, chunkSize = 500, overlap = 100) {

    const chunks = [];

    let start = 0;
    let chunkId = 1;

    while (start < document.content.length) {

        const end = start + chunkSize;

        chunks.push({
            fileName: document.fileName,
            chunkId: chunkId++,
            text: document.content.substring(start, end)
        });

        start += chunkSize - overlap;
    }

    return chunks;
}

module.exports = {
    chunkDocument
};