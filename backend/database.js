const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./support_assistant.db");

const initDB = () => {
  return new Promise((resolve) => {
    db.serialize(() => {
      // Sessions: Tracks unique chat users
      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Messages: Stores every interaction for context
      db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      )`);

      // Optimization: Cache for document embeddings to save API costs
      db.run(`CREATE TABLE IF NOT EXISTS embedding_cache (
        content_hash TEXT PRIMARY KEY,
        embedding TEXT
      )`);
      
      resolve();
    });
  });
};

const dbRun = (sql, params) => new Promise((res, rej) => db.run(sql, params, (err) => err ? rej(err) : res()));
const dbAll = (sql, params) => new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));

module.exports = { db, initDB, dbRun, dbAll };