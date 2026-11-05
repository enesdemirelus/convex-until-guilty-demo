# DESIGN: Neo Brutalism (press sheet)

The one visual language for this app. Follow it exactly. When something is not covered here,
choose the option that is flatter, bolder, more square, and more legible.
`npm run check:design` enforces the hard rules mechanically; a passing check is required.

## 1. Identity

An unfolded press sheet: cream paper, black ink, yellow posters, red interruptions, violet bands,
heavy black outlines and **solid** offset shadows. Energy comes from oversized uppercase headline
strips, small overlaps, and a few slightly rotated clippings. Reading areas (the stage, the ledger)
stay stable, upright, and clearly divided.

## 2. Tokens (authoritative)

Put these in `web/app/tokens.css` as CSS variables, and mirror the colors in `web/lib/theme.ts` for
canvas drawing. **No other file may contain a color literal.**

| Token | Value | Use |
| --- | --- | --- |
| `--dp-color-ground` | `#fff5d6` | page paper (cream) |
| `--dp-color-ink` | `#000000` | text, outlines, shadows, contour lines |
| `--dp-color-emphasis` | `#ffed00` | yellow posters, active states, key numbers |
| `--dp-color-signal` | `#ff4332` | red: interruptions, "caught", "L too small", arrow tile |
| `--dp-color-field` | `#d4bdff` | violet supporting bands |
| `--dp-color-contrast` | `#ffffff` | dense reading areas, the plot panel |
| `--dp-map-band-0` … `-7` | `#ffffff` `#fff5d6` `#fff38a` `#ffed00` `#ece2ff` `#d4bdff` `#b394ff` `#8f66ff` | landscape height bands, low → high |
| `--dp-typography-face` | `"NeoBrutalismHost", sans-serif` | everything |
| `--dp-typography-body` | `17px` | body |
| `--dp-typography-reading` | `16px` | reading text |
| `--dp-typography-small` | `14px` | small |
| `--dp-typography-metadata` | `13px` | metadata |
| `--dp-typography-label` | `12px` | labels (uppercase, +0.06em tracking) |
| `--dp-typography-reading-weight` | `700` | |
| `--dp-typography-emphasis-weight` | `800` | |
| `--dp-typography-display-weight` | `800` | Host Grotesk's maximum (the source style says 900) |
| `--dp-typography-display-tracking` | `-0.065em` | display only |
| `--dp-spacing-gap` | `24px` | |
| `--dp-spacing-gap-compact` | `18px` | |
| `--dp-radius-control` | `0` | everything is square |
| `--dp-border-panel` | `4px` | panels, buttons, the stage |
| `--dp-border-divider` | `3px` | ledger rules |
| `--dp-border-annotation` | `2px` | plot annotations, contour lines |
| `--dp-shadow-offset` | `6px` (desktop), `4px` (≤720px) | hard shadow: `x y 0 0 var(--dp-color-ink)` |
| `--dp-motion-interaction` | `0s` | controls react instantly |

**Font:** Host Grotesk, self-hosted at build time (`next/font/google` or
`@fontsource-variable/host-grotesk`), bound to the family name `NeoBrutalismHost`. Weight range is
300–800.

## 3. Page layout (one route)

```
┌──────────────────────────── cream paper ─────────────────────────────┐
│ ┏━━━━━━━━━━━━━━━━━━━━━ YELLOW POSTER (4px border) ━━━━━━━━━━━━━━━━━┓  │
│ ┃ [ROLL THE BALL]        ← black strip, cream text, rotate -1.5°     ┃  │
│ ┃   [DOWNHILL, FAST.]    ← cream strip, black text, overlaps above   ┃  │
│ ┃ [CATCH THE HILLS.] [→] ← yellow strip + one RED ARROW TILE         ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│ ┏━━ VIOLET BAND: one sentence explanation + "Pick a landscape" ━━━━━┓  │
│ ┃ [BOWL] [QUARTIC] [SADDLE] [6 POINTS] [OUTLIER]  ← preset tiles     ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│ ┏━━━━━━━━━━━━ STAGE (white panel, 4px border, hard shadow) ━━━━━━━━━┓  │
│ ┃  canvas plot                          │ LEDGER (ruled rows)        ┃  │
│ ┃                                       │ G  steps  |slope|  STATUS  ┃  │
│ ┃                                       │ N  steps  |slope|  STATUS  ┃  │
│ ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫  │
│ ┃ [▶ RUN] [RESET]  speed ▮▮▮▯   L ──●───── (preset controls)          ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  small grouped footer: credits                                         │
└────────────────────────────────────────────────────────────────────────┘
```

- The page is short: hero, violet band with presets, stage, footer. **No other sections.** No
  feature grids, testimonials, FAQ, or marketing filler.
- Exposed seams: neighboring sections share their 4px borders; one strip or the arrow tile may
  overlap a seam by ~12px, never over text or controls.
- Before a preset is chosen, the stage shows the first preset (stretched bowl) at rest with its
  start point, so the page is never empty.
- At ≤1050px tighten spacing. At ≤720px stack the plot above the ledger, soften rotations to ≤0.75°,
  use 4px shadows, keep the full labels readable.

## 4. Typography

- Display: Host Grotesk 800, uppercase, tracking −0.065em, line-height 0.9, sizes via
  `clamp()` (hero strips about 56–112px). Only the hero and the result fact are this big.
- Section labels: 12px, uppercase, weight 800, +0.06em tracking.
- Reading text: 16–17px, weight 700, upright, max ~65 characters per line.
- Numbers in the ledger: weight 800, `font-variant-numeric: tabular-nums`, large (28–40px), so
  they read from a meter away.
