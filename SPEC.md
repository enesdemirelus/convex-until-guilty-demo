# SPEC: Roll the Ball

What to build, and the exact math. How it should **look** is in `DESIGN.md`.
All paths below are relative to this `demo/` folder. The Next.js app lives in `web/`.

## Purpose

An interactive website for Enes Demirel's poster at the DePaul Undergraduate STEM Research
Showcase. Visitors walk up to the desk, pick a preset, press Run, and watch optimization
algorithms race across a function's landscape. It runs on a Linux laptop, **offline**. A hosted
copy (reachable by QR code) is optional.

Research sources (for accuracy only; never copy their prose):
- Paper: Carmon, Duchi, Hinder, Sidford (2017), "Convex Until Proven Guilty": `../paper/`
- **Reference implementation (source of truth for all math):** `../codes/convex_until_guilty.py`
- Poster results: `../RESULTS.md`; experiment scripts: `../codes/exp*.py`

## Product requirements

1. **One page, one route (`/`).** No other routes, navigation, login, settings, or about page.
2. **Presets only.** Visitors never type a function.
3. **The page is calm until Run.** Above the stage: the hero, one sentence, and the preset picker.
4. **The running stage is the showpiece.** Put most of the design and polish effort there.
5. **Fully offline.** No runtime network requests: no CDNs, no remote fonts (self-host Host Grotesk
   with `next/font/google`, which bundles it at build time, or `@fontsource-variable/host-grotesk`),
   no analytics, no remote images.
6. **Readable from a standing distance** on a laptop (large HUD numbers), and usable on a phone.
7. Plain-language copy for curious non-experts, matching the poster: "bowl" = convex, "hill" =
   non-convex, "caught" / "guilty", "witness pair (u, v)", "L = sharpest bend".

## Tech stack

- Next.js (App Router, TypeScript), created with `create-next-app` **inside `web/`**.
- `output: "export"` in `next.config` (static site in `web/out/`).
- Landscape rendering: Canvas 2D. No chart libraries. Tailwind is optional; if used, Tailwind
  theme values must come from the tokens in `DESIGN.md`.
- Math in plain TypeScript (JS numbers are float64).
- Vitest for math tests.

### Scripts (in `web/package.json`)

```
npm run dev            # development
npm run build          # static export to web/out/
npm run serve          # serve web/out/ offline (add `serve` as a devDependency)
npm test               # Vitest math tests
npm run check:design   # node ../scripts/check-design.mjs  (must pass; see DESIGN.md)
```

Write `web/README.md` with the Linux steps: Node 20+, `npm ci`, `npm run build`,
`npm run serve`, open `http://localhost:3000`, press F11 for fullscreen.

## Project layout

```
demo/
  AGENTS.md  SPEC.md  DESIGN.md  scripts/check-design.mjs  .agents/
  web/
    app/page.tsx            the only route
    app/layout.tsx          font + tokens.css
    app/tokens.css          the ONLY place CSS colors and sizes are defined
    lib/theme.ts            the ONLY place canvas colors are defined (mirrors tokens.css)
    components/             Hero, PresetPicker, Stage, Controls, Ledger, Badge, Button
    lib/math/
      vec.ts                1-D/2-D vector helpers
      algorithms.ts         GD, momentum, Nesterov, Algorithms 1, 2, 3
      presets.ts            functions, gradients, Hessians, domains, starts, L, sigma
      __tests__/            Vitest tests (reference numbers below)
```

Keep `lib/math` free of React and DOM code.

## Algorithms (port exactly from `../codes/convex_until_guilty.py`)

Notation: `L` = sharpest bend (step = `1/L`); `sigma` = gentlest bend the monitor expects;
`kappa = L / sigma`; momentum `omega = (sqrt(kappa) - 1) / (sqrt(kappa) + 1)`; `eps = 1e-6`.
Every algorithm returns its full trajectory (every iterate) plus a final status.

1. **Gradient descent:** `x <- x - grad(x)/L` until `|grad(x)| <= eps`.
2. **Momentum (heavy ball):** `x_next = x - grad(x)/L + omega * (x - x_prev)`.
3. **Nesterov AGD:** with `x0 = y0`: `y_t = x_{t-1} - grad(x_{t-1})/L`,
   `x_t = y_t + omega * (y_t - y_{t-1})`; stop when `|grad(y_t)| <= eps`. Animate `y_t`.
