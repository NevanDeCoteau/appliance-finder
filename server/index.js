import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = `${__dirname}/data.db`;
sqlite3.verbose();
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to open database:", err);
    process.exit(1);
  }
  console.log("Connected to SQLite database at", dbPath);
});

// Initialize table
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applianceId TEXT NOT NULL,
      atLocation INTEGER NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL
    )`
  );
});

app.post("/report", (req, res) => {
  const { applianceId, atLocation, note } = req.body || {};
  if (!applianceId || typeof atLocation !== "boolean") {
    return res
      .status(400)
      .json({ error: "applianceId and atLocation required" });
  }

  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO reports (applianceId, atLocation, note, createdAt) VALUES (?, ?, ?, ?)`,
    [applianceId, atLocation ? 1 : 0, note || null, createdAt],
    function (err) {
      if (err) {
        console.error("DB insert error:", err);
        return res.status(500).json({ error: "Failed to save report" });
      }
      return res.json({ success: true, id: this.lastID });
    }
  );
});

app.get("/reports", (req, res) => {
  db.all(`SELECT * FROM reports ORDER BY id DESC LIMIT 100`, (err, rows) => {
    if (err) {
      console.error("DB select error:", err);
      return res.status(500).json({ error: "Failed to query reports" });
    }
    res.json(rows);
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
