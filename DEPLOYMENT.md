# Deployment

## Frontend on Vercel
1. Import the repository.
2. Set root directory to `frontend`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Environment variable:
   `VITE_API_BASE_URL=https://YOUR-BACKEND-DOMAIN/api`

## Backend on Render/Railway
1. Deploy `backend`.
2. Build: `npm run build`.
3. Start: `npm start`.
4. Environment:
   - `PORT=4000`
   - `JWT_SECRET=<strong random secret>`
   - `FRONTEND_ORIGIN=https://YOUR-VERCEL-DOMAIN`

## Production database
Replace `backend/data/db.json` with PostgreSQL/Supabase/Neon before production use. The API layer is already separated so the UI does not need to change.
