import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { readDb, writeDb } from "./db.js";
import { auth, role, AuthRequest } from "./middleware/auth.js";
import { calculateRisk } from "./services/riskEngine.js";
import { buildAdvisory } from "./services/advisory.js";
import { getMarket, getWeather } from "./services/mockData.js";

const router = Router();
const secret = process.env.JWT_SECRET || "prototype-secret";

function tokenFor(user: any) {
  return jwt.sign({ id: user.id, role: user.role, farmerId: user.farmerId }, secret, { expiresIn: "7d" });
}

function farmerRisk(farmer: any) {
  const weather = getWeather(farmer.district);
  const market = getMarket(farmer.crop);
  const avgPrice = market.reduce((a, b) => a + b.price, 0) / market.length;
  const referencePrice = farmer.crop === "Paddy" ? 2700 : avgPrice * 1.05;
  const priceChange = ((avgPrice - referencePrice) / referencePrice) * 100;
  const loanDays = Math.ceil((new Date(farmer.loanDueDate).getTime() - Date.now()) / 86400000);
  const risk = calculateRisk({
    rainfallDeviation: weather.rainfallDeviation,
    priceChange,
    loanDays
  });
  return { ...risk, rainfallDeviation: weather.rainfallDeviation, priceChange: Number(priceChange.toFixed(1)), loanDays };
}

router.get("/health", (_req, res) => res.json({ ok: true, service: "Krishi Saathi API" }));

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  res.json({
    token: tokenFor(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role, farmerId: user.farmerId }
  });
});

router.post("/auth/register", async (req, res) => {
  const { name, email, password, ...profile } = req.body ?? {};
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });

  const db = readDb();
  if (db.users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const userId = randomUUID();
  const farmerId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  db.users.push({ id: userId, name, email, passwordHash, role: "farmer", farmerId });
  db.farmers.push({
    id: farmerId,
    userId,
    name,
    village: profile.village || "",
    district: profile.district || "",
    state: profile.state || "Odisha",
    crop: profile.crop || "Paddy",
    landAcres: Number(profile.landAcres || 0),
    irrigation: profile.irrigation || "Rainfed",
    soilType: profile.soilType || "Loamy",
    language: profile.language || "English",
    phone: profile.phone || "",
    loanDueDate: profile.loanDueDate || new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    concern: profile.concern || "General crop advisory",
    createdAt: new Date().toISOString()
  });
  writeDb(db);

  res.status(201).json({
    token: tokenFor(db.users.at(-1)),
    user: { id: userId, name, email, role: "farmer", farmerId }
  });
});

router.get("/farmers/me", auth, role("farmer"), (req: AuthRequest, res) => {
  const db = readDb();
  const farmer = db.farmers.find(f => f.id === req.user?.farmerId);
  if (!farmer) return res.status(404).json({ message: "Farmer profile not found" });
  res.json({ farmer });
});

router.get("/farmers/:id", auth, (req: AuthRequest, res) => {
  const db = readDb();
  const farmer = db.farmers.find(f => f.id === req.params.id);
  if (!farmer) return res.status(404).json({ message: "Farmer not found" });
  if (req.user?.role === "farmer" && req.user.farmerId !== farmer.id) {
    return res.status(403).json({ message: "Not allowed" });
  }
  res.json({ farmer, risk: farmerRisk(farmer) });
});

router.get("/advisory/:farmerId", auth, (req: AuthRequest, res) => {
  const db = readDb();
  const farmer = db.farmers.find(f => f.id === req.params.farmerId);
  if (!farmer) return res.status(404).json({ message: "Farmer not found" });
  if (req.user?.role === "farmer" && req.user.farmerId !== farmer.id) return res.status(403).json({ message: "Not allowed" });
  res.json({ advisory: buildAdvisory(farmer) });
});

router.get("/weather/:district", auth, (_req, res) => {
  const district = String(_req.params.district);
  res.json({ weather: getWeather(district) });
});

router.get("/market/:crop", auth, (_req, res) => {
  const crop = String(_req.params.crop);
  res.json({ crop, markets: getMarket(crop) });
});

