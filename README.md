# Shepherd — Disciples & Churches Tracker

A simple, map-first PWA for tracking the disciples you steward and the churches you care for.

## Features

- **Two views** — Disciples and Churches, switched with a liquid-glass bottom pill nav.
- **Map-first** — every person and church is a pin on a world map (Hawaii, California, Japan, Texas… wherever). Tap a pin to open their profile.
- **Building vs Blessing** — each entry is marked by your level of responsibility: 🔨 *Building* (responsible for) or 🕊️ *Blessing* (contributing toward).
- **Health & check-ins** — set a health status (Healthy / Needs attention / Struggling), log check-ins with notes, and see how long since your last follow-up. It's a lightweight relational CRM, not a table.
- **List view** — tap ☰ for a scrollable card list with health dots and last-contact info.
- **Offline-capable PWA** — installable to your home screen; data lives in localStorage on your device.

## Running

It's a static site — serve the folder with anything:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open it on your phone and "Add to Home Screen" to install.

## Adding entries

Tap **+**, fill in the name/place/relationship/health, then tap **📍** and tap the map to drop the pin.