4. **Algorithm 1, AGD-until-guilty** (Nesterov + monitor). For `t = 1, 2, ...` after `y_t, x_t`:
   - `certifyProgress`: if `f(y_t) > f(y0)` then `w = y0`. Else `z = y_t - grad(y_t)/L`,
     `psi = f(y0) - f(z) + sigma/2 * |z - y0|^2`; if `|grad(y_t)|^2 > 2 L psi exp(-t/sqrt(kappa))`
     then `w = z`; else no alarm.
   - On alarm, `findWitnessPair`: for `j = 0..t-1`, `v = x_j`, for `u` in `(y_j, w)`:
     if `f(u) < f(v) + grad(v)·(u - v) + sigma/2 |u - v|^2`, return `(u, v)`.
   - Statuses: `converged` (`|grad(y_t)| <= eps`), `guilty` (pair found), `no_witness` (alarm but
     no pair: **L is too small**, shown as "L too small"), `max_iter`.
   - Throw on `sigma > L` (it makes `omega` negative).
5. **Algorithm 2, escape step:** `delta = (u - v)/|u - v|`; try `u ± eta*delta`; keep the lower `f`.
6. **Algorithm 3, guarded non-convex AGD:** loop `fhat(x) = f(x) + alpha |x - p|^2`; run
   Algorithm 1 on `fhat` from `p` with `eps/10`, `L + 2*alpha`, `sigma = alpha`.
   - `converged` → `p = y_t`.
   - `guilty` → `b1 = argmin f over {u, y_0..y_t}`, `b2 = escape(f, u, v, eta)`,
     `p = argmin f over {b1, b2}`; record which won (for the animation).
   - otherwise → `p = argmin f over {y_t, y_0..y_t}`.
   - Stop when `|grad f(p)| <= eps`. Return the outer points `p_k` and the inner paths.

Cap total iterations at 20,000 so nothing can hang the page.

## Presets

Each preset defines: `f`, analytic `grad`, smallest Hessian eigenvalue (for the "not a bowl here"
overlay), view (`curve` for 1-D, `map` for 2-D), domain, default start, true `L`, default `sigma`,
default methods, and two lines of visitor copy. Clicking the plot moves the start point.

### 1. Stretched bowl: why acceleration matters
- `f(x, y) = 0.5 (x^2 + k y^2)`, `grad = (x, k y)`. A bowl everywhere.
- Control: how stretched, `k` in {10, 100, 1000}. `L = k`, `sigma = 1`, start `(1, 1)`,
  domain about `[-1.2, 1.2]^2`.
- Default: race **gradient descent vs momentum vs Nesterov**, with live step counters and the
  final speed-up.
- Reference (GD / Nesterov iterations): 132 / 44, 1375 / 158, 13809 / 519 for k = 10, 100, 1000.
  Long runs need adaptive steps-per-frame.

### 2. Dr. Au-Yeung's quartic: choosing L
- 1-D: `f(x) = (x-1)^4 + (x-5)^4`, `f' = 4(x-1)^3 + 4(x-5)^3`, `f'' = 12(x-1)^2 + 12(x-5)^2`.
  Bottom at x = 3, f(3) = 32.
- Start `x = 0`, domain `[-1, 7.5]`, true `L = 312`, `sigma = 96`.
- **The L control is the star here:** log scale from 1 to 1000 with a marker at the true value 312.
  `L = 312` → converges to 3.000000 in 24 iterations. `L = 5` → the first step lands at x = 100.8
  (= 504 / 5) and Algorithm 1 returns `no_witness`. When an iterate leaves the domain, draw an
  arrow off the edge labeled "FLEW OFF → x = 100.8" and show the "L TOO SMALL" badge.

### 3. Saddle: getting caught
- `f(x, y) = x^4/4 - x^2/2 + y^2/2`, `grad = (x^3 - x, y)`, Hessian `diag(3x^2 - 1, 1)`.
  Saddle at (0, 0), valleys at (±1, 0).
- Domain about `[-1.6, 1.6] x [-0.5, 1.3]`, start `(0.001, 1)`, `L = 11`, Hessian Lipschitz `L2 = 12`.
- Default: **Algorithm 1 vs Algorithm 3**. Algorithm 1 (`sigma = 0.5`) is caught after 29 steps near
  (0.235, 0.0005). Algorithm 3 (`alpha = 0.5`, `eta = alpha/L2`) reaches (1, 0) in 20 outer
  iterations (events: guilty → best_iterate, guilty → exploit_nc, then converged).

