/**
 * All 5 presets from SPEC.md:
 * 1. Stretched bowl: why acceleration matters
 * 2. Dr. Au-Yeung's quartic: choosing L
 * 3. Saddle: getting caught
 * 4. The 6-point problem: Dr. Au-Yeung's geometry question
 * 5. Robust regression with an outlier: the poster's highlight
 */

import { Vec } from "./vec";

export type PresetId = "bowl" | "quartic" | "saddle" | "sixpoints" | "outlier";
export type MethodId = "gd" | "momentum" | "nesterov" | "alg1" | "alg3";
export type SixPointArrangementId =
  | "ellipse"
  | "symmetric"
  | "asymmetric"
  | "rectangle";

export interface Domain2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface FixedMarker {
  label: string;
  point: [number, number];
  kind: "star" | "square" | "diamond";
}

export interface PresetConfig {
  id: PresetId;
  shortName: string;
  title: string;
  subtitle: string;
  copyLine1: string;
  copyLine2: string;
  view: "curve" | "map";
  domain: Domain2D;
  defaultStart: Vec;
  trueL: number;
  defaultL: number;
  defaultSigma: number;
  defaultMethods: MethodId[];
  availableMethods: MethodId[];
  f: (x: Vec) => number;
  grad: (x: Vec) => Vec;
  minHessianEig: (x: Vec) => number;
  axisLabels: [string, string];
  fixedMarkers?: FixedMarker[];
  alpha?: number;
  eta?: number;
}

/**
 *Smallest eigenvalue of a symmetric 2x2 matrix [[a, b], [b, c]]
 */
export function minEig2x2(a: number, b: number, c: number): number {
  const tr = a + c;
  const diff = a - c;
  const disc = Math.sqrt(diff * diff + 4 * b * b);
  return 0.5 * (tr - disc);
}

// ---------------------------------------------------------------------------
// 1. Stretched bowl
// ---------------------------------------------------------------------------

export function makeBowlPreset(k: number = 100): PresetConfig {
  return {
    id: "bowl",
    shortName: "BOWL",
    title: "Stretched bowl: why acceleration matters",
    subtitle: "Steep canyon walls, gentle valley floor",
    copyLine1:
      "Plain gradient descent zig-zags across the steep canyon walls.",
    copyLine2:
      "Nesterov momentum builds speed along the valley floor and finishes up to 27× faster.",
    view: "map",
    domain: { xMin: -1.2, xMax: 1.2, yMin: -1.2, yMax: 1.2 },
    defaultStart: [1, 1],
    trueL: k,
    defaultL: k,
    defaultSigma: 1,
    defaultMethods: ["gd", "momentum", "nesterov"],
    availableMethods: ["gd", "momentum", "nesterov"],
    f: (z: Vec) => 0.5 * (z[0] * z[0] + k * z[1] * z[1]),
    grad: (z: Vec) => [z[0], k * z[1]],
    minHessianEig: () => Math.min(1, k),
    axisLabels: ["X", "Y"],
    fixedMarkers: [{ label: "MIN (0, 0)", point: [0, 0], kind: "diamond" }],
  };
}

// ---------------------------------------------------------------------------
// 2. Dr. Au-Yeung's quartic: choosing L
// ---------------------------------------------------------------------------

export function makeQuarticPreset(L: number = 312): PresetConfig {
  return {
    id: "quartic",
    shortName: "QUARTIC",
    title: "Dr. Au-Yeung's quartic: choosing L",
    subtitle: "f(x) = (x − 1)⁴ + (x − 5)⁴ · Bottom at x = 3",
    copyLine1:
      "L is the sharpest bend the algorithm expects (step size = 1/L). True L at the start is 312.",
    copyLine2:
      "Set L = 5 and the first step leaps to x = 100.8 — Algorithm 1 catches the broken step size.",
    view: "curve",
    domain: { xMin: -1, xMax: 7.5, yMin: 0, yMax: 750 },
    defaultStart: [0],
    trueL: 312,
    defaultL: L,
    defaultSigma: Math.min(96, L),
    defaultMethods: ["alg1"],
    availableMethods: ["alg1", "gd"],
    f: (z: Vec) => {
      const x = z[0];
      const a = x - 1;
      const b = x - 5;
      return a * a * a * a + b * b * b * b;
    },
    grad: (z: Vec) => {
      const x = z[0];
      const a = x - 1;
      const b = x - 5;
      return [4 * a * a * a + 4 * b * b * b];
    },
    minHessianEig: (z: Vec) => {
      const x = z[0];
      const a = x - 1;
      const b = x - 5;
      return 12 * a * a + 12 * b * b;
    },
    axisLabels: ["X", "F(X)"],
  };
}

// ---------------------------------------------------------------------------
// 3. Saddle: getting caught
// ---------------------------------------------------------------------------

