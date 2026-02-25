require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const Fuse = require("fuse.js");
const { initDB, dbRun, dbAll } = require("./database");

const app = express();
app.use(cors());
app.use(express.json());

// 1. Rate Limiting (Requirement 7)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Try again in 15 minutes." }
});
app.use("/api/", limiter);

// 2. Load Docs & Local Fuzzy Logic (Greetings/Exits)
const docs = JSON.parse(fs.readFileSync("./docs.json"));

const localReplies = [
  { keys: ["hi", "hello", "hey", "hlo", "greetings"], reply: "Hi! I'm Sam. How can I help you with our product guides today?" },
  { keys: ["bye", "goodbye", "exit", "see ya", "tata"], reply: "Goodbye! Feel free to reach out if you have more questions." },
  { keys: ["thanks", "thank you", "thx"], reply: "You're very welcome! Is there anything else you need?" }
];

const fuse = new Fuse(localReplies, { 
  keys: ["keys"], 
  threshold: 0.4 // 0.4 allows for slight typos like 'hlo'
});

// --- Helper: Similarity Math ---
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * (vecB[i] || 0), 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return (magA && magB) ? dot / (magA * magB) : 0;
}

// --- Helper: Get Embeddings with SQLite Caching ---
async function getEmbedding(text) {
  try {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    const cached = await dbAll(`SELECT embedding FROM embedding_cache WHERE content_hash = ?`, [hash]);
    
    if (cached.length > 0) return JSON.parse(cached[0].embedding);

    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    const data = await res.json();
    const vector = data.data[0].embedding;
    
    await dbRun(`INSERT OR IGNORE INTO embedding_cache (content_hash, embedding) VALUES (?, ?)`, [hash, JSON.stringify(vector)]);
    return vector;
  } catch (e) { return []; }
}

async function prepDocs() {
  for (let doc of docs) { doc.embedding = await getEmbedding(doc.content); }
  console.log(" Sam's knowledge base is indexed.");
}

// --- Main Chat Endpoint ---
app.post("/api/chat", async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) return res.status(400).json({ error: "Missing data" });

  const cleanMsg = message.toLowerCase().trim();

  try {
    // A. PRIORITY 1: Fuzzy Match (Greetings/Exits - 0 Cost)
    const fuzzy = fuse.search(cleanMsg);
    if (fuzzy.length > 0) {
      const reply = fuzzy[0].item.reply;
      await dbRun(`INSERT OR IGNORE INTO sessions (id) VALUES (?)`, [sessionId]);
      await dbRun(`INSERT INTO messages (session_id, role, content) VALUES (?, 'assistant', ?)`, [sessionId, reply]);
      return res.json({ reply, tokensUsed: 0 });
    }

    // B. PRIORITY 2: Semantic Search (RAG)
    const userVec = await getEmbedding(cleanMsg);
    let bestMatch = { doc: null, score: 0 };
    
    docs.forEach(doc => {
      const score = cosineSimilarity(userVec, doc.embedding);
      if (score > bestMatch.score) bestMatch = { doc, score };
    });

    // C. FIX: Manual Keyword Boost for "Returns"
    // If user says "return" and our best doc is "refund", boost the score
    if (cleanMsg.includes("return") && bestMatch.doc?.content.toLowerCase().includes("refund")) {
      bestMatch.score = 0.5; // Force it past the guardrail
    }

    // D. Guardrail (Anti-hallucination)
    if (bestMatch.score < 0.22) {
      const fallback = "I'm sorry, I only have information on shipping and refunds. Could you please rephrase your question?";
      return res.json({ reply: fallback, tokensUsed: 0 });
    }

    // E. LLM Call
    const historyRows = await dbAll(`SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 10`, [sessionId]);
    const history = historyRows.reverse().map(h => `${h.role}: ${h.content}`).join("\n");

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: `You are Sam. Use ONLY: ${bestMatch.doc.content}. If a user asks for 'return', use the refund info. Context:\n${history}` },
          { role: "user", content: message }
        ]
      })
    });
    
    const aiData = await aiRes.json();
    const reply = aiData.choices[0].message.content;

    // F. Save to DB
    await dbRun(`INSERT OR IGNORE INTO sessions (id) VALUES (?)`, [sessionId]);
    await dbRun(`INSERT INTO messages (session_id, role, content) VALUES (?, 'user', ?)`, [sessionId, message]);
    await dbRun(`INSERT INTO messages (session_id, role, content) VALUES (?, 'assistant', ?)`, [sessionId, reply]);

    res.json({ reply, tokensUsed: aiData.usage?.total_tokens || 0 });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/api/conversations/:sessionId", async (req, res) => {
  const rows = await dbAll(`SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC`, [req.params.sessionId]);
  res.json(rows);
});

initDB().then(() => {
  prepDocs().then(() => {
    app.listen(3000, () => console.log(" Server: http://localhost:3000"));
  });
});