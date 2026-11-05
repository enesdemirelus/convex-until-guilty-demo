import { describe, expect, it } from "vitest";
import {
  DEFAULT_EPS,
  agdUntilGuilty,
  gradientDescent,
  guardedNonConvexAgd,
  momentum,
  nesterovAgd,
} from "../algorithms";
import {
  OUTLIER_DATA,
  OUTLIER_L,
  makeBowlPreset,
  makeOutlierPreset,
  makeQuarticPreset,
  makeSaddlePreset,
  makeSixPointPreset,
} from "../presets";

describe("Preset 1: Stretched bowl", () => {
  it("reproduces GD vs Nesterov iterations for k = 10, 100, 1000", () => {
    const cases: Array<{ k: number; gdIters: number; agdIters: number }> = [
      { k: 10, gdIters: 132, agdIters: 44 },
      { k: 100, gdIters: 1375, agdIters: 158 },
      { k: 1000, gdIters: 13809, agdIters: 519 },
    ];

    for (const { k, gdIters, agdIters } of cases) {
      const p = makeBowlPreset(k);
      const gd = gradientDescent(p, p.defaultStart, DEFAULT_EPS, p.trueL);
      const agd = nesterovAgd(
        p,
        p.defaultStart,
        DEFAULT_EPS,
        p.trueL,
        p.defaultSigma
      );
      const mom = momentum(
        p,
        p.defaultStart,
        DEFAULT_EPS,
        p.trueL,
        p.defaultSigma
      );

      expect(gd.status).toBe("converged");
      expect(agd.status).toBe("converged");
      expect(mom.status).toBe("converged");
      expect(Math.abs(gd.iters - gdIters)).toBeLessThanOrEqual(1);
      expect(Math.abs(agd.iters - agdIters)).toBeLessThanOrEqual(1);
    }
  });
});

describe("Preset 2: Dr. Au-Yeung's quartic", () => {
  it("converges to 3.000000 in 24 iterations at L = 312, sigma = 96", () => {
    const p = makeQuarticPreset(312);
    const res = agdUntilGuilty(p, [0], DEFAULT_EPS, 312, 96);
    expect(res.status).toBe("converged");
    expect(Math.abs(res.iters - 24)).toBeLessThanOrEqual(1);
    expect(res.y[0]).toBeCloseTo(3.0, 4);
    expect(p.f([3])).toBeCloseTo(32, 6);
  });

  it("lands at x = 100.8 on first step and returns no_witness at L = 5", () => {
    const p = makeQuarticPreset(5);
    const res = agdUntilGuilty(p, [0], DEFAULT_EPS, 5, 5);
    expect(res.status).toBe("no_witness");
    expect(res.ys[1][0]).toBeCloseTo(100.8, 4);
  });

  it("throws when sigma > L", () => {
    const p = makeQuarticPreset(10);
    expect(() => agdUntilGuilty(p, [0], DEFAULT_EPS, 10, 15)).toThrow();
  });
});

describe("Preset 3: Saddle", () => {
  it("Algorithm 1 is caught after 29 steps near (0.235, 0.0005)", () => {
    const p = makeSaddlePreset();
    const res = agdUntilGuilty(
      p,
      p.defaultStart,
      DEFAULT_EPS,
      p.trueL,
      p.defaultSigma
    );
    expect(res.status).toBe("guilty");
    expect(Math.abs(res.iters - 29)).toBeLessThanOrEqual(1);
    expect(res.y[0]).toBeCloseTo(0.235, 2);
    expect(res.y[1]).toBeCloseTo(0.0005, 3);
    expect(res.u).toBeDefined();
    expect(res.v).toBeDefined();
  });

  it("Algorithm 3 reaches (1, 0) in 20 outer iterations with guilty -> best_iterate, guilty -> exploit_nc, then converged", () => {
    const p = makeSaddlePreset();
    const res = guardedNonConvexAgd(
      p,
      p.defaultStart,
      p.trueL,
      DEFAULT_EPS,
      p.alpha!,
      p.eta!
    );
    expect(res.converged).toBe(true);
    expect(Math.abs(res.iters - 20)).toBeLessThanOrEqual(1);
    expect(res.p[0]).toBeCloseTo(1.0, 4);
    expect(res.p[1]).toBeCloseTo(0.0, 4);

    const guiltyEvents = res.events.filter((e) => e[0] === "guilty");
    expect(guiltyEvents.length).toBe(2);
    expect(guiltyEvents[0][1]).toBe("best_iterate");
    expect(guiltyEvents[1][1]).toBe("exploit_nc");
  });
});