export function makeSaddlePreset(): PresetConfig {
  const L = 11;
  const L2 = 12;
  const alpha = 0.5;
  const eta = alpha / L2;
  return {
    id: "saddle",
    shortName: "SADDLE",
    title: "Saddle: getting caught",
    subtitle: "f(x, y) = x⁴/4 − x²/2 + y²/2 · Saddle at (0, 0)",
    copyLine1:
      "Near the saddle at (0, 0), the surface bends downward in x — it is not a bowl.",
    copyLine2:
      "Algorithm 1 catches the hill with witness pair (U, V); Algorithm 3 uses it to escape to (1, 0).",
    view: "map",
    domain: { xMin: -1.6, xMax: 1.6, yMin: -0.5, yMax: 1.3 },
    defaultStart: [0.001, 1],
    trueL: L,
    defaultL: L,
    defaultSigma: 0.5,
    defaultMethods: ["alg1", "alg3"],
    availableMethods: ["alg1", "alg3", "gd"],
    f: (z: Vec) => {
      const x = z[0];
      const y = z[1];
      return (x * x * x * x) / 4 - (x * x) / 2 + (y * y) / 2;
    },
    grad: (z: Vec) => {
      const x = z[0];
      const y = z[1];
      return [x * x * x - x, y];
    },
    minHessianEig: (z: Vec) => {
      const x = z[0];
      return Math.min(3 * x * x - 1, 1);
    },
    axisLabels: ["X", "Y"],
    fixedMarkers: [
      { label: "SADDLE (0, 0)", point: [0, 0], kind: "square" },
      { label: "MIN (1, 0)", point: [1, 0], kind: "diamond" },
    ],
    alpha,
    eta,
  };
}

// ---------------------------------------------------------------------------
// 4. The 6-point problem: Dr. Au-Yeung's geometry question
// ---------------------------------------------------------------------------

export const SIX_POINT_ARRANGEMENTS: Record<
  SixPointArrangementId,
  {
    label: string;
    points: ReadonlyArray<readonly [number, number]>;
    defaultStart: [number, number];
    domain: Domain2D;
  }
> = {
  ellipse: {
    label: "ELLIPSE",
    points: [0, 1, 2, 3, 4, 5].map(
      (k) => [3 * Math.cos(k), 4 * Math.sin(k)] as const
    ),
    defaultStart: [0, 0],
    domain: { xMin: -4.2, xMax: 4.2, yMin: -4.6, yMax: 4.6 },
  },
  symmetric: {
    label: "SYMMETRIC",
    points: [
      [-2, 0],
      [-1, 1.5],
      [-1, -1.5],
      [2, 0],
      [1, 1.5],
      [1, -1.5],
    ],
    defaultStart: [1, 2],
    domain: { xMin: -3.2, xMax: 3.2, yMin: -2.6, yMax: 2.8 },
  },
  asymmetric: {
    label: "ASYMMETRIC",
    points: [
      [1, 3],
      [4, 3],
      [3, 6],
      [-4, -3],
      [-2, -2],
      [-3, -1],
    ],
    defaultStart: [0, 0],
    domain: { xMin: -5.2, xMax: 5.2, yMin: -4.2, yMax: 7.0 },
  },
  rectangle: {
    label: "RECTANGLE",
    points: [
      [-2, -1],
      [-2, 1],
      [2, -1],
      [2, 1],
      [0.3, 0.4],
      [-0.5, -0.2],
    ],
    defaultStart: [0, 0],
    domain: { xMin: -3.0, xMax: 3.0, yMin: -2.2, yMax: 2.2 },
  },
};

export function makeSixPointPreset(
  arrangement: SixPointArrangementId = "ellipse"
): PresetConfig {
  const cfg = SIX_POINT_ARRANGEMENTS[arrangement];
  const pts = cfg.points;

  return {
    id: "sixpoints",
    shortName: "6 POINTS",
    title: "The 6-point problem: Dr. Au-Yeung's geometry question",
    subtitle: "Minimize total Euclidean distance f(Q) = Σ |Q − pᵢ|",
    copyLine1:
      "Where should one warehouse go so the total driving distance to 6 stores is smallest?",
    copyLine2:
      "A sum of distances is always a convex bowl — Algorithm 1 finds the exact geometric median.",
    view: "map",
    domain: cfg.domain,
    defaultStart: [...cfg.defaultStart],
    trueL: 10,
    defaultL: 10,
    defaultSigma: 0.1,
    defaultMethods: ["alg1", "gd"],
    availableMethods: ["alg1", "gd"],
    f: (q: Vec) => {
      let sum = 0;
      for (let i = 0; i < pts.length; i++) {
        const dx = q[0] - pts[i][0];
        const dy = q[1] - pts[i][1];
        sum += Math.sqrt(dx * dx + dy * dy);
      }
      return sum;
    },
    grad: (q: Vec) => {
      let gx = 0;
      let gy = 0;
      for (let i = 0; i < pts.length; i++) {
        const dx = q[0] - pts[i][0];
        const dy = q[1] - pts[i][1];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1e-12) {
          gx += dx / d;
          gy += dy / d;
        }
      }
      return [gx, gy];
    },
    minHessianEig: () => 0.1, // Convex everywhere
    axisLabels: ["X", "Y"],
  };
}

