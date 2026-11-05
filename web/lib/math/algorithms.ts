/**
 * Exact TypeScript port of ../codes/convex_until_guilty.py.
 *
 * Implements:
 *  1. Gradient descent
 *  2. Momentum (heavy ball)
 *  3. Nesterov AGD
 *  4. Algorithm 1: agdUntilGuilty
 *  5. Algorithm 2: exploitNcPair (escape step)
 *  6. Algorithm 3: guardedNonConvexAgd
 */

import { Vec, add, clone, dot, norm, normSq, scale, sub } from "./vec";

export const DEFAULT_EPS = 1e-6;
export const MAX_TOTAL_ITER = 20000;

export interface SmoothObjective {
  f: (x: Vec) => number;
  grad: (x: Vec) => Vec;
}

export type Alg1Status = "converged" | "guilty" | "no_witness" | "max_iter";

export interface TrajectoryResult {
  status: Alg1Status;
  y: Vec;
  xs: Vec[];
  ys: Vec[];
  slopes: number[];
  u?: Vec;
  v?: Vec;
  iters: number;
  nF: number;
  nGrad: number;
}

export interface GuardedOuterStep {
  p: Vec;
  inner: TrajectoryResult;
  action: "converged" | "best_iterate" | "exploit_nc" | "fallback";
  escapeTarget?: Vec;
}

export interface GuardedResult {
  p: Vec;
  converged: boolean;
  path: Vec[];
  events: Array<[Alg1Status, "best_iterate" | "exploit_nc" | null]>;
  outerSteps: GuardedOuterStep[];
  flatYs: Vec[];
  flatSlopes: number[];
  iters: number;
  nF: number;
  nGrad: number;
}

class CounterOracle implements SmoothObjective {
  nF = 0;
  nGrad = 0;
  private _f: (x: Vec) => number;
  private _grad: (x: Vec) => Vec;

  constructor(obj: SmoothObjective) {
    this._f = obj.f;
    this._grad = obj.grad;
  }

  f(x: Vec): number {
    this.nF += 1;
    return this._f(x);
  }

  grad(x: Vec): Vec {
    this.nGrad += 1;
    return this._grad(x);
  }
}

/**
 * 1. Plain gradient descent: x <- x - grad(x) / L until |grad(x)| <= eps.
 */
export function gradientDescent(
  obj: SmoothObjective,
  x0: Vec,
  eps: number = DEFAULT_EPS,
  L: number,
  maxIter: number = MAX_TOTAL_ITER
): TrajectoryResult {
  const orc = new CounterOracle(obj);
  let x = clone(x0);
  const path: Vec[] = [x];
  const slopes: number[] = [];

  let status: Alg1Status = "max_iter";
  for (let t = 0; t < maxIter; t++) {
    const g = orc.grad(x);
    const gNorm = norm(g);
    slopes.push(gNorm);
    if (gNorm <= eps) {
      status = "converged";
      break;
    }
    x = sub(x, scale(g, 1 / L));
    path.push(x);
    if (t === maxIter - 1) {
      slopes.push(norm(orc.grad(x)));
    }
  }

  return {
    status,
    y: path[path.length - 1],
    xs: path,
    ys: path,
    slopes,
    iters: path.length - 1,
    nF: orc.nF,
    nGrad: orc.nGrad,
  };
}

/**
 * 2. Momentum (heavy ball): x_next = x - grad(x)/L + omega * (x - x_prev).
 */
export function momentum(
  obj: SmoothObjective,
  x0: Vec,
  eps: number = DEFAULT_EPS,
  L: number,
  sigma: number,
  maxIter: number = MAX_TOTAL_ITER
): TrajectoryResult {
  if (!(sigma > 0 && sigma <= L)) {
    throw new Error(`need 0 < sigma <= L, got sigma=${sigma}, L=${L}`);
  }
  const orc = new CounterOracle(obj);
  const kappa = L / sigma;
  const sqrtKappa = Math.sqrt(kappa);
  const omega = (sqrtKappa - 1) / (sqrtKappa + 1);

  let xPrev = clone(x0);
  let x = clone(x0);
  const path: Vec[] = [x];
  const slopes: number[] = [];

  let status: Alg1Status = "max_iter";
  for (let t = 0; t < maxIter; t++) {
    const g = orc.grad(x);
    const gNorm = norm(g);
    slopes.push(gNorm);
    if (gNorm <= eps) {
      status = "converged";
      break;
    }
    const xNext = add(sub(x, scale(g, 1 / L)), scale(sub(x, xPrev), omega));
    xPrev = x;
    x = xNext;
    path.push(x);
    if (t === maxIter - 1) {
      slopes.push(norm(orc.grad(x)));
    }
  }

  return {
    status,
    y: path[path.length - 1],
    xs: path,
    ys: path,
    slopes,
    iters: path.length - 1,
    nF: orc.nF,
    nGrad: orc.nGrad,
  };
}