### 4. The 6-point problem: Dr. Au-Yeung's geometry question
- `f(Q) = sum_i |Q - p_i|`, `grad = sum_i (Q - p_i)/|Q - p_i|` (skip a term when
  `|Q - p_i| < 1e-12`). A bowl, but not smooth at the points. Draw the 6 points and live lines from Q.
- Arrangement picker:
  - Ellipse: (3, 0), (1.6209, 3.3659), (-1.2484, 3.6372), (-2.97, 0.5645), (-1.9609, -3.0272),
    (0.851, -3.8357), i.e. exactly `(3 cos k, 4 sin k)` for k = 0..5
  - Symmetric triangles: (-2, 0), (-1, 1.5), (-1, -1.5), (2, 0), (1, 1.5), (1, -1.5)
  - Asymmetric triangles: (1, 3), (4, 3), (3, 6), (-4, -3), (-2, -2), (-3, -1)
  - Rectangle + 2 inside: (-2, -1), (-2, 1), (2, -1), (2, 1), (0.3, 0.4), (-0.5, -0.2)
- `L = 10`, `sigma = 0.1`, start `(0, 0)`; symmetric triangles start at `(1, 2)` because `(0, 0)` is
  already the answer.
- Reference (Algorithm 1): ellipse (-0.213140, 0.254568) in 83 steps; asymmetric
  (-0.793889, 0.360740) in 170; rectangle (-0.137268, 0.046534) in 59; symmetric (0, 0).
- Copy: "Where should one warehouse go so the total driving distance to 6 stores is smallest?"

### 5. Robust regression with an outlier: the poster's highlight
- Data: `s` in {0.1, 0.2, 0.3, 0.4, 0.5} (outer loop), `t` in {0.1, 0.2, 0.3, 0.4} (inner loop),
  20 points in that order. `y = 3s + 4t + e`, `e = +0.05` for points 1-10 and `-0.05` for 11-20,
  **except point 2**: `y = 10s + 10t + 0.05 = 3.05` (the outlier).
- Unknowns `(a, b)`, model `y ≈ a s + b t`, residual `r_j = y_j - a s_j - b t_j`.
  `f(a, b) = sum_j phi(r_j)`, `phi(r) = (0.001 + r^2)/(1 + r^2)`,
  `phi'(r) = 2 r (1 - 0.001)/(1 + r^2)^2`, `grad = (-sum phi'(r_j) s_j, -sum phi'(r_j) t_j)`.
- `L = 6.773803775789723`, `sigma = 0.01`, domain about `[-12, 22] x [-8, 22]`.
- Start choices: (0, 0), (-10, 10), (20, 20). Algorithm 1 converges to (2.8496, 4.1437) in 139 and
  180 steps from the first two, and is **guilty** from (20, 20) after 102 steps near
  (7.5696, 5.3152). Algorithm 3 from (20, 20) (`alpha = 0.05 L`, `eta = alpha/(2L)`) reaches
  (2.8496, 4.1437) in 117 outer iterations.
- Fixed markers: true rule (3, 4), least squares (2.5857, 4.6543), robust fit (2.8496, 4.1437).
- Optional panel: the 20 residuals as bars, least squares vs robust (point 2 stands out).
- Copy: "One bad data point. Least squares gets dragged by it; this loss ignores it, but the price
  is a hilly landscape."

## Stage behavior

- All selected methods start together. Each has live: steps, current |slope|, status.
- Outcomes: `CONVERGED · 158 STEPS`, `CAUGHT: NOT A BOWL` (then mark `u` and `v` and the segment
  between them, held for a moment), `ESCAPED` (arrow along `u - v` for an escape step),
  `L TOO SMALL · FLEW OFF` (arrow off the plot edge).
- After a race, show one result fact, e.g. "NESTEROV 9× FASTER".
- Play / pause / reset and a speed control. The 13,809-step run must finish in a few seconds.
- With `prefers-reduced-motion`: no trails, and each step is drawn instantly.
- Credits footer: "Enes Demirel · Faculty sponsor Dr. Enrico Au-Yeung · Department of Mathematical
  Sciences, DePaul University · based on Carmon et al. (2017)".

## Definition of done

1. `npm test` passes and reproduces every reference number above (iterations exact or ±1;
   coordinates within 1e-4). Never edit a reference number to make a test pass; a mismatch means
   the port has a bug.
2. `npm run check:design` passes.
3. `npm run build && npm run serve` works with networking turned off.
4. Every preset runs end to end and shows its badges as described.
5. Exactly one route, no console errors.
6. The `/ui-review` workflow has been run and its checklist passes at 1440×900 and 390×844.
