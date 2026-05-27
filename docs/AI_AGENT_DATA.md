# Feeding Data to My AI Agent (Note to Self)

The site has a built-in AI assistant powered by the Vercel AI SDK and an Upstash Vector database for RAG (Retrieval-Augmented Generation).

## How the brain works

The chatbot relies on a script in `scripts/update-brain.ts`. This script reads my plain-text info, turns it into mathematical vectors (embeddings), and shoots them over to my Upstash Vector database.

When someone asks a question on the site, the backend (`api/chat.ts`) searches the Vector database for the most relevant chunks of text, and feeds them into the LLM (Gemini/Claude/OpenAI) so it can generate an accurate, non-hallucinated response about me.

## Adding New Knowledge

1. **Find the knowledge file:** My source data is defined in a JSON file at `scripts/my_facts.json`. It contains a JSON array of plain-text facts about me.
2. **Write about myself:** Open `scripts/my_facts.json` and add, remove, or modify the strings in the array to keep my background and projects up to date.
3. **Run the script:**
   After I update the JSON file, I have to embed the data. Double check that my `.env` has:

   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=...
   UPSTASH_VECTOR_REST_URL=...
   UPSTASH_VECTOR_REST_TOKEN=...
   ```

   Then run the sync script:

   ```bash
   npx tsx scripts/update-brain.ts
   ```

4. **Test it:** Boot up the local dev server (`npm run dev`) and interrogate the chatbot to make sure it actually learned the new info.

## Tips for good RAG data

- Write in complete sentences, it helps the embeddings.
- Don't just list buzzwords; explain _how_ I actually used them in projects.
- Keep files focused on specific topics so the vector search retrieves the right chunks.