/**
 * 3. Nesterov AGD (constant momentum without monitor).
 *    With x0 = y0:
 *      y_t = x_{t-1} - grad(x_{t-1}) / L
 *      x_t = y_t + omega * (y_t - y_{t-1})
 *    Stop when |grad(y_t)| <= eps. Animate y_t.
 */
export function nesterovAgd(
  obj: SmoothObjective,
  x0: Vec,
  eps: number = DEFAULT_EPS,
  L: number,
  sigma: number,
  maxIter: number = MAX_TOTAL_ITER
): TrajectoryResult {
  if (!(sigma > 0 && sigma <= L)) {
    throw new Error(`need 0 < sigma <= L, got sigma=${sigma}, L=${L}`);
  }
  const orc = new CounterOracle(obj);
  const kappa = L / sigma;
  const sqrtKappa = Math.sqrt(kappa);
  const omega = (sqrtKappa - 1) / (sqrtKappa + 1);

  let x = clone(x0);
  let y = clone(x0);
  const xs: Vec[] = [x];
  const ys: Vec[] = [y];
  const slopes: number[] = [];

  let status: Alg1Status = "max_iter";
  for (let t = 0; t < maxIter; t++) {
    const gY = orc.grad(y);
    const gNorm = norm(gY);
    slopes.push(gNorm);
    if (gNorm <= eps) {
      status = "converged";
      break;
    }
    const gX = orc.grad(x);
    const yNext = sub(x, scale(gX, 1 / L));
    const xNext = add(yNext, scale(sub(yNext, y), omega));
    x = xNext;
    y = yNext;
    xs.push(x);
    ys.push(y);
    if (t === maxIter - 1) {
      slopes.push(norm(orc.grad(y)));
    }
  }

  return {
    status,
    y: ys[ys.length - 1],
    xs,
    ys,
    slopes,
    iters: ys.length - 1,
    nF: orc.nF,
    nGrad: orc.nGrad,
  };
}

/**
 * 4. Algorithm 1: AGD-UNTIL-GUILTY
 */
export function agdUntilGuilty(
  obj: SmoothObjective,
  y0Input: Vec,
  eps: number = DEFAULT_EPS,
  L: number,
  sigma: number,
  maxIter: number = MAX_TOTAL_ITER
): TrajectoryResult {
  if (!(sigma > 0 && sigma <= L)) {
    throw new Error(`need 0 < sigma <= L, got sigma=${sigma}, L=${L}`);
  }

  const orc = new CounterOracle(obj);
  const kappa = L / sigma;
  const sqrtKappa = Math.sqrt(kappa);
  const omega = (sqrtKappa - 1) / (sqrtKappa + 1);

  const y0 = clone(y0Input);
  const fY0 = orc.f(y0);
  const xs: Vec[] = [y0];
  const ys: Vec[] = [y0];
  const slopes: number[] = [norm( obj.grad(y0) )];

  const makeResult = (
    status: Alg1Status,
    t: number,
    u?: Vec,
    v?: Vec
  ): TrajectoryResult => ({
    status,
    y: ys[ys.length - 1],
    xs,
    ys,
    slopes,
    u,
    v,
    iters: t,
    nF: orc.nF,
    nGrad: orc.nGrad,
  });

  for (let t = 1; t <= maxIter; t++) {
    const xPrev = xs[xs.length - 1];
    const yPrev = ys[ys.length - 1];
    const yT = sub(xPrev, scale(orc.grad(xPrev), 1 / L));
    const xT = add(yT, scale(sub(yT, yPrev), omega));
    xs.push(xT);
    ys.push(yT);

    const gradYT = orc.grad(yT);
    const gNorm = norm(gradYT);
    slopes.push(gNorm);

    const wT = certifyProgress(orc, y0, fY0, yT, gradYT, L, sigma, kappa, t);

    if (wT !== null) {
      const pair = findWitnessPair(orc, xs, ys, wT, sigma, t);
      if (pair === null) {
        return makeResult("no_witness", t);
      }
      return makeResult("guilty", t, pair[0], pair[1]);
    }

    if (gNorm <= eps) {
      return makeResult("converged", t);
    }
  }

  return makeResult("max_iter", maxIter);
}

export function certifyProgress(
  orc: SmoothObjective,
  y0: Vec,
  fY0: number,
  yT: Vec,
  gradYT: Vec,
  L: number,
  sigma: number,
  kappa: number,
  t: number
): Vec | null {
  if (orc.f(yT) > fY0) {
    return y0;
  }

  const zT = sub(yT, scale(gradYT, 1 / L));
  const psi = fY0 - orc.f(zT) + (sigma / 2) * normSq(sub(zT, y0));

  if (normSq(gradYT) > 2 * L * psi * Math.exp(-t / Math.sqrt(kappa))) {
    return zT;
  }
  return null;
}

