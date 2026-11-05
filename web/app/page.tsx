"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Hero } from "@/components/Hero";
import { PresetPicker } from "@/components/PresetPicker";
import { MethodOverlayRenderData, Stage } from "@/components/Stage";
import { LedgerRowData, METHOD_META } from "@/components/Ledger";
import { BadgeStatus } from "@/components/Badge";
import {
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
import { Vec, add, norm, scale, sub } from "@/lib/math/vec";

interface ComputedMethodRun {
  id: MethodId;
  kind: "trajectory" | "guarded";
  traj?: TrajectoryResult;
  guarded?: GuardedResult;
  points: Vec[];
  slopes: number[];
  finalSteps: number;
  finalStatus: BadgeStatus;
  witnessU?: Vec;
  witnessV?: Vec;
  escapeFrom?: Vec;
  escapeTo?: Vec;
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

  // Find the first guilty round that used exploit_nc (or any guilty round) to show the escape arrow
  let escapeFrom: Vec | undefined;
  let escapeTo: Vec | undefined;

  for (const step of res.outerSteps) {
    if (
      step.inner.status === "guilty" &&
      step.inner.u &&
      step.inner.v &&
      step.escapeTarget
    ) {
      if (step.action === "exploit_nc" || !escapeFrom) {
        escapeFrom = step.inner.u;
        escapeTo = step.escapeTarget;
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
    slopes,
    finalSteps: res.iters,
    finalStatus: usedGuilty ? "escaped" : "converged",
    escapeFrom,
    escapeTo,
  };
}

function interpolateVec(a: Vec, b: Vec, t: number): Vec {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return add(a, scale(sub(b, a), t));
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
  const [customStart, setCustomStart] = useState<Vec | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [stepCursor, setStepCursor] = useState<number>(0);
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

  const maxSteps = useMemo(() => {
    return Math.max(1, ...computedRuns.map((r) => r.finalSteps));
  }, [computedRuns]);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Animation loop with adaptive steps per frame so even 13,809 steps finishes in ~3.5 seconds at 1x
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
      return;
    }

    if (reducedMotion) {
      setStepCursor(maxSteps);
      setIsRunning(false);
      setIsFinished(true);
      return;
    }

    // Target duration: ~2.2s for <= 200 steps, ~3.4s for 13,809 steps at 1x speed
    const baseDurationSec =
      maxSteps <= 60 ? 1.5 : maxSteps <= 300 ? 2.2 : maxSteps <= 2000 ? 2.8 : 3.4;
    const stepsPerSecond = (maxSteps / baseDurationSec) * speed;

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      setStepCursor((prev) => {
        const next = prev + stepsPerSecond * dt;
        if (next >= maxSteps) {
          setIsRunning(false);
          setIsFinished(true);
          return maxSteps;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, maxSteps, speed, reducedMotion]);

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
    setStepCursor(0);
    setLiveAnnouncement("");
  };

  const handleSelectPreset = (id: PresetId) => {
    setPresetId(id);
    setCustomStart(null);
    resetStage();
  };

  const handleRunPause = () => {
    if (isFinished || stepCursor >= maxSteps) {
      setIsFinished(false);
      setStepCursor(0);
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

  // Build live Ledger rows and Canvas overlays for current stepCursor
  const { rows, overlays } = useMemo(() => {
    const outRows: LedgerRowData[] = [];
    const outOverlays: MethodOverlayRenderData[] = [];

    for (const run of computedRuns) {
      const meta = METHOD_META[run.id];
      const clampedStep = Math.min(stepCursor, run.finalSteps);
      const idxFloor = Math.floor(clampedStep);
      const idxCeil = Math.min(run.points.length - 1, idxFloor + 1);
      const frac = clampedStep - idxFloor;

      const methodDone =
        isFinished || (stepCursor >= run.finalSteps && stepCursor > 0);
      const methodAtRest = !isRunning && !isFinished && stepCursor === 0;

      // Clamp flew-off point so we don't draw a line 100 units off screen
      const maxDrawIdx =
        run.finalStatus === "flewoff" ? Math.min(1, idxFloor) : idxFloor;
      const trail = run.points.slice(0, maxDrawIdx + 1);
      const currentPos =
        run.finalStatus === "flewoff" && idxFloor >= 1
          ? run.points[0]
          : reducedMotion
          ? run.points[idxFloor]
          : interpolateVec(run.points[idxFloor], run.points[idxCeil], frac);

      if (!reducedMotion && trail.length > 0 && run.finalStatus !== "flewoff") {
        trail.push(currentPos);
      }

      const slopeVal =
        run.slopes[Math.min(idxFloor, run.slopes.length - 1)] ?? 0;

      const badgeStatus: BadgeStatus = methodAtRest
        ? "ready"
        : methodDone
        ? run.finalStatus
        : "running";

      outRows.push({
        id: run.id,
        glyph: meta.glyph,
        name: meta.name,
        steps: idxFloor,
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
        escapeFrom: methodDone ? run.escapeFrom : undefined,
        escapeTo: methodDone ? run.escapeTo : undefined,
        flewOffX: methodDone ? run.flewOffX : undefined,
      });
    }

    return { rows: outRows, overlays: outOverlays };
  }, [computedRuns, stepCursor, isRunning, isFinished, winnerId, reducedMotion]);

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
