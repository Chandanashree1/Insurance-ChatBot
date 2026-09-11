require("dotenv").config();

const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_TOKEN);

async function test() {
    try {
        console.log("Testing Hugging Face embedding...");

        const embedding = await hf.featureExtraction({
            model: "sentence-transformers/all-MiniLM-L6-v2",
            inputs: "Hello world"
        });

        console.log("✅ Success");
        console.log("Embedding length:", embedding.length);
        console.log("First 5 values:", embedding.slice(0, 5));

    } catch (err) {
        console.error("❌ Embedding failed");
        console.error(err);
    }
}

test();