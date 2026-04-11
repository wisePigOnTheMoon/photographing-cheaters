# Deploying photographing-cheaters

Frontend → **Vercel**, Backend → **Render**, Database → **MongoDB Atlas (blakedb)**.

---

## 1. Push the code to GitHub

From the project root:

```bash
cd /Users/sophia/photographing-cheaters
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on GitHub (https://github.com/new). Name it e.g. `photographing-cheaters`. **Do not** initialize it with a README. Then:

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/photographing-cheaters.git
git push -u origin main
```

> `backend/.env` is gitignored, so your Mongo password will NOT be pushed. Good.

---

## 2. MongoDB Atlas — allow access from anywhere

1. Go to https://cloud.mongodb.com → your `blakedb` cluster.
2. Left sidebar → **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
   - Render's outbound IPs are dynamic on the free tier, so this is the simplest option.

---

## 3. Deploy the backend to Render

1. Sign in at https://render.com with your GitHub account.
2. **New +** → **Blueprint** → pick the `photographing-cheaters` repo.
   - Render will detect `render.yaml` and prefill everything.
3. When prompted, fill in the env vars marked `sync: false`:
   - `MONGODB_URI` → paste from `backend/.env`:
     ```
     mongodb+srv://sophialig4c2_db_user:VjX2uz3hWbCkl9DE@blakedb.sl30wne.mongodb.net/?appName=blakedb
     ```
   - `FRONTEND_ORIGIN` → leave **blank for now** (we'll fill it in after deploying the frontend).
4. Click **Apply**. Wait ~3 minutes for the first build.
5. Once it shows **Live**, copy the public URL, e.g.
   `https://photographing-cheaters-api.onrender.com`
6. Test it: open `https://photographing-cheaters-api.onrender.com/api/health` → should return `{"ok":true}`.

> **Free-tier note:** Render free web services sleep after 15 min of inactivity. The first request after sleep takes ~30s to wake. Upgrade to Starter ($7/mo) to keep it warm.

---

## 4. Deploy the frontend to Vercel

1. Sign in at https://vercel.com with GitHub.
2. **Add New** → **Project** → import `photographing-cheaters`.
3. **Configure Project**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App (auto-detected)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `build` (default)
4. **Environment Variables**:
   - `REACT_APP_GOOGLE_CLIENT_ID` → `74349467717-p52k4k4e74p93baqaqkv754le0nb46ap.apps.googleusercontent.com`
   - `REACT_APP_API_URL` → your Render URL from step 3, e.g. `https://photographing-cheaters-api.onrender.com`
5. Click **Deploy**. After ~2 min you'll get a URL like `https://photographing-cheaters.vercel.app`.

---

## 5. Lock CORS to your Vercel domain

1. Back in **Render** → your service → **Environment**.
2. Edit `FRONTEND_ORIGIN` and set it to your Vercel URL, e.g.
   `https://photographing-cheaters.vercel.app`
   (If you have multiple Vercel preview URLs, comma-separate them.)
3. Save → Render will auto-redeploy.

---

## 6. Update Google OAuth authorized origins

1. Go to https://console.cloud.google.com/apis/credentials
2. Find the OAuth 2.0 Client ID matching `74349467717-...`.
3. Under **Authorized JavaScript origins**, add:
   - `https://photographing-cheaters.vercel.app` (your real Vercel URL)
   - Keep `http://localhost:3000` for local dev
4. Save. Changes can take a few minutes to propagate.

> If you don't add your Vercel domain here, the Google sign-in button will silently fail in production.

---

## 7. Smoke test

1. Open your Vercel URL.
2. Sign in with Google.
3. Upload a photo + reason → should see "Submitted! Your DQ count is now N."
4. Open Leaderboard → your name should appear with the right count.
5. In MongoDB Atlas → **Browse Collections** on `blakedb` → confirm `users`, `submissions`, `photos.files`, `photos.chunks` exist.

---

## Updating later

- Push to `main` on GitHub → both Vercel and Render auto-redeploy.
- To change a backend env var: Render dashboard → Environment → save (auto-redeploys).
- To change a frontend env var: Vercel dashboard → Settings → Environment Variables → redeploy.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `CORS error` in browser console | Make sure `FRONTEND_ORIGIN` on Render exactly matches your Vercel URL (including `https://`, no trailing slash). |
| Sign-in button never appears | Add your Vercel URL to Google Cloud → Credentials → Authorized JS origins. |
| `Invalid token` from `/api/submissions` | Google `GOOGLE_CLIENT_ID` env var on Render must match the one the frontend uses. |
| Backend logs `MongoServerSelectionError` | Atlas Network Access doesn't allow Render IPs → set to `0.0.0.0/0`. |
| First request after idle is slow | Render free tier cold start. Upgrade or hit `/api/health` on a cron. |
