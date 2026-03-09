# Tarpapel Generator

Generate print-ready, tiled PDFs for large tarpapel posters using a regular printer.

## Features
- Drag and drop image upload
- Poster size presets + custom size
- A4, A3, Letter, Legal, or Tabloid paper selection
- Tile overlap for cutting/taping
- Preview grid before download
- Optional cut guide lines

## Tech Stack
- Node.js + Express
- Multer (uploads)
- Sharp (image processing)
- pdf-lib (PDF generation)
- Vanilla JS + TailwindCSS (CDN)

## Run Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
3. Open:
   ```bash
   http://localhost:3000
   ```

## GitHub Pages (Frontend Only)
1. Copy the frontend to `docs/`:
   ```bash
   powershell -Command "New-Item -ItemType Directory -Force -Path docs | Out-Null; Copy-Item -Path client\\* -Destination docs\\ -Recurse -Force"
   ```
2. Commit and push.
3. In GitHub, go to **Settings → Pages** and set:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`

Note: GitHub Pages will host only the frontend. The PDF generation API still requires the Node/Express backend to be hosted elsewhere.

## API
`POST /api/generate`

Form fields:
- `image` (file)
- `posterSize` (2x3 | 3x4 | 4x6 | custom)
- `paperSize` (A4 | A3 | Letter | Legal | Tabloid)
- `overlap` (inches)
- `customWidth` (feet, required if custom)
- `customHeight` (feet, required if custom)
- `includeGuides` (true/false)
