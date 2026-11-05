---
trigger: glob
globs: web/lib/math/**
---

# Math rule: port exactly

- The source of truth is `../codes/convex_until_guilty.py` (relative to `demo/`). Port its logic
  line for line: same update order, same statuses (`converged`, `guilty`, `no_witness`,
  `max_iter`), same witness search over `j = 0..t-1` with `u in (y_j, w)` and `v = x_j`.
- Use analytic gradients from `SPEC.md` → Presets. Do not use finite differences for gradients.
- `lib/math` has no React, DOM, or canvas code. Every algorithm returns its full trajectory.
- Tests in `lib/math/__tests__/` reproduce every reference number in `SPEC.md` (iterations exact
  or ±1, coordinates within 1e-4). If a test fails, the port is wrong: fix the port, never the
  expected number.
- Throw on `sigma > L`.
