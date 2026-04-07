import { Index } from '@upstash/vector';
import { embedMany } from 'ai';
import { google } from '@ai-sdk/google';
import 'dotenv/config';

// Ensure you run this with: npx tsx scripts/update-brain.ts

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL as string,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN as string,
});

// Update these facts to represent your actual resume/portfolio data!
const myFacts = [
  "lorem ipsum wo ai ni",
];

async function updateBrain() {
  console.log("Connecting to Gemini to embed facts into vector space...");
  
  // Create mathematical vector embeddings using the stable embedding model
  const { embeddings } = await embedMany({
    model: google.embeddingModel('gemini-embedding-001'), 
    values: myFacts,
    providerOptions: {
    google: {
      outputDimensionality: 1536,
    }
  }
  });

  const vectors = myFacts.map((fact, i) => ({
    id: `fact_${i}`,
    vector: embeddings[i],
    metadata: { text: fact }, // We store the actual string here to return to the LLM later
  }));

  console.log(`Pushing ${vectors.length} vectors to Serverless Upstash Database...`);
  await index.upsert(vectors);

  console.log("successfully updated!");
}

updateBrain().catch(console.error);
