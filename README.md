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
