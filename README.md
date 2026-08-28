# Krishi Saathi — Full-Stack Prototype

A hackathon-ready prototype for PS-02: Smart Crop Advisory & Farmer Distress Early-Warning System.

## Architecture

- `frontend/` — React + Vite + TypeScript dashboard
- `backend/` — Express + TypeScript REST API
- `backend/data/db.json` — lightweight JSON persistence for prototype use
- No Convex
- No real API keys required
- No ML model required yet
- Rule-based risk engine now; replaceable with an ML service later

## Features

### New Farmer
- Multi-step onboarding questionnaire
- Farmer profile creation through backend API
- Crop, land, location, irrigation, loan and concern information

### Existing Farmer
- Login using prototype credentials
- Farmer dashboard
- Weather, crop advisory, mandi prices
- Distress score with factor breakdown
- Voice advisory using browser speech synthesis

### Officer
- Officer login
- Risk alert dashboard
- High/medium/low filtering
- Farmer detail view
- Contact/send advisory/mark reviewed actions
- Intervention status

## Demo accounts

Farmer:
- Email: `ramesh@demo.com`
- Password: `demo123`

Officer:
- Email: `officer@krishisaathi.demo`
- Password: `demo123`

## Run locally

From the root:

```bash
npm install
npm run install:all
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

If you run them separately:

```bash
cd backend
npm install
npm run dev
```

and:

```bash
cd frontend
npm install
npm run dev
```

## Environment variables

Backend `.env`:

```env
PORT=4000
JWT_SECRET=change-this-for-real-deployment
FRONTEND_ORIGIN=http://localhost:5173
```

Frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

## Risk engine

Current prototype formula:

- Rainfall deviation: 40%
- Market price drop: 35%
- Loan due-date proximity: 25%

The implementation is deliberately isolated in:

`backend/src/services/riskEngine.ts`

Later you can replace that function with a trained ML model without rewriting the UI.

## Future integrations

The backend has clean service boundaries for:
- Weather API
- Soil API
- Mandi/market API
- Government scheme API
- SMS/WhatsApp/voice providers
- ML distress model

For now, these return simulated district-level data.

## Important deployment note

The JSON file is intended for a prototype/demo. For production, replace it with PostgreSQL/Supabase/Neon or another persistent database.
