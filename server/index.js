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
  // appliances table
  db.run(
    `CREATE TABLE IF NOT EXISTS appliances (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      building TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      floor TEXT,
      room TEXT
    )`
  );
});

// Seed appliances if empty
const defaultAppliances = [
  {
    id: "1",
    type: "Microwave",
    building: "Killam Library",
    confidence: 95,
    lat: 44.6369,
    lng: -63.5903,
    floor: "Ground Floor",
    room: "Student Lounge",
  },
  {
    id: "2",
    type: "Fridge",
    building: "Goldberg Bldg",
    confidence: 90,
    lat: 44.6375,
    lng: -63.5915,
    floor: "2nd Floor",
    room: "Staff Kitchen",
  },
  {
    id: "3",
    type: "Microwave",
    building: "Killam Library",
    confidence: 95,
    lat: 44.6368,
    lng: -63.5901,
    floor: "3rd Floor",
    room: "Study Room",
  },
  {
    id: "4",
    type: "Fridge",
    building: "Science Building",
    confidence: 88,
    lat: 44.6371,
    lng: -63.59,
    floor: "Main Floor",
    room: "Commons",
  },
  {
    id: "5",
    type: "Fridge",
    building: "Killam Library",
    confidence: 92,
    lat: 44.6367,
    lng: -63.5904,
    floor: "Basement",
    room: "Break Room",
  },
  {
    id: "6",
    type: "Microwave",
    building: "Engineering Annex",
    confidence: 85,
    lat: 44.638,
    lng: -63.591,
    floor: "1st Floor",
    room: "Student Hub",
  },
];

db.get(`SELECT COUNT(*) as cnt FROM appliances`, (err, row) => {
  if (err) {
    console.error("Failed to check appliances count:", err);
    return;
  }
  if (!row || row.cnt === 0) {
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO appliances (id, type, building, confidence, lat, lng, floor, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    db.serialize(() => {
      for (const a of defaultAppliances) {
        stmt.run(
          a.id,
          a.type,
          a.building,
          a.confidence,
          a.lat,
          a.lng,
          a.floor || null,
          a.room || null
        );
      }
      stmt.finalize();
    });
    console.log("Seeded appliances table with default data.");
  }
});

// Endpoint to get all appliances
app.get("/appliances", (req, res) => {
  db.all(`SELECT * FROM appliances`, (err, rows) => {
    if (err) {
      console.error("DB select error (appliances):", err);
      return res.status(500).json({ error: "Failed to query appliances" });
    }
    res.json(rows);
  });
});

// Endpoint to add an appliance (optional)
app.post("/appliances", (req, res) => {
  const a = req.body || {};
  if (
    !a.id ||
    !a.type ||
    !a.building ||
    typeof a.lat !== "number" ||
    typeof a.lng !== "number"
  ) {
    return res.status(400).json({ error: "id,type,building,lat,lng required" });
  }
  db.run(
    `INSERT OR REPLACE INTO appliances (id, type, building, confidence, lat, lng, floor, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.id,
      a.type,
      a.building,
      a.confidence || 0,
      a.lat,
      a.lng,
      a.floor || null,
      a.room || null,
    ],
    function (err) {
      if (err) {
        console.error("DB insert appliance error:", err);
        return res.status(500).json({ error: "Failed to upsert appliance" });
      }
      res.json({ success: true });
    }
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
