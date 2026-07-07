# HERA — Heritage Risk Assessment & Decision-Support Tool

MSc Thesis Prototype — Mariam Elmezayen, GIU
"An AI-Assisted Heritage Risk Assessment and Decision-Support Framework"

## What changed in this version

This is the same HERA prototype (identical calculations, workflow, HRI
engine, Decision Matrix, RAG knowledge base, and climate modules) reorganized
from one single HTML file into a proper local web app, so it runs over
`http://localhost` instead of `file://` and can be deployed later without
another rewrite.

**Nothing about how HERA behaves has changed.** This was a pure reorganization:
- `index.html` — the page shell only (no inline CSS/JS anymore)
- `src/style.css` — all styling, moved out of the `<style>` tag
- `src/data/formulas.js` — ESS/BCS/OIS/HRI scoring engine
- `src/data/network.js` — shared fetch helper (timeout + offline handling)
- `src/data/climate.js` — IPCC AR6 SSP climate scenario projection
- `src/data/knowledgeBase.js` — the RAG text knowledge base + tag retrieval
- `src/app.js` — state, geo module, strategy engine, action-plan builder,
  image retrieval, Conservation Action Plan rendering, and the page router
- `src/main.js` — entry point; wires the functions the generated HTML calls
  (via `onclick`, `onchange`, etc.) onto `window`, since that's how the
  in-page inline handlers find them

A full, byte-identical copy of the previous single-file version is kept in
`backup/` — if anything here ever seems off, that file still works exactly
as before by double-clicking it, no server required.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (this was built and tested on Node 22)

## Running it locally

```bash
npm install      # first time only
npm run dev      # starts a local server and opens the app
```

This starts a dev server at **http://localhost:5173** and opens it in your
browser automatically. Leave the terminal window open while you work —
closing it stops the server. To stop it manually, press `Ctrl+C` in that
terminal.

## Building a static copy (optional)

```bash
npm run build     # outputs to dist/
npm run preview   # serve the built copy locally to sanity-check it
```

`dist/` is a fully static build — every file in it can later be uploaded to
any static host (GitHub Pages, Netlify, a university web server, etc.) with
no further changes, since `vite.config.js` is already set up with relative
asset paths for that.

## External APIs used (all free, no API key required)

- **OpenStreetMap Nominatim** — place search / reverse geocoding
- **Open-Meteo** — live temperature, humidity, solar radiation, elevation, air quality
- **Wikimedia Commons** — fallback photo retrieval for the knowledge base
- **Leaflet** (via CDN) — the interactive map widget

All of these already worked from the old `file://` version too — the
`fetch()` calls to these external HTTPS APIs aren't blocked by the `file://`
origin. If you were seeing API failures before, it's worth checking whether
it was actually a rate-limit or a specific endpoint issue rather than the
`file://` protocol itself; this restructure doesn't change how any of the
API calls are made, only how the files are organized.

## Known limitations (unchanged from before, now just documented here)

- The RAG knowledge base is keyword/tag-based, not embeddings-based semantic
  search — there's no backend to run an embedding model against.
- There's no server-side storage: saved building comparisons and the image
  cache live in the browser's own storage (`localStorage`), so they're
  per-browser, not portable the way the app files themselves are.
