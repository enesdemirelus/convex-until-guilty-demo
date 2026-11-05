---
description: Screenshot the page and audit it against DESIGN.md, then fix what fails
---

1. Start the dev server in `web/` (`npm run dev`) if it is not running.
2. In the browser, capture screenshots at 1440×900 and at 390×844 of:
   - the page at rest (top of page, then scrolled to the stage),
   - every preset at rest, mid-run, and finished (once Phase 5 exists).
3. Run `npm run check:design`.
4. Audit each screenshot against this checklist and write PASS or FAIL with a reason for each item:
   - [ ] Matches the layout sketch in `DESIGN.md` section 3; no extra sections.
   - [ ] Cream paper ground, yellow hero poster with overlapping uppercase strips, one red arrow
         tile, violet band with the preset tiles.
   - [ ] Every panel and control has a 4px black border, square corners, and a hard offset shadow.
   - [ ] No gradients, blur, glow, rounded corners, soft shadows, pills, or emoji anywhere.
   - [ ] Display type is Host Grotesk, uppercase, heavy, tightly tracked; reading text is bold and
         upright; nothing falls back to a system font.
   - [ ] Ledger numbers are large enough to read from about 1 meter on a laptop screen.
   - [ ] The plot uses posterized bands, black contours, and red hatching; no smooth color ramps.
   - [ ] Each method is distinguishable without color (letter in the ball, trail style).
   - [ ] No overlap covers text or a control; no text is clipped or wraps awkwardly.
   - [ ] Tabbing through every control shows a visible red focus outline.
   - [ ] At 390×844 everything stacks cleanly, nothing scrolls sideways, labels stay complete.
   - [ ] Hover and press feedback is instant (lift on hover, press toward the shadow).
5. Fix every FAIL in the code, then repeat steps 2–4 once and report the final checklist with the
   screenshots.
