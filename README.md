# Photo Day Dashboard 📷

A photographer's intelligent dashboard for planning optimal shooting sessions. Get real-time weather conditions, golden/blue hour timings, and AI-powered recommendations for your photography locations.

**Live Demo**: Deployed on Vercel + Cloudflare Workers

---

## User Experience

### For Landscape & Outdoor Photographers

The Photo Day Dashboard solves the daily challenge photographers face: **"When and where should I shoot today?"**

#### What You See at a Glance

1. **Golden Hour Timeline** - A visual timeline showing exactly when golden and blue hours occur for the next 3 days. The red dot shows "you are here" so you can instantly see if you're in or near a prime shooting window.

2. **Conditions Gauge** - A radial gauge displaying current photography conditions:
   - Sky clarity (cloud coverage inverted - higher is clearer)
   - Visibility distance
   - Precipitation status
   - Overall photo score (0-100)

3. **Weather Charts** - Interactive charts with toggleable layers:
   - Temperature trends
   - Cloud coverage over time
   - Precipitation forecast
   - Photo score predictions
   - "Best photo times" badges highlighting optimal windows

4. **Forecast Cards** - Day-by-day breakdown showing:
   - Score badge (color-coded: green=excellent, yellow=good, red=poor)
   - Sunrise/sunset times
   - Morning & evening cloud coverage progress bars
   - Golden and blue hour time ranges

#### Workflow

1. **Add your favorite locations** to a Google Sheet (name, lat, lng, notes)
2. **Sync** the sheet to import locations into the dashboard
3. **Check weather** for each location with one click
4. **View the timeline** to pick the best shooting window
5. **Ask AI** for photography tips specific to each location
6. **Discover new spots** using AI-powered place discovery

#### AI Features

- **Ask AI**: Chat with an AI photography assistant about any location - get tips on compositions, best times, gear recommendations
- **AI Discover**: Uses Tavily search + AI analysis to find hidden photogenic spots near your saved locations

---

## Features

### Core Features
- **Golden Hour & Blue Hour Windows**: Automatically calculated sunrise/sunset-based photo windows
- **Photo Day Score**: Weather-based scoring (0-100) for outdoor photography conditions
- **My Photo Locations**: Sync your favorite spots from Google Sheets
- **Nearby Photo Spots**: Discover interesting locations via Google Places API

### Enhanced Visualizations
- **Conditions Gauge**: Multi-factor radial gauge showing sky clarity, visibility, precipitation
- **Golden Hour Timeline**: Horizontal timeline with golden/blue hour segments and current time marker
- **Interactive Weather Charts**: Toggle temperature, clouds, precipitation, visibility, photo score
- **Enhanced Forecast Cards**: Score badges, progress bars, sunrise/sunset times

### AI-Powered Features
- **AI Chat Assistant**: Ask photography questions about any location
- **AI Discover**: Find photogenic places using Tavily web search + AI analysis

### Additional Features
- **Smart Task Recommendations**: Match photo tasks to optimal weather/light windows
- **YouTube Inspiration**: Latest videos from photography channels
- **Pin to Sheet**: Save discovered places back to your Google Sheet

---

## Architecture

```
photo-day-dashboard/
├── worker/          # Cloudflare Workers + D1 backend
│   ├── src/
│   │   ├── index.ts           # Main entry point & router
│   │   ├── handlers/          # HTTP API handlers
│   │   │   ├── ai-chat.ts     # AI photography assistant
│   │   │   ├── ai-discover.ts # Tavily-powered place discovery
│   │   │   ├── my-places.ts   # Location management
│   │   │   └── dashboard.ts   # Main dashboard data
│   │   ├── cron/              # Scheduled job handlers
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
│   │   │   ├── ConditionsGauge.tsx    # Radial weather gauge
│   │   │   ├── GoldenHourTimeline.tsx # Visual timeline
│   │   │   ├── WeatherChart.tsx       # Interactive charts
│   │   │   ├── PlaceRow.tsx           # Location card with forecast
│   │   │   ├── ChatPanel.tsx          # AI chat interface
│   │   │   └── AIDiscoverModal.tsx    # AI discovery modal
│   │   └── lib/               # API client, utilities
│   ├── next.config.js
│   └── package.json
│
└── README.md
```