// ---------------------------------------------------------------------------
// 5. Robust regression with an outlier: the poster's highlight
// ---------------------------------------------------------------------------

export interface OutlierPoint {
  index: number; // 1..20
  s: number;
  t: number;
  y: number;
  isOutlier: boolean;
}

const C_ROBUST = 0.001;

export const OUTLIER_DATA: ReadonlyArray<OutlierPoint> = (() => {
  const sVals = [0.1, 0.2, 0.3, 0.4, 0.5];
  const tVals = [0.1, 0.2, 0.3, 0.4];
  const out: OutlierPoint[] = [];
  let idx = 0;
  for (const s of sVals) {
    for (const t of tVals) {
      const e = idx < 10 ? 0.05 : -0.05;
      const isOutlier = idx === 1;
      const y = isOutlier ? 10 * s + 10 * t + 0.05 : 3 * s + 4 * t + e;
      out.push({ index: idx + 1, s, t, y, isOutlier });
      idx++;
    }
  }
  return out;
})();

export const OUTLIER_STARTS: ReadonlyArray<{
  label: string;
  point: [number, number];
}> = [
  { label: "(0, 0)", point: [0, 0] },
  { label: "(−10, 10)", point: [-10, 10] },
  { label: "(20, 20)", point: [20, 20] },
];

export const OUTLIER_L = 6.773803775789723;

export const OUTLIER_MARKERS: FixedMarker[] = [
  { label: "TRUE (3, 4)", point: [3, 4], kind: "star" },
  { label: "LS (2.59, 4.65)", point: [2.5857, 4.6543], kind: "square" },
  { label: "ROBUST (2.85, 4.14)", point: [2.8496, 4.1437], kind: "diamond" },
];

export function computeOutlierResiduals(a: number, b: number): number[] {
  return OUTLIER_DATA.map((pt) => pt.y - (a * pt.s + b * pt.t));
}

export function makeOutlierPreset(
  start: [number, number] = [20, 20]
): PresetConfig {
  const L = OUTLIER_L;
  const alpha = 0.05 * L;
  const eta = alpha / (2 * L);

  return {
    id: "outlier",
    shortName: "OUTLIER",
    title: "Robust regression with an outlier",
    subtitle: "20 points, y ≈ a·s + b·t · Point #2 is corrupted (y = 3.05)",
    copyLine1:
      "One bad data point. Least squares gets dragged by it; this loss ignores it, but the price is a hilly landscape.",
    copyLine2:
      "From (20, 20), Algorithm 1 gets caught in the non-convex hill; Algorithm 3 escapes to the true fit.",
    view: "map",
    domain: { xMin: -12, xMax: 22, yMin: -8, yMax: 22 },
    defaultStart: [...start],
    trueL: L,
    defaultL: L,
    defaultSigma: 0.01,
    defaultMethods: ["alg1", "alg3"],
    availableMethods: ["alg1", "alg3", "gd"],
    f: (z: Vec) => {
      const a = z[0];
      const b = z[1];
      let sum = 0;
      for (let i = 0; i < OUTLIER_DATA.length; i++) {
        const pt = OUTLIER_DATA[i];
        const r = pt.y - a * pt.s - b * pt.t;
        const r2 = r * r;
        sum += (C_ROBUST + r2) / (1 + r2);
      }
      return sum;
    },
    grad: (z: Vec) => {
      const a = z[0];
      const b = z[1];
      let ga = 0;
      let gb = 0;
      const cFactor = 2 * (1 - C_ROBUST);
      for (let i = 0; i < OUTLIER_DATA.length; i++) {
        const pt = OUTLIER_DATA[i];
        const r = pt.y - a * pt.s - b * pt.t;
        const denom = 1 + r * r;
        const phiPrime = (cFactor * r) / (denom * denom);
        ga -= phiPrime * pt.s;
        gb -= phiPrime * pt.t;
      }
      return [ga, gb];
    },
    minHessianEig: (z: Vec) => {
      const a = z[0];
      const b = z[1];
      let hAA = 0;
      let hAB = 0;
      let hBB = 0;
      const cFactor = 2 * (1 - C_ROBUST);
      for (let i = 0; i < OUTLIER_DATA.length; i++) {
        const pt = OUTLIER_DATA[i];
        const r = pt.y - a * pt.s - b * pt.t;
        const r2 = r * r;
        const denom = 1 + r2;
        const phiSecond = (cFactor * (1 - 3 * r2)) / (denom * denom * denom);
        hAA += phiSecond * pt.s * pt.s;
        hAB += phiSecond * pt.s * pt.t;
        hBB += phiSecond * pt.t * pt.t;
      }
      return minEig2x2(hAA, hAB, hBB);
    },
    axisLabels: ["A (SLOPE S)", "B (SLOPE T)"],
    fixedMarkers: OUTLIER_MARKERS,
    alpha,
    eta,
  };
}
