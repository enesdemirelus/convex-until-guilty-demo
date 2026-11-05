---
description: Build the Roll the Ball demo phase by phase, verifying each phase before the next
---

Read `AGENTS.md`, `SPEC.md`, and `DESIGN.md` in full before starting. Complete each phase, run its
check, and report what you verified before moving on. Stop and ask the user if a check cannot pass.

## Phase 1: Scaffold
1. In `demo/`, run `npx create-next-app@latest web --ts --app --eslint --no-src-dir --import-alias "@/*" --use-npm --yes` (add `--tailwind` only if you will map its theme to the tokens).
2. Set `output: "export"` in `web/next.config`. Add scripts: `test` (vitest), `serve` (serve out),
   `check:design` (`node ../scripts/check-design.mjs`). Add `vitest` and `serve` as devDependencies.
3. Create `web/app/tokens.css` with every token from `DESIGN.md` section 2, and `web/lib/theme.ts`
   mirroring the colors. Load Host Grotesk at build time as `NeoBrutalismHost`.
4. Delete the create-next-app demo content, default styles, and dark-mode CSS.
5. Check: `npm run build` succeeds and `npm run check:design` passes.

## Phase 2: Math
1. Write `web/lib/math/{vec,algorithms,presets}.ts` per `SPEC.md`.
2. Write tests reproducing every reference number in `SPEC.md`.
3. Check: `npm test` is green. Paste the passing test summary into your report.

## Phase 3: Static UI mockup (no math wiring yet)
1. Build Hero, the violet band with PresetPicker, the Stage shell (empty white plot panel), the
   Ledger with fake rows, Controls, Badges, and the footer, exactly as in `DESIGN.md` sections 3–5.
2. Run `/ui-review` and fix everything it finds.
3. Check: `npm run check:design` passes; show the user the two screenshots.

## Phase 4: Landscapes
1. Render each preset's landscape on the canvas: posterized bands, black contours, red hatching for
   "not a bowl", the 1-D curve view for the quartic, the 6 points, and the fixed markers for the
   robust regression (`DESIGN.md` section 6).
2. Check: screenshot every preset at rest and confirm each matches section 6.

## Phase 5: Running
1. Wire the algorithms to the stage: balls, trails, live ledger, adaptive steps per frame, play /
   pause / reset, speed, and the preset controls (stretch, L slider with the true-L tick, start
   choices, arrangement picker).
2. Outcomes: converged, caught (U/V labels and the dashed segment), escaped (violet arrow),
   flew off (red edge arrow), and the tilted result fact.
3. Reduced motion support and the `aria-live` announcements.
4. Check: run every preset with its defaults and confirm the outcomes and step counts match
   `SPEC.md`. Screenshot each preset mid-run and finished.

## Phase 6: Ship
1. Write `web/README.md` (Linux steps from `SPEC.md`).
2. `npm run build && npm run serve` with networking off; confirm the page works.
3. Run `/ui-review` one final time.
4. Report against every item of `SPEC.md` → "Definition of done".
