"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Hero } from "@/components/Hero";
import { PresetPicker } from "@/components/PresetPicker";
import { MethodOverlayRenderData, Stage } from "@/components/Stage";
import { SpeedOption } from "@/components/Controls";
import { LedgerRowData, METHOD_META } from "@/components/Ledger";
import { BadgeStatus } from "@/components/Badge";
import {
  Domain2D,
  MethodId,
  OUTLIER_STARTS,
  PresetConfig,
  PresetId,
  SixPointArrangementId,
  makeBowlPreset,
  makeOutlierPreset,
  makeQuarticPreset,
  makeSaddlePreset,
  makeSixPointPreset,
} from "@/lib/math/presets";
import {
  DEFAULT_EPS,
  GuardedResult,
  TrajectoryResult,
  agdUntilGuilty,
  gradientDescent,
  guardedNonConvexAgd,
  momentum,
  nesterovAgd,
} from "@/lib/math/algorithms";
import { Vec, add, dist, norm, scale, sub } from "@/lib/math/vec";

interface ComputedMethodRun {
  id: MethodId;
  kind: "trajectory" | "guarded";
  traj?: TrajectoryResult;
  guarded?: GuardedResult;
  points: Vec[];
  stepSubPaths?: Vec[][];
  slopes: number[];
  finalSteps: number;
  finalStatus: BadgeStatus;
  witnessU?: Vec;
  witnessV?: Vec;
  escapeFrom?: Vec;
  escapeTo?: Vec;
  escapeStepIdx?: number;
  flewOffX?: number;
}

function isOutOfDomain(preset: PresetConfig, pt: Vec): boolean {
  const { xMin, xMax, yMin, yMax } = preset.domain;
  const spanX = xMax - xMin;
  if (pt[0] < xMin - spanX * 0.25 || pt[0] > xMax + spanX * 0.25) {
    return true;
  }
  if (preset.view === "map" && pt.length > 1) {
    const spanY = yMax - yMin;
    if (pt[1] < yMin - spanY * 0.25 || pt[1] > yMax + spanY * 0.25) {
      return true;
    }
  }
  return false;
}

