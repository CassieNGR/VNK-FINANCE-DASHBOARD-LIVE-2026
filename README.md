# V&K Group — Financial Dashboard

A React + Express + SQLite dashboard for tracking sales orders, purchase orders, and accounts receivable / accounts payable snapshots, month over month. Comes pre-loaded with January–July 2026 data:
- Full sales order and purchase order history for Jan–Jul 2026
- An accounts receivable and accounts payable snapshot as of July 31, 2026

January–June don't yet have their own AR/AP snapshots (only July 31 does) — those pages will simply show "no snapshot yet" for those months until you upload one, which is expected.

## How it's structured

```
vk-dashboard/
  client/     React + Vite frontend (the dashboard UI)
  server/     Express API + SQLite database
```

The frontend talks to the backend over a small API (`/api/months`, `/api/month/:key`, `/api/upload`, `/api/history`). In production, the Express server also serves the built frontend, so it deploys as a single Render web service.

## Running it locally (optional, only if you want to test before deploying)

```
cd server && npm install && npm start
```
In a second terminal:
```
cd client && npm install && npm run dev
```
Open the URL Vite prints (usually `http://localhost:5173`).

## Putting it on GitHub

1. Create a new empty repository on GitHub (no README/license, so there's nothing to conflict with).
2. Using GitHub's web interface: upload this whole `vk-dashboard` folder — drag all the files/folders in, including the `client` and `server` folders — using "Add file" → "Upload files". GitHub does support uploading nested folders by dragging them in as a group.
3. Commit directly to `main`.

## Deploying on Render

1. In Render, choose **New → Web Service** and connect the GitHub repo you just created.
2. Settings:
   - **Environment:** Node
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
3. **Persistent Disk (important):** SQLite writes to a file on disk. Render's web services have an *ephemeral* filesystem by default — anything written to disk is wiped on every redeploy. To keep your uploaded data permanently:
   - Add a **Persistent Disk** to the service (Render dashboard → your service → Disks).
   - Mount it at, say, `/data`.
   - Add an environment variable `DB_PATH` = `/data/dashboard.db`.
   Without this step, the dashboard will still work, but a redeploy will reset it back to the seeded July data.
4. Deploy. Render will run the build, then start the server, which serves the dashboard at your Render URL.

## Updating going forward

No redeploy needed for new data — just open the dashboard's **Import data** page and upload:
- the new month's sales orders file (master file, whole month)
- the new month's purchase orders file (master file, whole month)
- an AR snapshot and an AP snapshot, each tagged with whatever date they're "as of"

AR and AP are point-in-time balance reports, not transaction logs — each upload just adds (or replaces, if you re-upload the same date) one snapshot on the calendar. You don't need one per day; upload as often as makes sense for your reporting cadence (monthly, weekly, or ad hoc), and the trend charts and aging views will reflect whatever snapshots exist.

The month selector at the top of the dashboard will automatically pick up new months as they're uploaded.
