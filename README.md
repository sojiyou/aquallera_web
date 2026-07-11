# AQUA-LLERA Admin Dashboard

Admin dashboard for the AQUA-LLERA water station management platform.

## Features

- **Orders Management** — View and filter customer orders; mobile card layout with customer name, phone, amount, and View button.
- **Calendar View** — Toggle between list view and interactive month calendar. Color-coded status dots on each date; click a day to see its orders grouped by time with bulk status update. Delivery day columns (e.g. Mon, Fri) are highlighted on the header.
- **Stock & Analytics** — Inventory tracking, revenue projections with confidence level, year-over-year comparison, and performance reports.
- **Water Consumption Analytics** — Monthly/annual consumption tracking with stacked bar charts and circular progress indicators.
- **Station Settings** — Manage station info, location, operating hours, services, pricing, delivery hours, and delivery days (day-of-week toggle).
- **Station Signup (6 steps)** — Multi-step registration: Basic Info → Location (Mapbox map) → Services (types, hours, delivery radius, delivery hours, delivery days) → Pricing → Business Permit → Account. Includes inline field validation with real-time password indicators.
- **Admin Panel** — Pending/approved station review, admin invitation management, business permit inspection.

## Tech Stack

- React (Create React App)
- Tailwind CSS
- Firebase (Realtime Database, Auth, Storage)
- Recharts (charts)
- react-calendar (calendar view)
- EmailJS (email notifications)
- Mapbox GL (location picker)

## Getting Started

### `npm start`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds for production to the `build` folder. The build is minified with hashed filenames.

### `npm run eject`

Ejects from Create React App configuration (one-way operation).

## Vercel Deployment

The project is configured for Vercel. The `CI=true` build will pass with zero ESLint warnings.

To deploy:
```bash
npm run build
```

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

## Recent Changes

| Date | Commit | Changes |
|------|--------|---------|
| Jul 11 | `493a7e2` | **Fix Calendar white screen** — `formatShortWeekday` must return string (not JSX); delivery day headers styled via CSS `nth-child` column targeting |
| Jul 11 | `6f678e3` | **Delivery day highlights** — Calendar weekday headers (Mon, Tue...) styled in bold teal for station's configured delivery days; added legend strip |
| Jul 11 | `9e60408` | **Calendar view** — Replaced "By Time" grouped view with interactive month calendar using `react-calendar`. Color-coded status dots on dates; click day for inline order list with bulk status updates |
| Jul 9 | `978a8d5` | **Grouped delivery view** — Added "By Time" / "List View" toggle with bulk status update for today's `on_delivery` deliveries |
| Jul 9 | `f91e7bb` | **Delivery days + 6-step signup** — Added day-of-week toggle in Settings & Signup; split signup into 6 steps (Location + Services separated) |
| Jul 9 | `b386328` | **Inline validation** — Added `onBlur` validation with real-time password strength indicators to signup form |
| Jul 9 | `645c076` | **Limit grouped view** — Restricted grouped delivery view to today's `on_delivery` orders with "Deliveries for today: {date}" header |
| Jul 9 | `3d2462e` | **Order status colors** — Unified order status badges into blue gradient progression (Pending → Preparing → For Pickup → For Delivery → Completed) |
| Jul 9 | `4a13b61` | **Order filters + modal fix** — Added "For Pickup" / "For Delivery" filter options; fixed modal buttons not refreshing after status update |
| Jul 9 | `bceac28` | **Revert status colors** — Restored original order status colors after gradient test |
| Jul 9 | `945bd66` | **Mobile consumption cards** — Stacked stat cards vertically on mobile; adjusted grid breakpoints and text overflow |
| Jul 9 | `a656fa7` | **Charts on mobile** — Hid charts behind placeholder message on mobile; changed logout button to `primary-darkest` |
| Jul 8 | `316e566` | **TimePickerWheel + admin list** — Added TimePickerWheel component; admin list page with UI refinements |
| Jul 8 | `95eed25` | **Admin page responsive** — Fixed station card grid, header, tab bar, table, and modals for mobile |
| Jul 8 | `584f0db` | **Revenue card alignment** — Fixed confidence badge / refresh button / date text alignment on mobile |
| Jul 8 | `4dfd5c1` | **CI build cleanup** — Removed all ESLint warnings across 14 files for zero-warning Vercel build |
| Jul 8 | `79b5c8c` | **Hero padding** — Fixed hero section top padding on mobile to avoid nav overlap |
| Jul 8 | `25870b8` | **Firebase imports** — Fixed import paths in AnnualReports and HistoricalPerformance |
| Jul 8 | `96a4317` | **Favicon** — Updated to Aquallera logo |
| Jul 8 | `b3c6bb9` | **Password toggle** — Added show/hide password button on login and signup pages |
| Jul 7 | `e2a2d96` | **Dashboard UI polish** — Wavy gradient background, 12-hour time format, fixed delivery hours, removed coords from signup, fixed stock input zero edge case, converted spring water L to gal, hid annual report charts behind expand toggle |
| Jul 7 | `3a6e2f3` | **AlertCard component** — Replaced all native `alert()` calls across Auth and Dashboard files with styled AlertCard |
| Jul 6 | `f162f3c` | **Delivery address on map** — Show delivery address and map in order detail; fixed rejection handling; unified dashboard background |
| Jul 2 | `a9f5ced` | **Tailwind CSS migration** — Aquallera web 3.0: migrated entire UI to Tailwind CSS |
| Jul 2 | `dc881ea` | **Admin invite system** — Added admin invitation management, blue theme, email/password login, and UI refinements |
| Jul 2 | `2ceb9f1` | **Color theme** — Changed color theme and fixed various bugs |

## Session Log

| Session ID | What we did |
|---|---|
| `2026-07-09` | Added delivery days (Settings.js, Signup.js) with day-of-week toggle; split Signup from 5 to 6 steps (Location + Services separated); added grouped delivery orders view with "By Time"/"List View" toggle and bulk status update; replaced PWA date picker with available date buttons; fixed BOM warning in Settings.js; added inline validation with `onBlur` and real-time password indicators; limited grouped view to today's `on_delivery` orders with "Deliveries for today: {date}" header |
| `2026-07-11` | Replaced "By Time" grouped view with Calendar view (`react-calendar`); orders shown on interactive month grid with color-coded status dots; delivery day columns highlighted on weekday headers via CSS nth-child |
