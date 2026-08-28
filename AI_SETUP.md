# Krishi Saathi AI + Interactive Mascot

The project now includes:

- An interactive animated Krishi Saathi mascot on the home, onboarding, login, farmer and officer screens.
- A mobile-friendly AI chat panel.
- Text chat, browser voice input, and read-aloud responses.
- Farmer context passed to the AI (crop, district, soil, irrigation, risk, weather and market sample data when available).
- Gemini integration through the Express backend, so the API key is not exposed in React.
- A demo fallback response when no Gemini key is configured or the API is temporarily unavailable.
- Mobile farmer navigation tabs for Home, Advice, Mandi and Risk.

## Add your key

1. Open `backend`.
2. Copy `.env.example` to `.env`.
3. Open `backend/.env`.
4. Replace:

   GEMINI_API_KEY=PASTE_YOUR_KEY_HERE

   with the key you created in Google AI Studio.

5. Keep the key private. Do not paste it into the frontend and do not commit `.env` to GitHub.

## Run locally

Terminal 1:

```powershell
cd backend
npm install
npm run dev
```

Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## AI endpoint

The frontend calls `POST /api/chat`. The backend calls the Gemini REST API with the server-side `GEMINI_API_KEY`.

The default model is `gemini-2.5-flash-lite`, which is intended for lightweight, low-latency chat in this prototype.
