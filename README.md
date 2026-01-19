# Wren

**Wren** is a map-first photo scavenger hunt app inspired by *Amazing Race*–style gameplay.

Players explore real or indoor spaces, snap photos at checkpoints, and watch the map come alive as completed locations turn into photo pins. Designed for casual, family-friendly play — bikes, walks, museums, schools, or events.

---

## ✨ What Wren Is

- A **photo-based exploration game**
- Map-driven (not list-driven)
- Works **outdoors and indoors**
- Built to be **reusable** across locations
- Optimized for **mobile web (PWA)**

---

## 🧭 Core Gameplay

1. Choose a **Race**
2. Join a **Team** (e.g. Kids vs Adults)
3. View the **Map**
   - Blank POIs = not completed
   - Completed POIs = photo pins
4. Tap a POI → read clue → **snap photo**
5. Submit → pin updates → progress tracked
6. Tap completed pins to view photos

Think: *wander → notice → snap → move on*.

---

## 🗺️ Map Engine

Wren automatically:
- Chooses a **natural zoom** for a cluster of POIs
- Splits POIs into multiple **map legs** if they’re far apart
- Supports multiple map renderers:
  - Real map (OSM / Mapbox)
  - Cartoon / illustrated map (static image)

Each race can have one or more map legs (e.g. *Downtown* → *Park*).

---

## 📍 Checkpoint Validation Types

Each checkpoint defines **how it’s completed**:

- **GPS_RADIUS**  
  Complete when user is within X meters of the location
- **QR_CODE**  
  Scan a QR code (perfect for indoor spaces)
- **PHOTO_ONLY**  
  Photo submission without location enforcement
- **MANUAL**  
  Tap to complete (fallback / accessibility)

This allows the same engine to work:
- outdoors (parks, cities)
- indoors (schools, museums)
- hybrid routes

---

## 🎨 UI Engine (Cartoon Map)

- Background: static illustrated map or styled real map
- POIs rendered as:
  - **Blank pins** (gray / inactive)
  - **Completed pins** (colored + photo thumbnail)
- Pins are tappable:
  - Blank → clue + camera
  - Done → full photo viewer

The UI engine converts lat/lng → percentage positions so the same logic works for real maps and cartoon images.

---

## 🧠 Optional Enhancements (Non-Blocking)

- AI photo stylization (cartoon / sticker / scrapbook)
- Highlight reel at end of race
- Admin race builder UI
- Animated pin unlocks
- Offline-friendly map images

AI is **never required** for validation — it’s used only for fun/polish.

---

## 🛠️ Tech Stack

- **Next.js** (App Router)
- **TypeScript**
- **Vercel** (hosting)
- **Supabase** or **Vercel Postgres + Blob**
- **Leaflet** (map rendering)
- **PWA** (Add to Home Screen)

---

## 📂 High-Level Architecture

```
/app
  /race
  /map
  /poi
  /score
/lib
  mapPlanner.ts        // clustering, bounds, zoom logic
  uiEngine.ts          // render model for cartoon maps
  validators/          // GPS, QR, Photo validators
/db
  schema.sql
/public
  /maps                // cartoon map images
```

---

## 🎯 Design Goals

- **Super simple UX**
- Big buttons, minimal text
- Two taps to submit a photo
- Works great on iPhones
- Fun first, precision second

---

## 🚧 Non-Goals (for v1)

- Continuous route tracking
- Background GPS
- AR validation
- Native App Store build

---

## 🐦 Why “Wren”

Wrens are small, curious birds known for:
- exploring paths
- noticing details
- hopping from place to place

Exactly how the app is meant to feel.

---

## 📌 Status

🚧 In active development  
Target: **v1 complete within 2 months**

---

## 📜 License

TBD