describe("Preset 4: The 6-point problem", () => {
  it("reproduces all 4 arrangements (ellipse, asymmetric, rectangle, symmetric)", () => {
    // 1. Ellipse
    const pEllipse = makeSixPointPreset("ellipse");
    const rEllipse = agdUntilGuilty(pEllipse, [0, 0], DEFAULT_EPS, 10, 0.1);
    expect(rEllipse.status).toBe("converged");
    expect(Math.abs(rEllipse.iters - 83)).toBeLessThanOrEqual(1);
    expect(rEllipse.y[0]).toBeCloseTo(-0.21314, 4);
    expect(rEllipse.y[1]).toBeCloseTo(0.254568, 4);

    // 2. Asymmetric triangles
    const pAsym = makeSixPointPreset("asymmetric");
    const rAsym = agdUntilGuilty(pAsym, [0, 0], DEFAULT_EPS, 10, 0.1);
    expect(rAsym.status).toBe("converged");
    expect(Math.abs(rAsym.iters - 170)).toBeLessThanOrEqual(1);
    expect(rAsym.y[0]).toBeCloseTo(-0.793889, 4);
    expect(rAsym.y[1]).toBeCloseTo(0.36074, 4);

    // 3. Rectangle + 2 inside
    const pRect = makeSixPointPreset("rectangle");
    const rRect = agdUntilGuilty(pRect, [0, 0], DEFAULT_EPS, 10, 0.1);
    expect(rRect.status).toBe("converged");
    expect(Math.abs(rRect.iters - 59)).toBeLessThanOrEqual(1);
    expect(rRect.y[0]).toBeCloseTo(-0.137268, 4);
    expect(rRect.y[1]).toBeCloseTo(0.046534, 4);

    // 4. Symmetric triangles started at (1, 2) -> (0, 0)
    const pSym = makeSixPointPreset("symmetric");
    const rSym = agdUntilGuilty(
      pSym,
      pSym.defaultStart,
      DEFAULT_EPS,
      10,
      0.1
    );
    expect(rSym.status).toBe("converged");
    expect(rSym.y[0]).toBeCloseTo(0.0, 4);
    expect(rSym.y[1]).toBeCloseTo(0.0, 4);
  });
});

describe("Preset 5: Robust regression with an outlier", () => {
  it("constructs the 20 data points with outlier at point 2 (y = 3.05)", () => {
    expect(OUTLIER_DATA.length).toBe(20);
    expect(OUTLIER_DATA[1].s).toBeCloseTo(0.1, 6);
    expect(OUTLIER_DATA[1].t).toBeCloseTo(0.2, 6);
    expect(OUTLIER_DATA[1].y).toBeCloseTo(3.05, 6);
  });

  it("Algorithm 1 converges from (0, 0) in 139 steps and (-10, 10) in 180 steps to (2.8496, 4.1437)", () => {
    const p = makeOutlierPreset([0, 0]);
    const r0 = agdUntilGuilty(p, [0, 0], DEFAULT_EPS, OUTLIER_L, 0.01);
    expect(r0.status).toBe("converged");
    expect(Math.abs(r0.iters - 139)).toBeLessThanOrEqual(1);
    expect(r0.y[0]).toBeCloseTo(2.8496, 3);
    expect(r0.y[1]).toBeCloseTo(4.1437, 3);

    const r1 = agdUntilGuilty(p, [-10, 10], DEFAULT_EPS, OUTLIER_L, 0.01);
    expect(r1.status).toBe("converged");
    expect(Math.abs(r1.iters - 180)).toBeLessThanOrEqual(1);
    expect(r1.y[0]).toBeCloseTo(2.8496, 3);
    expect(r1.y[1]).toBeCloseTo(4.1437, 3);
  });

  it("Algorithm 1 is guilty from (20, 20) after 102 steps near (7.5696, 5.3152)", () => {
    const p = makeOutlierPreset([20, 20]);
    const r = agdUntilGuilty(p, [20, 20], DEFAULT_EPS, OUTLIER_L, 0.01);
    expect(r.status).toBe("guilty");
    expect(Math.abs(r.iters - 102)).toBeLessThanOrEqual(1);
    expect(r.y[0]).toBeCloseTo(7.5696, 3);
    expect(r.y[1]).toBeCloseTo(5.3152, 3);
  });

  it("Algorithm 3 from (20, 20) reaches (2.8496, 4.1437) in 117 outer iterations", () => {
    const p = makeOutlierPreset([20, 20]);
    const res = guardedNonConvexAgd(
      p,
      [20, 20],
      OUTLIER_L,
      DEFAULT_EPS,
      p.alpha!,
      p.eta!
    );
    expect(res.converged).toBe(true);
    expect(Math.abs(res.iters - 117)).toBeLessThanOrEqual(1);
    expect(res.p[0]).toBeCloseTo(2.8496, 3);
    expect(res.p[1]).toBeCloseTo(4.1437, 3);
  });
});