export function findWitnessPair(
  orc: SmoothObjective,
  xs: Vec[],
  ys: Vec[],
  wT: Vec,
  sigma: number,
  t: number
): [Vec, Vec] | null {
  for (let j = 0; j < t; j++) {
    const v = xs[j];
    const fV = orc.f(v);
    const gradV = orc.grad(v);
    const candidates = [ys[j], wT];
    for (const u of candidates) {
      const diff = sub(u, v);
      const rhs = fV + dot(gradV, diff) + (sigma / 2) * normSq(diff);
      if (orc.f(u) < rhs) {
        return [u, v];
      }
    }
  }
  return null;
}

/**
 * 5. Algorithm 2: EXPLOIT-NC-PAIR (escape step)
 */
export function exploitNcPair(
  f: (x: Vec) => number,
  u: Vec,
  v: Vec,
  eta: number
): Vec {
  const diff = sub(u, v);
  const d = norm(diff);
  if (d === 0) return u;
  const delta = scale(diff, 1 / d);
  const uPlus = add(u, scale(delta, eta));
  const uMinus = sub(u, scale(delta, eta));
  return f(uPlus) < f(uMinus) ? uPlus : uMinus;
}

export function findBestIterate(
  f: (x: Vec) => number,
  ys: Vec[],
  u: Vec
): Vec {
  const candidates = [u, ...ys];
  let best = candidates[0];
  let bestVal = f(best);
  for (let i = 1; i < candidates.length; i++) {
    const val = f(candidates[i]);
    if (val < bestVal) {
      bestVal = val;
      best = candidates[i];
    }
  }
  return best;
}

/**
 * 6. Algorithm 3: GUARDED-NON-CONVEX-AGD
 */
export function guardedNonConvexAgd(
  obj: SmoothObjective,
  p0Input: Vec,
  L1: number,
  eps: number = DEFAULT_EPS,
  alpha: number,
  eta: number,
  maxOuterIter: number = 200,
  maxInnerIter: number = 10000,
  exploit: boolean = true
): GuardedResult {
  const orc = new CounterOracle(obj);
  let p = clone(p0Input);
  const path: Vec[] = [p];
  const events: Array<[Alg1Status, "best_iterate" | "exploit_nc" | null]> = [];
  const outerSteps: GuardedOuterStep[] = [];
  const flatYs: Vec[] = [p];
  const flatSlopes: number[] = [norm(obj.grad(p))];

  let hatNF = 0;
  let hatNGrad = 0;
  let totalInnerIters = 0;

  for (let outer = 0; outer < maxOuterIter; outer++) {
    const pPrev = p;
    const fHatObj: SmoothObjective = {
      f: (x: Vec) => {
        hatNF += 1;
        return obj.f(x) + alpha * normSq(sub(x, pPrev));
      },
      grad: (x: Vec) => {
        hatNGrad += 1;
        return add(obj.grad(x), scale(sub(x, pPrev), 2 * alpha));
      },
    };

    const innerBudget = Math.min(
      maxInnerIter,
      Math.max(1, MAX_TOTAL_ITER - totalInnerIters)
    );
    const res = agdUntilGuilty(
      fHatObj,
      p,
      eps / 10,
      L1 + 2 * alpha,
      alpha,
      innerBudget
    );
    totalInnerIters += res.iters;

    let action: GuardedOuterStep["action"] = "converged";
    let escapeTarget: Vec | undefined;

    if (res.status === "guilty" && res.u && res.v) {
      const b1 = findBestIterate((x) => orc.f(x), res.ys, res.u);
      p = b1;
      action = "best_iterate";
      if (exploit) {
        const b2 = exploitNcPair((x) => orc.f(x), res.u, res.v, eta);
        escapeTarget = b2;
        if (orc.f(b2) < orc.f(b1)) {
          p = b2;
          action = "exploit_nc";
        }
      }
      events.push(["guilty", action]);
    } else if (res.status === "converged") {
      p = res.y;
      action = "converged";
      events.push(["converged", null]);
    } else {
      p = findBestIterate((x) => orc.f(x), res.ys, res.y);
      action = "fallback";
      events.push([res.status, null]);
    }

    path.push(p);
    for (let k = 1; k < res.ys.length; k++) {
      flatYs.push(res.ys[k]);
      flatSlopes.push(norm(obj.grad(res.ys[k])));
    }
    flatYs.push(p);
    const gP = orc.grad(p);
    const gPNorm = norm(gP);
    flatSlopes.push(gPNorm);

    outerSteps.push({
      p,
      inner: res,
      action,
      escapeTarget,
    });

    if (gPNorm <= eps) {
      return {
        p,
        converged: true,
        path,
        events,
        outerSteps,
        flatYs,
        flatSlopes,
        iters: path.length - 1,
        nF: orc.nF + hatNF,
        nGrad: orc.nGrad + hatNGrad,
      };
    }

    if (totalInnerIters >= MAX_TOTAL_ITER) {
      break;
    }
  }

  return {
    p,
    converged: false,
    path,
    events,
    outerSteps,
    flatYs,
    flatSlopes,
    iters: path.length - 1,
    nF: orc.nF + hatNF,
    nGrad: orc.nGrad + hatNGrad,
  };
}
