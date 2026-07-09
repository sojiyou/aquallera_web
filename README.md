# AQUA-LLERA Admin Dashboard

Admin dashboard for the AQUA-LLERA water station management platform.

## Features

- **Orders Management** — View and filter customer orders; mobile card layout with customer name, phone, amount, and View button.
- **Grouped Delivery View ("By Time")** — Toggle between list view and time-grouped view of today's `on_delivery` deliveries with bulk status update capabilities. Header shows "Deliveries for today: {date}".
- **Stock & Analytics** — Inventory tracking, revenue projections with confidence level, year-over-year comparison, and performance reports.
- **Water Consumption Analytics** — Monthly/annual consumption tracking with stacked bar charts and circular progress indicators.
- **Station Settings** — Manage station info, location, operating hours, services, pricing, delivery hours, and delivery days (day-of-week toggle).
- **Station Signup (6 steps)** — Multi-step registration: Basic Info → Location (Mapbox map) → Services (types, hours, delivery radius, delivery hours, delivery days) → Pricing → Business Permit → Account. Includes inline field validation with real-time password indicators.
- **Admin Panel** — Pending/approved station review, admin invitation management, business permit inspection.

## Mobile Responsiveness

Designed for 375px (iPhone SE/12/13) and up with responsive breakpoints:

### Dashboard
| Component | Mobile (`<md`) | Desktop (`md+`) |
|---|---|---|
| Orders | Card layout (customer + phone + View) | Full table with Type, Status, Amount columns |
| Nav pills | `px-2 py-1.5 text-[11px]`, `gap-1` | Full-width pill buttons |

### Stock & Performance
- Analytics cards: `p-4 sm:p-6`, numbers `text-2xl sm:text-3xl`
- Inventory cards: `p-4 sm:p-8`, count `text-3xl sm:text-5xl`, label `text-sm sm:text-lg`
- Year Forecast amounts: `text-lg sm:text-2xl`
- Revenue projection: confidence badge, refresh button, and date text inline using `text-[11px]` mobile / `text-sm` desktop with compact padding
- Historical Performance: section `p-4 sm:p-8`, stat cards `grid-cols-1 sm:grid-cols-3`, expanded metrics `flex-col sm:flex-row`
- Annual Reports: section `p-4 sm:p-8`, breakdown rows `flex-col sm:flex-row`, stat cards `grid-cols-1 sm:grid-cols-3`, summary `p-4 sm:p-6`

### Water Consumption Analytics
- Circular progress cards: `p-3 sm:p-5`, grid `grid-cols-1 sm:grid-cols-3`
- Monthly chart: stacked `BarChart` (8px bars, 220px height, compact legend)
- Annual view: container `p-4 sm:p-5`, water-type labels shortened (`g P • g S • g M`), Year Summary `text-sm sm:text-xl`

### Admin Page
- Header: `flex-col sm:flex-row`, title `text-xl sm:text-3xl`
- Stats cards: `p-4 sm:p-6`, numbers `text-2xl sm:text-3xl`
- Tab bar: `overflow-x-auto` with `whitespace-nowrap`, compact `px-3 py-2 text-xs` on mobile
- Admins list: card layout on mobile, full table on `md+`
- Station cards: `minmax(min(100%,500px),1fr)` grid, detail labels `min-w-[90px]` mobile / `120px` desktop
- Action buttons: `min-w-[100px]` mobile / `140px` desktop
- Invite dialog: `w-[90vw] max-w-[400px]`
- Station details modal: responsive padding

## Vercel Deployment

The project is configured for Vercel. The `CI=true` build will pass with zero ESLint warnings.

To deploy:
```bash
npm run build
```

## Available Scripts

### `npm start`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds for production to the `build` folder. The build is minified with hashed filenames.

### `npm run eject`

Ejects from Create React App configuration (one-way operation).

## Tech Stack

- React (Create React App)
- Tailwind CSS
- Firebase (Realtime Database, Auth, Storage)
- Recharts (charts)
- EmailJS (email notifications)
- Mapbox GL (location picker)

## Session Log

| Session ID | What we did |
|---|---|
| `2026-07-09` | Added delivery days (Settings.js, Signup.js) with day-of-week toggle; split Signup from 5 to 6 steps (Location + Services separated); added grouped delivery orders view with "By Time"/"List View" toggle and bulk status update; replaced PWA date picker with available date buttons; fixed BOM warning in Settings.js; added inline validation with `onBlur` and real-time password indicators; limited grouped view to today's `on_delivery` orders with "Deliveries for today: {date}" header |
