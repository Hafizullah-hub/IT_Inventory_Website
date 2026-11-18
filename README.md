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
MONGO_URI=your-mongodb-connection-string
GEMINI_API_KEY=your-gemini-api-key
```

Keep `.env` files local; they are ignored by Git. The frontend uses `http://localhost:5000/api/assets` by default. To use a different API URL, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.

Run the backend and frontend in separate terminals:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```