---

## Tech Stack

- **Backend**: Cloudflare Workers (TypeScript) + D1 (SQLite)
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Recharts
- **AI**: Cloudflare Workers AI + Anthropic Claude API
- **APIs**:
  - **WeatherAPI.com** - Primary weather provider (API key auth, no rate limit issues)
  - **Open-Meteo** - Fallback weather API (free, no key required)
  - **Google Places API (New)** - Location search & photos
  - **Tavily API** - AI-powered web search for place discovery
  - **YouTube Data API v3** - Photography channel videos
  - **Google Sheets** - Location & task management

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
# Required
GOOGLE_PLACES_API_KEY=your_key
WEATHER_API_KEY=your_weatherapi_key  # Get free at weatherapi.com

# Optional - for AI features
ANTHROPIC_API_KEY=your_key           # For Claude AI chat
TAVILY_API_KEY=your_key              # For AI Discover

# Optional - for Google Sheets sync
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_email
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=your_key
GOOGLE_SHEET_ID=your_sheet_id

# Optional - for YouTube videos
YOUTUBE_API_KEY=your_key
YOUTUBE_CHANNELS=channel_id_1,channel_id_2
```

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
```

### 4. Run Development Servers

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

### WeatherAPI.com (Recommended)
1. Sign up at [weatherapi.com](https://www.weatherapi.com/)
2. Get your free API key (1M calls/month free)
3. Add to `WEATHER_API_KEY`

> **Why WeatherAPI.com?** Open-Meteo uses IP-based rate limiting which causes issues with Cloudflare Workers (shared IPs). WeatherAPI.com uses API key authentication, avoiding this problem.

### Google Places API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable "Places API (New)"
3. Create an API key and restrict it to Places API
4. Add to `GOOGLE_PLACES_API_KEY`

### Tavily API (for AI Discover)
1. Sign up at [tavily.com](https://www.tavily.com/)
2. Get your API key (1,000 free searches/month)
3. Add to `TAVILY_API_KEY`

### Anthropic API (for AI Chat)
1. Sign up at [anthropic.com](https://www.anthropic.com/)
2. Get your API key
3. Add to `ANTHROPIC_API_KEY`

### YouTube Data API
1. In Google Cloud Console, enable "YouTube Data API v3"
2. Use the same API key or create a new one
3. Add to `YOUTUBE_API_KEY`

---

## Deployment

### Deploy Worker to Cloudflare

```bash
cd worker

# Set production secrets
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put WEATHER_API_KEY
npx wrangler secret put TAVILY_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put YOUTUBE_API_KEY
# ... add other secrets as needed

# Deploy
npm run deploy

# Run remote database migration
npx wrangler d1 execute photo-day-db --file=./schema.sql
```

### Deploy Frontend to Vercel

1. Push code to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. **Important**: Set root directory to `frontend`
4. Add environment variable:
   - `NEXT_PUBLIC_WORKER_URL` = `https://photo-day-worker.YOUR-SUBDOMAIN.workers.dev`
5. Deploy!

---

## Recent Updates

### v2.0 - Enhanced Visualization & AI Features

**Backend**
- Switched from Open-Meteo to WeatherAPI.com to avoid shared IP rate limits
- Added AI Chat endpoint with Cloudflare Workers AI + Claude fallback
- Added AI Discover feature using Tavily web search + AI analysis
- Improved weather data with visibility and precipitation

**Frontend**
- New **ConditionsGauge** component - radial gauge showing multiple weather factors
- New **GoldenHourTimeline** component - visual timeline for golden/blue hours
- Enhanced **WeatherChart** - toggleable data series, photo score overlay
- Improved **ForecastDay cards** - score badges, progress bars, sunrise/sunset
- Added **AI Chat panel** - ask photography questions about any location
- Added **AI Discover modal** - find hidden photogenic spots

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

The worker runs scheduled tasks every 6 hours:

| Job | Description |
|-----|-------------|
| `sheets-sync` | Sync places from Google Sheet |
| `places-and-weather` | Update weather and discover nearby places |
| `youtube-sync` | Fetch latest videos from configured channels |

---

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT
