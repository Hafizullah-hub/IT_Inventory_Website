# IT Inventory

IT Inventory is an asset management portal with a Next.js frontend and an Express/MongoDB backend.

## Project structure

- `frontend/` - Next.js web application
- `backend/` - Express API and MongoDB models

## Run locally

Install dependencies in each application:

```bash
cd backend
npm install
cd ../frontend
npm install
```

Create `backend/.env` with the backend configuration:

```env
PORT=5000
MONGODB_URI=your-mongodb-connection-string
GEMINI_API_KEY=your-gemini-api-key
```

Keep `.env` files local; they are ignored by Git. The frontend calls the relative `/api` path, which Next.js proxies to the backend. Locally, the proxy defaults to `http://localhost:5000`.

Run the backend and frontend in separate terminals:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

## Cloud deployment

Deploy the backend and frontend as separate services from this repository:

### Render (backend)

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Set `MONGODB_URI` to the MongoDB Atlas connection string.
- Set `FRONTEND_URL` to the deployed Vercel site origin, such as `https://your-project.vercel.app`.
- Set `GEMINI_API_KEY` if AI search is needed. Render supplies `PORT` automatically.

### Vercel (frontend)

- Root Directory: `frontend`
- Set `BACKEND_URL` to the Render service origin, such as `https://your-service.onrender.com` (no trailing slash or `/api`).
- No `NEXT_PUBLIC_API_URL` is needed; browser API requests use `/api` and are proxied by Next.js.

Vercel preview subdomains ending in `.vercel.app` are also accepted by the backend CORS configuration.