- Math symbols are plain text: |slope|, σ, κ, L. No KaTeX needed.

## 5. Components and states

**Button** (Run, Reset, preset tiles, toggles)
- Square, 4px black border, hard shadow `6px 6px 0 0 ink`, uppercase 800.
- Hover: translate(−2px, −2px), shadow 8px. Active/pressed: translate(4px, 4px), shadow 2px.
  Transitions are 0s (instant).
- Focus-visible: a 3px **signal red** outline offset 3px, always visible.
- Selected preset tile: yellow fill plus a black "✓" square mark (not color alone).
- Primary action RUN: yellow fill. While running it becomes PAUSE (black fill, cream text).

**Preset tile**: square card, 4px border, hard shadow, a bold 2–3 word name, a one-line hint in
reading text, and a tiny monochrome line icon drawn with 3px strokes (bowl, quartic curve, saddle,
six dots, one dot off a line). Tiles are upright.

**Ledger** (the HUD): a ruled table with 3px dividers. One row per method:
marker glyph | name | steps | |slope| | status badge. The winning row gets a yellow fill.

**Badge**: square tag, 2px border, uppercase 12–14px 800.
- `CONVERGED`: white fill, black text, a ✓ glyph.
- `CAUGHT · NOT A BOWL`: signal red fill, black text, a ✕ glyph.
- `ESCAPED`: violet fill, an ↗ glyph.
- `L TOO SMALL · FLEW OFF`: signal red fill, a → glyph.
- `RUNNING`: yellow fill.

**Slider** (L, speed, stretch): a thick 4px black track, a square thumb with a hard shadow, a
visible value label. The true-L marker is a small black tick labeled "TRUE L = 312".

**Result fact**: after a race, one tilted (−2°) yellow clipping on the stage, e.g.
"NESTEROV 9× FASTER", with a 4px border and hard shadow. Static, never animated.

## 6. The stage plot (data visualization rules)

These keep the plot both on-style and honest:

- **Landscape:** stepped (posterized) height bands using `--dp-map-band-0…7`, low = white,
  high = deep violet, computed on a grid once per preset into an offscreen canvas. Use
  log-scaled `f - min f` to place the band edges. **No smooth color ramps, no gradients.**
- **Contours:** 2px black lines on every band edge. Draw them crisp (no anti-aliasing tricks, no blur).
- **"Not a bowl here":** diagonal hatching in signal red (2px lines, 12px apart) where the smallest
  Hessian eigenvalue is negative, plus a legend chip `▨ NOT A BOWL`. Toggleable. Hatching, not a
  tint, so it reads in print and for color-blind viewers.
- **1-D presets (quartic):** a 4px black curve on a white panel with a 3px baseline; filled band
  under the curve is not needed.
- **Method markers** (fill + letter + trail style, so color is never the only cue):

| Method | Ball | Letter | Trail |
| --- | --- | --- | --- |
| Gradient descent | signal red | G | solid 3px red with 1px black edges |
| Momentum | white | M | dashed 3px black |
| Nesterov | black | N (yellow) | solid 3px black |
| Algorithm 1 | black | 1 (yellow) | solid 3px black |
| Algorithm 3 | signal red | 3 | dashed 3px red |

  Balls are 22–28px circles with a 3px black outline and a **hard** offset shadow (a black disc
  offset 3px, no blur). This is the only round shape in the app.
- **Witness pair:** square labels `U` and `V` (white fill, 2px border) on the two points, joined by
  a thick dashed black segment. **Escape step:** a violet arrow with a black outline from `u`.
- **Flew off:** a red arrow tile at the plot edge in the direction of travel, with
  "FLEW OFF → x = 100.8".
- **Fixed markers** (robust regression): true rule ★ black, least squares ■ red, robust fit ◆
  violet, each with a small labeled tag.
- Axes: 2px black, 12px uppercase labels, few ticks.

## 7. Motion

- Controls: instant (0s). No easing on hover or press.
- The run animation is the only motion. Balls move smoothly between iterates (a short linear or
  ease-out interpolation is fine); trails extend; nothing wobbles, bounces, glows, or shakes.
- Badges and the result fact appear instantly (no fades).
- `prefers-reduced-motion: reduce` → no trails, steps drawn instantly, no interpolation.

## 8. Banned (enforced by `npm run check:design` where possible)

- Gradients of any kind (CSS `*-gradient(`, canvas `createLinearGradient`/`createRadialGradient`,
  Tailwind `bg-gradient-*`).
- Blur anywhere: `blur(`, `backdrop-filter`, blurred `box-shadow`, canvas `shadowBlur`.
- Rounded corners (`border-radius` other than 0, Tailwind `rounded*` other than `rounded-none`).
  Exception: the method balls on the canvas.
- Soft/default shadows (Tailwind `shadow`, `shadow-md`, …). Only hard `x y 0 0 ink` shadows.
- Color literals outside `web/app/tokens.css` and `web/lib/theme.ts`.
- Glassmorphism, neon glow, dark-mode stage, pill-shaped chips, emoji as icons, random stickers,
  stock illustrations, icon libraries with rounded soft styles.
- Generic layouts: centered marketing hero with a subtitle and two buttons, three-column feature
  grid, cards that all look the same with no hierarchy.
- Text over busy plot areas without a solid white backing tag.

## 9. Accessibility

- Contrast: black on cream/yellow/violet/white; red only with black text on it.
- Every control is keyboard reachable with a visible focus outline; preset tiles are radio buttons
  (`role="radiogroup"`).
- The canvas has an `aria-label` describing the preset, and the ledger is a real `<table>`.
- Outcomes are announced in an `aria-live="polite"` region ("Nesterov converged in 158 steps").