function simplifyPolyline(pts: Vec[], minStepDist: number = 1e-3): Vec[] {
  if (pts.length <= 2) return pts;
  const out: Vec[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    if (dist(pts[i], out[out.length - 1]) >= minStepDist) {
      out.push(pts[i]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function computeMethodRun(
  preset: PresetConfig,
  methodId: MethodId,
  startPoint: Vec
): ComputedMethodRun {
  const L = preset.defaultL;
  const sigma = Math.min(preset.defaultSigma, L);

  if (methodId === "gd") {
    const res = gradientDescent(preset, startPoint, DEFAULT_EPS, L);
    let flewOffX: number | undefined;
    for (let i = 1; i < res.ys.length; i++) {
      if (isOutOfDomain(preset, res.ys[i])) {
        flewOffX = res.ys[i][0];
        break;
      }
    }
    return {
      id: methodId,
      kind: "trajectory",
      traj: res,
      points: res.ys,
      slopes: res.slopes,
      finalSteps: res.iters,
      finalStatus: flewOffX !== undefined ? "flewoff" : "converged",
      flewOffX,
    };
  }

  if (methodId === "momentum") {
    const res = momentum(preset, startPoint, DEFAULT_EPS, L, sigma);
    return {
      id: methodId,
      kind: "trajectory",
      traj: res,
      points: res.ys,
      slopes: res.slopes,
      finalSteps: res.iters,
      finalStatus: "converged",
    };
  }

  if (methodId === "nesterov") {
    const res = nesterovAgd(preset, startPoint, DEFAULT_EPS, L, sigma);
    return {
      id: methodId,
      kind: "trajectory",
      traj: res,
      points: res.ys,
      slopes: res.slopes,
      finalSteps: res.iters,
      finalStatus: "converged",
    };
  }

  if (methodId === "alg1") {
    const res = agdUntilGuilty(preset, startPoint, DEFAULT_EPS, L, sigma);
    let flewOffX: number | undefined;
    for (let i = 1; i < res.ys.length; i++) {
      if (isOutOfDomain(preset, res.ys[i])) {
        flewOffX = res.ys[i][0];
        break;
      }
    }
    const finalStatus: BadgeStatus =
      res.status === "no_witness" || flewOffX !== undefined
        ? "flewoff"
        : res.status === "guilty"
        ? "caught"
        : "converged";

    return {
      id: methodId,
      kind: "trajectory",
      traj: res,
      points: res.ys,
      slopes: res.slopes,
      finalSteps: res.iters,
      finalStatus,
      witnessU: res.u,
      witnessV: res.v,
      flewOffX:
        flewOffX ??
        (res.status === "no_witness" && res.ys.length > 1
          ? res.ys[1][0]
          : undefined),
    };
  }

  // Algorithm 3
  const alpha = preset.alpha ?? 0.5;
  const eta = preset.eta ?? alpha / (2 * L);
  const res = guardedNonConvexAgd(
    preset,
    startPoint,
    L,
    DEFAULT_EPS,
    alpha,
    eta
  );

  let escapeFrom: Vec | undefined;
  let escapeTo: Vec | undefined;
  let escapeStepIdx: number | undefined;

  const stepSubPaths: Vec[][] = [];
  for (let i = 0; i < res.outerSteps.length; i++) {
    const step = res.outerSteps[i];
    const pStart = res.path[i];
    const pEnd = res.path[i + 1];
    if (step.action === "converged" && step.inner.ys.length > 2) {
      stepSubPaths.push(simplifyPolyline([pStart, ...step.inner.ys, pEnd], 2e-3));
    } else {
      stepSubPaths.push([pStart, pEnd]);
    }

    if (
      step.inner.status === "guilty" &&
      step.inner.u &&
      step.inner.v &&
      step.escapeTarget
    ) {
      if (step.action === "exploit_nc" || !escapeFrom) {
        escapeFrom = step.inner.u;
        escapeTo = step.escapeTarget;
        escapeStepIdx = i + 1;
      }
    }
  }

  const slopes = res.path.map((p) => norm(preset.grad(p)));
  const usedGuilty = res.events.some((e) => e[0] === "guilty");

  return {
    id: methodId,
    kind: "guarded",
    guarded: res,
    points: res.path,
    stepSubPaths,
    slopes,
    finalSteps: res.iters,
    finalStatus: usedGuilty ? "escaped" : "converged",
    escapeFrom,
    escapeTo,
    escapeStepIdx,
  };
}

function interpolateVec(a: Vec, b: Vec, t: number): Vec {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return add(a, scale(sub(b, a), t));
}

function samplePolyline(
  poly: Vec[],
  t: number
): { pos: Vec; prefix: Vec[] } {
  if (poly.length === 0) return { pos: [0, 0], prefix: [] };
  if (poly.length === 1 || t <= 0) return { pos: poly[0], prefix: [poly[0]] };
  if (t >= 1) return { pos: poly[poly.length - 1], prefix: poly };

  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const d = dist(poly[i], poly[i + 1]);
    segLengths.push(d);
    totalLen += d;
  }
  if (totalLen < 1e-12) {
    return { pos: poly[poly.length - 1], prefix: [poly[0], poly[poly.length - 1]] };
  }

  const target = t * totalLen;
  let acc = 0;
  const prefix: Vec[] = [poly[0]];
  for (let i = 0; i < segLengths.length; i++) {
    const seg = segLengths[i];
    if (acc + seg >= target) {
      const localT = seg > 1e-12 ? (target - acc) / seg : 1;
      const pos = interpolateVec(poly[i], poly[i + 1], localT);
      prefix.push(pos);
      return { pos, prefix };
    }
    acc += seg;
    prefix.push(poly[i + 1]);
  }
  return { pos: poly[poly.length - 1], prefix: poly };
}

/**
 * Computes a zoomed-in domain that frames the active trajectories and reference markers
 * closely so the race fills the plot instead of looking tiny or far away.
 */
function computeActionDomain(
  preset: PresetConfig,
  startPoint: Vec,
  runs: ComputedMethodRun[]
): Domain2D {
  if (preset.view === "curve") {
    const sx = startPoint[0];
    const xMin = Math.min(-0.4, sx - 0.6);
    const xMax = Math.max(4.5, sx + 0.8);
    const fStart = preset.f([sx]);
    const yMax = Math.min(2000, Math.max(420, fStart * 1.12));
    return { xMin, xMax, yMin: 0, yMax };
  }

  let xMin = startPoint[0];
  let xMax = startPoint[0];
  let yMin = startPoint[1];
  let yMax = startPoint[1];

  const includePt = (pt: Vec | undefined) => {
    if (!pt || pt.length < 2) return;
    if (isOutOfDomain(preset, pt)) return;
    if (pt[0] < xMin) xMin = pt[0];
    if (pt[0] > xMax) xMax = pt[0];
    if (pt[1] < yMin) yMin = pt[1];
    if (pt[1] > yMax) yMax = pt[1];
  };

  for (const m of preset.fixedMarkers ?? []) {
    includePt(m.point);
  }

  for (const run of runs) {
    if (run.finalStatus === "flewoff") continue;
    for (const pt of run.points) {
      includePt(pt);
    }
    includePt(run.witnessU);
    includePt(run.witnessV);
    includePt(run.escapeTo);
  }

  const rawW = xMax - xMin;
  const rawH = yMax - yMin;

  let minSpanX = 0.85;
  let minSpanY = 0.85;
  let padFrac = 0.24;

  if (preset.id === "sixpoints") {
    minSpanX = 0.75;
    minSpanY = 0.75;
    padFrac = 0.38;
  } else if (preset.id === "outlier") {
    minSpanX = 6.0;
    minSpanY = 5.5;
    padFrac = 0.20;
  } else if (preset.id === "bowl") {
    minSpanX = 1.0;
    minSpanY = 1.2;
    padFrac = 0.20;
  } else if (preset.id === "saddle") {
    minSpanX = 1.1;
    minSpanY = 1.1;
    padFrac = 0.24;
  }

  const cx = 0.5 * (xMin + xMax);
  const cy = 0.5 * (yMin + yMax);
  const spanX = Math.max(minSpanX, rawW * (1 + 2 * padFrac));
  const spanY = Math.max(minSpanY, rawH * (1 + 2 * padFrac));

  return {
    xMin: Math.max(preset.domain.xMin, cx - spanX / 2),
    xMax: Math.min(preset.domain.xMax, cx + spanX / 2),
    yMin: Math.max(preset.domain.yMin, cy - spanY / 2),
    yMax: Math.min(preset.domain.yMax, cy + spanY / 2),
  };
}

/**
 * Builds a cumulative timestamp array `cumTimes[0 .. N]` over `durationSec`
 * using compressed screen displacement + active step weighting + tail step weighting.
 */
function buildCumTimes(
  stepDists: number[],
  remDists: number[],
  durationSec: number,
  exponent: number = 0.58
): number[] {
  const N = stepDists.length;
  if (N === 0) return [0];

  const totalRawD = Math.max(1e-9, stepDists.reduce((a, b) => a + b, 0));
  const compDists = stepDists.map((d) => Math.pow(Math.max(0, d), exponent));
  const totalCompD = Math.max(1e-9, compDists.reduce((a, b) => a + b, 0));

  const activeFlags: number[] = remDists.map((r) =>
    r > totalRawD * 0.015 ? 1 : 0
  );
  const nActive = Math.max(1, activeFlags.reduce((a, b) => a + b, 0));
  const nTail = Math.max(1, N - nActive);

  const weights = compDists.map((cd, k) => {
    const wDist = 0.72 * (cd / totalCompD);
    const wStep = activeFlags[k] ? 0.20 / nActive : 0.08 / nTail;
    return wDist + wStep;
  });

  const wSum = Math.max(1e-9, weights.reduce((a, b) => a + b, 0));
  const cum: number[] = [0];
  let acc = 0;
  for (let k = 0; k < N; k++) {
    acc += (weights[k] / wSum) * durationSec;
    cum.push(acc);
  }
  return cum;
}

function lookupStepCursor(cumTimes: number[], t: number): number {
  const lastIdx = cumTimes.length - 1;
  if (lastIdx <= 0 || t <= 0) return 0;
  if (t >= cumTimes[lastIdx]) return lastIdx;

  // Binary search for largest k with cumTimes[k] <= t
  let lo = 0;
  let hi = lastIdx;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumTimes[mid] <= t) lo = mid;
    else hi = mid;
  }
  const t0 = cumTimes[lo];
  const t1 = cumTimes[lo + 1];
  const frac = t1 > t0 + 1e-9 ? (t - t0) / (t1 - t0) : 1;
  return lo + Math.max(0, Math.min(1, frac));
}

interface RaceSchedule {
  totalDuration: number;
  getMethodCursor: (methodId: MethodId, elapsedSec: number) => number;
}

function buildRaceSchedule(
  preset: PresetConfig,
  domain: Domain2D,
  runs: ComputedMethodRun[]
): RaceSchedule {
  const spanX = Math.max(1e-6, domain.xMax - domain.xMin);
  const spanY = Math.max(1e-6, domain.yMax - domain.yMin);

  const normDist = (a: Vec, b: Vec): number => {
    const dx = (b[0] - a[0]) / spanX;
    const dy =
      preset.view === "curve"
        ? (preset.f(b) - preset.f(a)) / spanY
        : ((b[1] ?? 0) - (a[1] ?? 0)) / spanY;
    return Math.hypot(dx, dy);
  };

  // Special case: flew off on step 1 (Quartic L = 5)
  if (runs.every((r) => r.finalStatus === "flewoff")) {
    const totalDuration = 1.4;
    return {
      totalDuration,
      getMethodCursor: (_id, t) => Math.min(1, t / totalDuration),
    };
  }

  // Case A: Saddle (Algorithm 1 catches saddle in 29 inner steps while Algorithm 3 escapes in outer step 2 and reaches (1, 0) in 20 outer steps)
  if (preset.id === "saddle") {
    const alg1 = runs.find((r) => r.id === "alg1");
    const alg3 = runs.find((r) => r.id === "alg3");
    if (alg1 && alg3) {
      const phase1Dur = 3.2;
      const phase2Dur = 3.4;
      const totalDuration = phase1Dur + phase2Dur;

      // Alg 1 schedule over phase1Dur (steps 0..29)
      const d1: number[] = [];
      const rem1: number[] = [];
      const end1 = alg1.points[alg1.points.length - 1];
      for (let k = 0; k < alg1.finalSteps; k++) {
        d1.push(normDist(alg1.points[k], alg1.points[k + 1]));
        rem1.push(normDist(alg1.points[k], end1));
      }
      const cumAlg1 = buildCumTimes(d1, rem1, phase1Dur, 0.6);

      // Alg 3 schedule: outer steps 0..escapeStep (2) over phase1Dur, then escapeStep..20 over phase2Dur
      const escStep = Math.min(alg3.finalSteps, alg3.escapeStepIdx ?? 2);
      const d3a: number[] = [];
      const rem3a: number[] = [];
      for (let k = 0; k < escStep; k++) {
        d3a.push(normDist(alg3.points[k], alg3.points[k + 1]));
        rem3a.push(normDist(alg3.points[k], alg3.points[escStep]));
      }
      const cum3a = buildCumTimes(d3a, rem3a, phase1Dur, 0.6);

      const d3b: number[] = [];
      const rem3b: number[] = [];
      const end3 = alg3.points[alg3.points.length - 1];
      for (let k = escStep; k < alg3.finalSteps; k++) {
        d3b.push(normDist(alg3.points[k], alg3.points[k + 1]));
        rem3b.push(normDist(alg3.points[k], end3));
      }
      const cum3b = buildCumTimes(d3b, rem3b, phase2Dur, 0.58);

      return {
        totalDuration,
        getMethodCursor: (methodId, t) => {
          if (methodId === "alg1") {
            return lookupStepCursor(cumAlg1, t);
          }
          if (methodId === "alg3") {
            if (t <= phase1Dur) {
              return lookupStepCursor(cum3a, t);
            }
            return escStep + lookupStepCursor(cum3b, t - phase1Dur);
          }
          return 0;
        },
      };
    }
  }

  // Case B: Shared-step race (Bowl, SixPoints, Quartic, Outlier)
  // If there is both a fast method (e.g. Nesterov/Alg1) and a much slower method (e.g. GD),
  // split into Phase 1 (0 .. fastSteps) and Phase 2 (fastSteps .. maxSteps) so the fast race is paced clearly.
  const validRuns = runs.filter((r) => r.finalStatus !== "flewoff");
  const stepCounts = validRuns.map((r) => r.finalSteps).sort((a, b) => a - b);
  const minSteps = stepCounts[0] ?? 1;
  const maxSteps = stepCounts[stepCounts.length - 1] ?? 1;

  if (maxSteps > minSteps * 1.4 && validRuns.length > 1) {
    const phase1Dur = 4.6;
    const phase2Dur = 2.6;
    const totalDuration = phase1Dur + phase2Dur;

    const fastRuns = validRuns.filter((r) => r.finalSteps <= minSteps * 1.25);
    const d1: number[] = [];
    const rem1: number[] = [];
    for (let k = 0; k < minSteps; k++) {
      let maxD = 0;
      let maxRem = 0;
      for (const r of fastRuns) {
        if (k < r.finalSteps) {
          const stepD = normDist(r.points[k], r.points[k + 1]);
          const remD = normDist(r.points[k], r.points[r.points.length - 1]);
          if (stepD > maxD) maxD = stepD;
          if (remD > maxRem) maxRem = remD;
        }
      }
      d1.push(maxD);
      rem1.push(maxRem);
    }
    const cum1 = buildCumTimes(d1, rem1, phase1Dur, 0.55);

    const slowRuns = validRuns.filter((r) => r.finalSteps > minSteps);
    const d2: number[] = [];
    const rem2: number[] = [];
    for (let k = minSteps; k < maxSteps; k++) {
      let maxD = 0;
      let maxRem = 0;
      for (const r of slowRuns) {
        if (k < r.finalSteps) {
          const stepD = normDist(r.points[k], r.points[k + 1]);
          const remD = normDist(r.points[k], r.points[r.points.length - 1]);
          if (stepD > maxD) maxD = stepD;
          if (remD > maxRem) maxRem = remD;
        }
      }
      d2.push(maxD);
      rem2.push(maxRem);
    }
    const cum2 = buildCumTimes(d2, rem2, phase2Dur, 0.65);

    return {
      totalDuration,
      getMethodCursor: (methodId, t) => {
        const run = runs.find((r) => r.id === methodId);
        const cap = run?.finalSteps ?? maxSteps;
        if (t <= phase1Dur) {
          return Math.min(cap, lookupStepCursor(cum1, t));
        }
        return Math.min(cap, minSteps + lookupStepCursor(cum2, t - phase1Dur));
      },
    };
  }

  // Case C: Single phase shared-step schedule (Quartic, Outlier)
  const totalDuration = preset.id === "outlier" ? 6.6 : 5.4;
  const exponent = preset.id === "outlier" ? 0.78 : 0.55;
  const dAll: number[] = [];
  const remAll: number[] = [];
  for (let k = 0; k < maxSteps; k++) {
    let maxD = 0;
    let maxRem = 0;
    for (const r of validRuns) {
      if (k < r.finalSteps) {
        const stepD = normDist(r.points[k], r.points[k + 1]);
        const remD = normDist(r.points[k], r.points[r.points.length - 1]);
        if (stepD > maxD) maxD = stepD;
        if (remD > maxRem) maxRem = remD;
      }
    }
    dAll.push(maxD);
    remAll.push(maxRem);
  }
  const cumAll = buildCumTimes(dAll, remAll, totalDuration, exponent);

  return {
    totalDuration,
    getMethodCursor: (methodId, t) => {
      const run = runs.find((r) => r.id === methodId);
      const cap = run?.finalSteps ?? maxSteps;
      return Math.min(cap, lookupStepCursor(cumAll, t));
    },
  };
}

function buildResultFact(
  preset: PresetConfig,
  runs: ComputedMethodRun[]
): string {
  if (preset.id === "bowl") {
    const gd = runs.find((r) => r.id === "gd");
    const agd = runs.find((r) => r.id === "nesterov");
    if (gd && agd && agd.finalSteps > 0) {
      const ratio = Math.round(gd.finalSteps / agd.finalSteps);
      return `NESTEROV ${ratio}× FASTER`;
    }
  }
  if (preset.id === "quartic") {
    const alg1 = runs.find((r) => r.id === "alg1");
    if (alg1?.finalStatus === "flewoff") {
      return `L = ${preset.defaultL} TOO SMALL · FLEW OFF`;
    }
    return `CONVERGED TO X = 3 IN ${alg1?.finalSteps ?? 24} STEPS`;
  }
  if (preset.id === "saddle") {
    return "CAUGHT HILL · ALG 3 ESCAPED TO (1, 0)";
  }
  if (preset.id === "sixpoints") {
    const alg1 = runs.find((r) => r.id === "alg1");
    if (alg1) {
      return `MEDIAN (${alg1.points[alg1.points.length - 1][0].toFixed(
        2
      )}, ${alg1.points[alg1.points.length - 1][1].toFixed(2)}) · ${
        alg1.finalSteps
      } STEPS`;
    }
  }
  if (preset.id === "outlier") {
    const alg1 = runs.find((r) => r.id === "alg1");
    if (alg1?.finalStatus === "caught") {
      return "ALG 1 CAUGHT HILL · ALG 3 FIT (2.85, 4.14)";
    }
    return `ROBUST FIT (2.85, 4.14) IN ${alg1?.finalSteps ?? 139} STEPS`;
  }
  return "RACE COMPLETE";
}

export default function Page() {
  const [presetId, setPresetId] = useState<PresetId>("bowl");
  const [bowlK, setBowlK] = useState<10 | 100 | 1000>(100);
  const [quarticL, setQuarticL] = useState<number>(312);
  const [sixArrangement, setSixArrangement] =
    useState<SixPointArrangementId>("ellipse");
  const [outlierStartIdx, setOutlierStartIdx] = useState<number>(2); // default (20, 20)
  const [showNotABowl, setShowNotABowl] = useState<boolean>(true);
  const [zoomToAction, setZoomToAction] = useState<boolean>(true);
  const [customStart, setCustomStart] = useState<Vec | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const preset: PresetConfig = useMemo(() => {
    if (presetId === "bowl") return makeBowlPreset(bowlK);
    if (presetId === "quartic") return makeQuarticPreset(quarticL);
    if (presetId === "saddle") return makeSaddlePreset();
    if (presetId === "sixpoints") return makeSixPointPreset(sixArrangement);
    return makeOutlierPreset(OUTLIER_STARTS[outlierStartIdx].point);
  }, [presetId, bowlK, quarticL, sixArrangement, outlierStartIdx]);

  const startPoint: Vec = customStart ?? preset.defaultStart;

  const computedRuns = useMemo(() => {
    return preset.defaultMethods.map((mId) =>
      computeMethodRun(preset, mId, startPoint)
    );
  }, [preset, startPoint]);

  const effectiveDomain: Domain2D = useMemo(() => {
    if (!zoomToAction) return preset.domain;
    return computeActionDomain(preset, startPoint, computedRuns);
  }, [preset, startPoint, computedRuns, zoomToAction]);

  const sixPointsMedian: Vec | undefined = useMemo(() => {
    if (preset.id !== "sixpoints") return undefined;
    const alg1 = computedRuns.find((r) => r.id === "alg1");
    return alg1 ? alg1.points[alg1.points.length - 1] : undefined;
  }, [preset.id, computedRuns]);

  const raceSchedule = useMemo(() => {
    return buildRaceSchedule(preset, effectiveDomain, computedRuns);
  }, [preset, effectiveDomain, computedRuns]);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
      return;
    }

    if (reducedMotion) {
      setElapsedSec(raceSchedule.totalDuration);
      setIsRunning(false);
      setIsFinished(true);
      return;
    }

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      setElapsedSec((prev) => {
        const next = prev + dt * speed;
        if (next >= raceSchedule.totalDuration) {
          setIsRunning(false);
          setIsFinished(true);
          return raceSchedule.totalDuration;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, speed, reducedMotion, raceSchedule]);

  // Announce outcomes via aria-live when finished
  useEffect(() => {
    if (!isFinished) return;
    const summary = computedRuns
      .map((r) => {
        const name = METHOD_META[r.id].name;
        if (r.finalStatus === "caught") {
          return `${name} caught non-convex hill after ${r.finalSteps} steps`;
        }
        if (r.finalStatus === "flewoff") {
          return `${name} flew off because L is too small`;
        }
        if (r.finalStatus === "escaped") {
          return `${name} escaped and converged in ${r.finalSteps} outer iterations`;
        }
        return `${name} converged in ${r.finalSteps} steps`;
      })
      .join(". ");
    setLiveAnnouncement(summary);
  }, [isFinished, computedRuns]);

  const resetStage = () => {
    setIsRunning(false);
    setIsFinished(false);
    setElapsedSec(0);
    setLiveAnnouncement("");
  };

  const handleSelectPreset = (id: PresetId) => {
    setPresetId(id);
    setCustomStart(null);
    resetStage();
  };

  const handleRunPause = () => {
    if (isFinished || elapsedSec >= raceSchedule.totalDuration) {
      setIsFinished(false);
      setElapsedSec(0);
      setIsRunning(true);
    } else {
      setIsRunning((r) => !r);
    }
  };

  const handleReset = () => {
    setCustomStart(null);
    resetStage();
  };

  // Determine winning method row when finished
  const winnerId: MethodId | null = useMemo(() => {
    if (!isFinished) return null;
    const valid = computedRuns.filter(
      (r) => r.finalStatus === "converged" || r.finalStatus === "escaped"
    );
    if (valid.length === 0) return null;
    valid.sort((a, b) => a.finalSteps - b.finalSteps);
    return valid[0].id;
  }, [isFinished, computedRuns]);

  // Build live Ledger rows and Canvas overlays for current elapsedSec
  const { rows, overlays } = useMemo(() => {
    const outRows: LedgerRowData[] = [];
    const outOverlays: MethodOverlayRenderData[] = [];

    for (const run of computedRuns) {
      const meta = METHOD_META[run.id];
      const clampedCursor = isFinished
        ? run.finalSteps
        : Math.min(
            run.finalSteps,
            raceSchedule.getMethodCursor(run.id, elapsedSec)
          );
      const idxFloor = Math.floor(clampedCursor);
      const idxCeil = Math.min(run.points.length - 1, idxFloor + 1);
      const frac = clampedCursor - idxFloor;

      const methodDone =
        isFinished || (clampedCursor >= run.finalSteps - 1e-6 && elapsedSec > 0);
      const methodAtRest = !isRunning && !isFinished && elapsedSec === 0;

      let trail: Vec[] = [];
      let currentPos: Vec = run.points[0];

      if (run.finalStatus === "flewoff") {
        // Animate ball flying toward right edge of domain before showing FLEW OFF tile
        const edgeX = effectiveDomain.xMax;
        const flyT = Math.min(1, clampedCursor);
        currentPos = methodDone
          ? [edgeX]
          : [run.points[0][0] + (edgeX - run.points[0][0]) * flyT];
        trail = [run.points[0], currentPos];
      } else if (run.stepSubPaths && run.stepSubPaths.length > 0) {
        // Guarded Algorithm 3 with smooth inner sub-paths
        for (let k = 0; k < idxFloor && k < run.stepSubPaths.length; k++) {
          const sp = run.stepSubPaths[k];
          for (let j = 0; j < sp.length; j++) {
            if (trail.length === 0 || dist(trail[trail.length - 1], sp[j]) > 1e-6) {
              trail.push(sp[j]);
            }
          }
        }
        if (idxFloor < run.stepSubPaths.length && !reducedMotion) {
          const sampled = samplePolyline(run.stepSubPaths[idxFloor], frac);
          for (const pt of sampled.prefix) {
            if (trail.length === 0 || dist(trail[trail.length - 1], pt) > 1e-6) {
              trail.push(pt);
            }
          }
          currentPos = sampled.pos;
        } else {
          currentPos = run.points[Math.min(idxFloor, run.points.length - 1)];
          if (trail.length === 0) trail.push(currentPos);
        }
      } else {
        trail = run.points.slice(0, idxFloor + 1);
        currentPos = reducedMotion
          ? run.points[idxFloor]
          : interpolateVec(run.points[idxFloor], run.points[idxCeil], frac);
        if (!reducedMotion && trail.length > 0) {
          trail.push(currentPos);
        }
      }

      const slopeVal =
        run.slopes[Math.min(idxFloor, run.slopes.length - 1)] ?? 0;

      const badgeStatus: BadgeStatus = methodAtRest
        ? "ready"
        : methodDone
        ? run.finalStatus
        : "running";

      const showEscapeNow =
        methodDone ||
        (run.escapeStepIdx !== undefined && clampedCursor >= run.escapeStepIdx);

      outRows.push({
        id: run.id,
        glyph: meta.glyph,
        name: meta.name,
        steps: methodDone ? run.finalSteps : idxFloor,
        slope: slopeVal,
        status: badgeStatus,
        badgeSteps: methodDone ? run.finalSteps : undefined,
        isWinner: winnerId === run.id,
      });

      outOverlays.push({
        id: run.id,
        trail,
        currentPos,
        witnessU: methodDone ? run.witnessU : undefined,
        witnessV: methodDone ? run.witnessV : undefined,
        escapeFrom: showEscapeNow ? run.escapeFrom : undefined,
        escapeTo: showEscapeNow ? run.escapeTo : undefined,
        flewOffX: methodDone ? run.flewOffX : undefined,
      });
    }

    return { rows: outRows, overlays: outOverlays };
  }, [
    computedRuns,
    elapsedSec,
    isRunning,
    isFinished,
    winnerId,
    reducedMotion,
    raceSchedule,
    effectiveDomain,
  ]);

  const resultFact = useMemo(() => {
    if (!isFinished) return null;
    return buildResultFact(preset, computedRuns);
  }, [isFinished, preset, computedRuns]);

  return (
    <main className="dp-sheet">
      <Hero />
      <PresetPicker selected={presetId} onSelect={handleSelectPreset} />
      <Stage
        preset={preset}
        effectiveDomain={effectiveDomain}
        sixPointsMedian={sixPointsMedian}
        startPoint={startPoint}
        onSelectStartPoint={(pt) => {
          setCustomStart(pt);
          resetStage();
        }}
        rows={rows}
        methodOverlays={overlays}
        resultFact={resultFact}
        isRunning={isRunning}
        onRunPause={handleRunPause}
        onReset={handleReset}
        speed={speed}
        onSpeedChange={setSpeed}
        bowlK={bowlK}
        onBowlKChange={(k) => {
          setBowlK(k);
          setCustomStart(null);
          resetStage();
        }}
        quarticL={quarticL}
        onQuarticLChange={(L) => {
          setQuarticL(L);
          resetStage();
        }}
        sixArrangement={sixArrangement}
        onSixArrangementChange={(arr) => {
          setSixArrangement(arr);
          setCustomStart(null);
          resetStage();
        }}
        outlierStartIdx={outlierStartIdx}
        onOutlierStartChange={(idx) => {
          setOutlierStartIdx(idx);
          setCustomStart(null);
          resetStage();
        }}
        showNotABowl={showNotABowl}
        onToggleNotABowl={() => setShowNotABowl((v) => !v)}
        zoomToAction={zoomToAction}
        onToggleZoom={() => setZoomToAction((z) => !z)}
        reducedMotion={reducedMotion}
        liveAnnouncement={liveAnnouncement}
      />
      <footer className="dp-footer">
        <span>
          Enes Demirel · Faculty sponsor Dr. Enrico Au-Yeung · Department of
          Mathematical Sciences, DePaul University · based on Carmon et al.
          (2017)
        </span>
        <span>OFFLINE RESEARCH DEMO</span>
      </footer>
    </main>
  );
}
