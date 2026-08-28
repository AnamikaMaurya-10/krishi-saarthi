import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { Db } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, "../data/db.json");

function ensureFile() {
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify({ users: [], farmers: [], interventions: [] }, null, 2));
  }
}

export function readDb(): Db {
  ensureFile();
  return JSON.parse(fs.readFileSync(dataPath, "utf8")) as Db;
}

export function writeDb(db: Db) {
  fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
}

export function seedDemoUsers() {
  const db = readDb();
  const hash = bcrypt.hashSync("demo123", 10);

  const ensureUser = (email: string, name: string, role: "farmer" | "officer", id: string, farmerId?: string) => {
    const existing = db.users.find(u => u.email === email);
    if (existing) {
      existing.passwordHash = hash;
      existing.name = name;
      existing.role = role;
      existing.farmerId = farmerId;
    } else {
      db.users.push({ id, name, email, passwordHash: hash, role, farmerId });
    }
  };

  ensureUser("ramesh@demo.com", "Ramesh Kumar", "farmer", "u1", "f1");
  ensureUser("priya@demo.com", "Priya Devi", "farmer", "u2", "f2");
  ensureUser("officer@krishisaathi.demo", "Agriculture Officer", "officer", "u3");

  writeDb(db);
}