router.get("/risk/:farmerId", auth, (req: AuthRequest, res) => {
  const db = readDb();
  const farmer = db.farmers.find(f => f.id === req.params.farmerId);
  if (!farmer) return res.status(404).json({ message: "Farmer not found" });
  if (req.user?.role === "farmer" && req.user.farmerId !== farmer.id) return res.status(403).json({ message: "Not allowed" });
  res.json({ risk: farmerRisk(farmer) });
});


router.post("/chat", async (req, res) => {
  const { message, history = [], context = {} } = req.body ?? {};
  const cleanMessage = String(message || "").trim().slice(0, 1200);
  if (!cleanMessage) return res.status(400).json({ message: "Please enter a question." });

  const farmer = context?.farmer || {};
  const language = farmer.language || context?.language || "English";
  const systemInstruction = `You are Krishi Saathi AI, a calm and practical agricultural assistant for Indian farmers.
Answer in the farmer's preferred language when possible (${language}). Keep answers short, simple, actionable, and easy to understand on a basic smartphone.
Use the supplied farmer context when it is relevant. Never invent live weather, mandi prices, government scheme eligibility, or official deadlines. If live data is not supplied, say it is sample/demo data and suggest checking the official local source.
For crop disease or chemical/pesticide questions, give cautious general guidance and recommend a local agriculture officer/expert for diagnosis before chemical use.
If a farmer appears to be facing serious financial distress, encourage contacting the agriculture officer, local support services, or a trusted person rather than making financial promises.
Do not claim to be a government official. You are a prototype advisory assistant.
Farmer context: ${JSON.stringify({
    name: farmer.name,
    village: farmer.village,
    district: farmer.district,
    state: farmer.state,
    crop: farmer.crop,
    landAcres: farmer.landAcres,
    irrigation: farmer.irrigation,
    soilType: farmer.soilType,
    language: farmer.language,
    concern: farmer.concern,
    risk: context?.risk,
    weather: context?.weather,
    market: Array.isArray(context?.market) ? context.market.slice(0, 4) : context?.market
  })}`;

  const fallback = `I can help with ${farmer.crop || "your crop"}, weather, mandi prices, crop care and your farm risk. For this prototype, live AI is not connected yet. Try asking: “What should I do if heavy rain is expected?”`;

  if (!process.env.GEMINI_API_KEY) return res.json({ reply: fallback, source: "demo" });

  try {
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const recent = Array.isArray(history) ? history.slice(-8).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "").slice(0, 1200) }]
    })) : [];
    recent.push({ role: "user", parts: [{ text: cleanMessage }] });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: recent,
        generationConfig: { maxOutputTokens: 500 }
      })
    });
    const data = await response.json() as any;
    if (!response.ok) throw new Error(data?.error?.message || `Gemini request failed (${response.status})`);
    const reply = String(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join(" ") || "").trim();
    res.json({ reply: reply || fallback, source: "gemini" });
  } catch (error: any) {
    console.error("Gemini chat error:", error?.message || error);
    res.json({ reply: fallback, source: "demo-fallback" });
  }
});

router.get("/officer/alerts", auth, role("officer"), (_req, res) => {
  const db = readDb();
  const alerts = db.farmers
    .map(farmer => ({ farmer, risk: farmerRisk(farmer) }))
    .sort((a, b) => b.risk.score - a.risk.score);
  res.json({ alerts });
});

router.post("/officer/interventions", auth, role("officer"), (req: AuthRequest, res) => {
  const { farmerId, action, note } = req.body ?? {};
  if (!farmerId || !action) return res.status(400).json({ message: "farmerId and action are required" });
  const db = readDb();
  const intervention = {
    id: randomUUID(),
    farmerId,
    officerId: req.user!.id,
    action,
    note: note || "",
    status: action === "Mark reviewed" ? "resolved" : "contacted",
    createdAt: new Date().toISOString()
  } as const;
  db.interventions.push(intervention);
  writeDb(db);
  res.status(201).json({ intervention });
});

router.get("/officer/interventions/:farmerId", auth, role("officer"), (req, res) => {
  const db = readDb();
  res.json({ interventions: db.interventions.filter(i => i.farmerId === req.params.farmerId) });
});

export default router;
