# Roll the Ball — Convex Until Proven Guilty

Interactive offline demo for Enes Demirel's poster at the DePaul Undergraduate STEM Research Showcase (Faculty sponsor: Dr. Enrico Au-Yeung, Department of Mathematical Sciences, DePaul University), based on Carmon, Duchi, Hinder, and Sidford (2017), *"Convex Until Proven Guilty: Dimension-Free Acceleration of Gradient Descent on Non-Convex Functions"*.

## Running Offline on Linux

1. Ensure **Node.js 20+** is installed (`node -v`).
2. Install dependencies from the lockfile:
   ```bash
   npm ci
   ```
3. Build the static export into `out/`:
   ```bash
   npm run build
   ```
4. Serve the static site locally (no internet connection required):
   ```bash
   npm run serve
   ```
5. Open `http://localhost:3000` in your browser and press **F11** for fullscreen kiosk display.

## Development & Verification Scripts

```bash
npm run dev            # Start local Next.js development server
npm run build          # Static export to web/out/
npm run serve          # Serve web/out/ offline
npm test               # Run Vitest math reference suite
npm run check:design   # Enforce DESIGN.md Neo-Brutalist rules
```
