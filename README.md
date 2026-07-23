# Student Class Tracker

A React + Vite rebuild of the classroom tracker for attendance, homework, behavior, skills, rewards, timers, CSV export, and older-class LMS reports.

## Run locally

```bash
npm install
npm run dev
```

Build the GitHub Pages bundle:

```bash
npm run build
```

The Vite `base` is `/Student-tracker/` for GitHub Pages. The Pages workflow installs dependencies, builds the app, and publishes `dist`.

## Project structure

- `src/main.jsx` - functional React screens and modals.
- `src/model.js` - student/class normalization, scoring, CSV, rewards, LMS mapping, reports, and reset helpers.
- `src/storage.js` - localStorage compatibility using the existing `classTracker::` keys.
- `src/styles.css` - sunny sky / citrus / coral / mint theme tokens and responsive classroom layout.
- `public/` - PWA manifest, SVG icon, and simple service worker.
