require("dotenv").config();
const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_TOKEN);

async function test() {
    try {
        const embedding = await hf.featureExtraction({
            model: "sentence-transformers/all-MiniLM-L6-v2",
            inputs: "Hello world"
        });

        console.log("Success");
        console.log(embedding.length);
    } catch (err) {
        console.error(err);
    }
}

test();