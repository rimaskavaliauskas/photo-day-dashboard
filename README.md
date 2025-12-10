# Photo Day Dashboard 📷

A photographer's dashboard showing optimal shooting conditions, locations, and task recommendations.

## Features

- **Golden Hour & Blue Hour Windows**: Automatically calculated for your location
- **Photo Day Score**: Weather-based scoring (0-100) for outdoor photography
- **Nearby Photo Locations**: Interesting spots from Google Places API
- **Smart Task Recommendations**: Match your photo tasks to optimal weather/light windows
- **YouTube Inspiration**: Latest videos from photography channels

## Architecture

```
photo-day-dashboard/
├── worker/          # Cloudflare Workers + D1 backend
│   ├── src/
│   │   ├── index.ts           # Main entry point & router
│   │   ├── handlers/          # HTTP API handlers
│   │   ├── cron/              # Cron job handlers
│   │   ├── lib/               # Shared utilities (sun, geo, weather)
│   │   └── types.ts           # TypeScript types
│   ├── schema.sql             # D1 database schema
│   ├── wrangler.toml          # Cloudflare config
│   └── package.json
│
├── frontend/        # Next.js app (deployed to Vercel)
│   ├── src/
│   │   ├── app/               # App router pages
│   │   ├── components/        # React components
│   │   └── lib/               # API client, utils
│   ├── next.config.js
│   └── package.json
│
├── sample-tasks.csv # Example tasks sheet format
└── README.md
```

## Tech Stack

- **Backend**: Cloudflare Workers (TypeScript) + D1 (SQLite)
- **Frontend**: Next.js 14+ (App Router) + Tailwind CSS
- **APIs**:
  - Google Places API (New) - location search & photos
  - Open-Meteo - free weather API (no key required!)
  - YouTube Data API v3 - photography channel videos
  - Google Sheets (CSV export) - task management

---

## Quick Start

### 1. Clone and Install

```bash
# Install worker dependencies
cd worker
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set Up Cloudflare D1 Database

```bash
cd worker

# Create the D1 database
npx wrangler d1 create photo-day-db

# Copy the database_id from output and paste into wrangler.toml
# Then run migrations
npx wrangler d1 execute photo-day-db --local --file=./schema.sql
```

### 3. Configure Environment Variables

**Worker** (`worker/.dev.vars`):
```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your API keys
```

**Frontend** (`frontend/.env.local`):
```bash
cp .env.example .env.local
# Edit if needed (defaults to localhost:8787)
```

### 4. Set Up Google Sheets Tasks (Optional)

1. Create a Google Sheet with columns: `task_id, title, location, radius_km, condition, time_window, notes, active`
2. See `sample-tasks.csv` for example format
3. Publish the sheet: **File > Share > Publish to web > CSV**
4. Add the CSV URL to `worker/.dev.vars` as `TASKS_SHEET_URL`

### 5. Run Development Servers

```bash
# Terminal 1: Worker
cd worker
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

Open http://localhost:3000 to see the dashboard!

---

## API Keys Setup

### Google Places API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable "Places API (New)"
3. Create an API key and restrict it to Places API
4. Add to `GOOGLE_PLACES_API_KEY`

### YouTube Data API
1. In the same Google Cloud project
2. Enable "YouTube Data API v3"
3. Use the same API key or create a new one
4. Add to `YOUTUBE_API_KEY`

### Weather API
No key needed! We use [Open-Meteo](https://open-meteo.com/) which is free and doesn't require authentication.

---

## Deployment

### Deploy Worker to Cloudflare

```bash
cd worker

# Set production secrets
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put TASKS_SHEET_URL

# Deploy
npm run deploy

# Run remote database migration
npx wrangler d1 execute photo-day-db --file=./schema.sql
```

### Deploy Frontend to Vercel

1. Push code to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Set root directory to `frontend`
4. Add environment variable:
   - `NEXT_PUBLIC_WORKER_URL` = `https://photo-day-worker.YOUR-SUBDOMAIN.workers.dev`
5. Deploy!

---

## Task Conditions Reference

| Condition | Description |
|-----------|-------------|
| `golden-hour-morning` | Morning golden hour (around sunrise) |
| `golden-hour-evening` | Evening golden hour (around sunset) |
| `golden-hour-any` | Either morning or evening golden hour |
| `blue-hour-morning` | Morning blue hour (before sunrise) |
| `blue-hour-evening` | Evening blue hour (after sunset) |
| `fog` | Foggy/misty conditions |
| `overcast` | Heavy cloud cover (good for portraits) |
| `cloudy` | Partly cloudy |
| `clear-any` | Clear skies |
| `clear-noon` | Clear skies, midday |
| `any` | Any weather conditions |

## Time Windows

| Window | Description |
|--------|-------------|
| `any_day` | No time restriction |
| `morning_only` | Before noon |
| `evening_only` | After noon |
| `weekend_only` | Saturday/Sunday only |
| `weekday_only` | Monday-Friday only |

---

## Cron Jobs

The worker runs these scheduled tasks:

| Schedule | Job | Description |
|----------|-----|-------------|
| Every hour | `places-and-weather` | Sync nearby places, weather, and sun windows |
| Every hour | `task-windows` | Calculate optimal shooting windows for tasks |
| Every hour | `youtube-sync` | Fetch latest videos from configured channels |
| Every 15 min | `tasks-sync` | Sync tasks from Google Sheets |

---

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT
