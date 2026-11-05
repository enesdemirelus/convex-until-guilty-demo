# Roll the Ball: agent instructions

You are building a one-page, offline Next.js demo for a math research poster: visitors pick a
preset landscape and watch optimization algorithms race across it.

## Read first, every session

1. `SPEC.md`: what to build, the exact math, the presets, and the reference numbers.
2. `DESIGN.md`: the only visual language allowed (neo-brutalist press sheet). Follow it exactly.
3. The math source of truth: `../codes/convex_until_guilty.py`.

## Non-negotiables

- One route (`/`). Presets only; visitors never type functions. No extra pages or sections.
- Fully offline at runtime: no CDNs, no remote fonts, no network calls.
- The math in `web/lib/math/` must match the Python reference. Tests reproduce the reference numbers
  in `SPEC.md`. Never change a reference number to make a test pass.
- Visual rules come from `DESIGN.md`, not from your defaults. No gradients, no blur, no rounded
  corners, no soft shadows, no color literals outside `web/app/tokens.css` and `web/lib/theme.ts`.
- `npm run check:design` (runs `../scripts/check-design.mjs`) must pass before you call any UI task
  done. Do not weaken or edit that script to make it pass; fix the code instead.

## How to work

- Follow the `/build-demo` workflow phase by phase. Finish and verify each phase before starting
  the next.
- Build the UI as a static mockup first (fake data), review it with `/ui-review`, then wire up the
  math and animation.
- Look at your own output: take browser screenshots at 1440×900 and 390×844 and compare them with
  the layout sketch in `DESIGN.md` section 3 before saying a UI step is finished.
- Keep components small: Hero, PresetPicker, Stage (canvas), Controls, Ledger, Badge, Button.
- When unsure about a visual choice, choose flatter, bolder, more square, more legible.

## Done means

Everything in `SPEC.md` → "Definition of done" is true, and you have shown the user screenshots of
every preset at rest, mid-run, and finished.
