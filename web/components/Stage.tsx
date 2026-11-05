"use client";

import React, { useEffect, useRef } from "react";
import {
  MethodId,
  OUTLIER_DATA,
  PresetConfig,
  SixPointArrangementId,
  computeOutlierResiduals,
} from "@/lib/math/presets";
import { Vec } from "@/lib/math/vec";
import { Ledger, LedgerRowData } from "./Ledger";
import { Controls } from "./Controls";
import {
  draw1DQuarticCurve,
  drawBall,
  drawEscapeArrow,
  drawFixedMarkers,
  drawFlewOffTile,
  drawNotABowlLegendChip,
  drawSixPointsOverlay,
  drawTag,
  drawTrail,
  drawWitnessPair,
  getPlotViewport,
  render2DBackdrop,
  screenToWorld,
  worldToScreen,
} from "./plotRenderer";
import { THEME } from "@/lib/theme";

export interface MethodOverlayRenderData {
  id: MethodId;
  trail: Vec[];
  currentPos: Vec;
  witnessU?: Vec;
  witnessV?: Vec;
  escapeFrom?: Vec;
  escapeTo?: Vec;
  flewOffX?: number;
}

interface StageProps {
  preset: PresetConfig;
  startPoint: Vec;
  onSelectStartPoint: (pt: Vec) => void;
  rows: LedgerRowData[];
  methodOverlays: MethodOverlayRenderData[];
  resultFact?: string | null;
  isRunning: boolean;
  onRunPause: () => void;
  onReset: () => void;
  speed: 1 | 2 | 4;
  onSpeedChange: (s: 1 | 2 | 4) => void;
  bowlK: 10 | 100 | 1000;
  onBowlKChange: (k: 10 | 100 | 1000) => void;
  quarticL: number;
  onQuarticLChange: (L: number) => void;
  sixArrangement: SixPointArrangementId;
  onSixArrangementChange: (arr: SixPointArrangementId) => void;
  outlierStartIdx: number;
  onOutlierStartChange: (idx: number) => void;
  showNotABowl: boolean;
  onToggleNotABowl: () => void;
  reducedMotion: boolean;
  liveAnnouncement: string;
}

export function Stage({
  preset,
  startPoint,
  onSelectStartPoint,
  rows,
  methodOverlays,
  resultFact,
  isRunning,
  onRunPause,
  onReset,
  speed,
  onSpeedChange,
  bowlK,
  onBowlKChange,
  quarticL,
  onQuarticLChange,
  sixArrangement,
  onSixArrangementChange,
  outlierStartIdx,
  onOutlierStartChange,
  showNotABowl,
  onToggleNotABowl,
  reducedMotion,
  liveAnnouncement,
}: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backdropRef = useRef<{
    key: string;
    canvas: HTMLCanvasElement;
  } | null>(null);

  // Render canvas whenever landscape or method overlays change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderFrame = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(280, Math.floor(rect.width));
      const height = Math.max(240, Math.floor(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const vp = getPlotViewport(width, height, preset.domain);

      if (preset.view === "curve") {
        draw1DQuarticCurve(ctx, preset, vp);
      } else {
        const cacheKey = `${preset.id}:${bowlK}:${sixArrangement}:${showNotABowl}:${width}x${height}`;
        if (!backdropRef.current || backdropRef.current.key !== cacheKey) {
          backdropRef.current = {
            key: cacheKey,
            canvas: render2DBackdrop(preset, vp, showNotABowl),
          };
        }
        ctx.drawImage(backdropRef.current.canvas, 0, 0);

        if (
          showNotABowl &&
          (preset.id === "saddle" || preset.id === "outlier")
        ) {
          drawNotABowlLegendChip(ctx, vp);
        }
      }

      // Preset-specific overlays
      if (preset.id === "sixpoints") {
        const primaryQ =
          methodOverlays.find((m) => m.id === "alg1")?.currentPos ?? startPoint;
        drawSixPointsOverlay(ctx, vp, sixArrangement, primaryQ);
      }

      if (preset.fixedMarkers && preset.fixedMarkers.length > 0) {
        drawFixedMarkers(ctx, vp, preset.fixedMarkers);
      }

      // Start marker tag
      {
        const syWorld =
          preset.view === "curve" ? preset.f(startPoint) : startPoint[1];
        const [sx, sy] = worldToScreen(vp, startPoint[0], syWorld);
        const clampedX = Math.max(
          vp.padLeft + 34,
          Math.min(vp.padLeft + vp.plotW - 34, sx)
        );
        const clampedY =
          sy - 26 < vp.padTop + 14 ? sy + 26 : Math.max(vp.padTop + 14, sy - 26);
        drawTag(ctx, "START", clampedX, clampedY, THEME.colors.ground);
      }

      // Trails (unless prefers-reduced-motion)
      if (!reducedMotion) {
        for (const m of methodOverlays) {
          drawTrail(ctx, vp, preset, m.id, m.trail);
        }
      }

      // Witness pairs and escape arrows
      for (const m of methodOverlays) {
        if (m.witnessU && m.witnessV) {
          drawWitnessPair(ctx, vp, preset, m.witnessU, m.witnessV);
        }
        if (m.escapeFrom && m.escapeTo) {
          drawEscapeArrow(ctx, vp, preset, m.escapeFrom, m.escapeTo);
        }
      }

      // Method balls (slightly spread if sitting on the exact same coordinate)
      const nBalls = methodOverlays.length;
      methodOverlays.forEach((m, idx) => {
        const atStart = m.trail.length <= 1;
        // Also check if another ball is within 6px on screen
        let spreadX =
          atStart && nBalls > 1 ? (idx - (nBalls - 1) / 2) * 14 : 0;
        let spreadY =
          atStart && nBalls > 1 ? (idx - (nBalls - 1) / 2) * -6 : 0;
        if (!atStart && nBalls > 1 && idx > 0) {
          const prev = methodOverlays[0].currentPos;
          const distWorld = Math.hypot(
            m.currentPos[0] - prev[0],
            (m.currentPos[1] ?? 0) - (prev[1] ?? 0)
          );
          if (distWorld < 1e-2) {
            spreadX = idx * 14;
            spreadY = idx * -8;
          }
        }
        drawBall(ctx, vp, preset, m.id, m.currentPos, [spreadX, spreadY]);
      });

      // Flew off tile
      for (const m of methodOverlays) {
        if (typeof m.flewOffX === "number") {
          drawFlewOffTile(ctx, vp, m.flewOffX);
        }
      }
    };

    renderFrame();
    window.addEventListener("resize", renderFrame);
    return () => window.removeEventListener("resize", renderFrame);
  }, [
    preset,
    startPoint,
    methodOverlays,
    bowlK,
    sixArrangement,
    showNotABowl,
    reducedMotion,
  ]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vp = getPlotViewport(canvas.width, canvas.height, preset.domain);
    if (
      sx < vp.padLeft ||
      sx > vp.padLeft + vp.plotW ||
      sy < vp.padTop ||
      sy > vp.padTop + vp.plotH
    ) {
      return;
    }
    const [wx, wy] = screenToWorld(vp, sx, sy);
    if (preset.view === "curve") {
      onSelectStartPoint([Number(wx.toFixed(2))]);
    } else {
      onSelectStartPoint([Number(wx.toFixed(2)), Number(wy.toFixed(2))]);
    }
  };

  const startCoordsText =
    startPoint.length === 1
      ? `X = ${startPoint[0].toFixed(2)}`
      : `(${startPoint[0].toFixed(2)}, ${startPoint[1].toFixed(2)})`;

  const lValueText =
    preset.defaultL >= 10 && !Number.isInteger(preset.defaultL)
      ? preset.defaultL.toFixed(2)
      : Number.isInteger(preset.defaultL)
      ? String(preset.defaultL)
      : preset.defaultL.toFixed(2);

  return (
    <section className="dp-stage" aria-label="Optimization stage">
      <div className="dp-sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <div className="dp-stage-upper">
        <div className="dp-plot-pane">
          <div className="dp-plot-header">
            <div>
              <h2 className="dp-plot-title">{preset.title}</h2>
              <p className="dp-plot-copy">{preset.copyLine1}</p>
              <p className="dp-plot-copy">{preset.copyLine2}</p>
            </div>
            <span className="dp-section-label">CLICK PLOT TO MOVE START</span>
          </div>

          <div className="dp-canvas-wrap">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="dp-canvas"
              role="img"
              aria-label={`${preset.title} optimization landscape`}
            />
          </div>
        </div>

        <div className="dp-ledger-pane">
          <Ledger
            rows={rows}
            startCoordsText={startCoordsText}
            lValueText={lValueText}
          />
          {preset.id === "outlier" && <OutlierResidualsBarPanel />}
          {resultFact ? (
            <div className="dp-result-fact-wrap">
              <div className="dp-result-fact">{resultFact}</div>
            </div>
          ) : null}
        </div>
      </div>

      <Controls
        presetId={preset.id}
        isRunning={isRunning}
        onRunPause={onRunPause}
        onReset={onReset}
        speed={speed}
        onSpeedChange={onSpeedChange}
        bowlK={bowlK}
        onBowlKChange={onBowlKChange}
        quarticL={quarticL}
        onQuarticLChange={onQuarticLChange}
        sixArrangement={sixArrangement}
        onSixArrangementChange={onSixArrangementChange}
        outlierStartIdx={outlierStartIdx}
        onOutlierStartChange={onOutlierStartChange}
        showNotABowl={showNotABowl}
        onToggleNotABowl={onToggleNotABowl}
      />
    </section>
  );
}

function OutlierResidualsBarPanel() {
  const lsRes = computeOutlierResiduals(2.5857, 4.6543);
  const robRes = computeOutlierResiduals(2.8496, 4.1437);
  const maxAbs = 2.0;

  return (
    <div className="dp-residuals-panel">
      <div className="dp-residuals-header">
        <span>20 DATA POINT RESIDUALS (POINT #2 = OUTLIER)</span>
        <span className="dp-residuals-legend">
          <span className="dp-swatch-ls" /> LEAST SQUARES
          <span className="dp-swatch-rob" /> ROBUST FIT
        </span>
      </div>
      <div className="dp-residuals-bars" role="img" aria-label="20 residuals comparison between least squares and robust fit">
        {OUTLIER_DATA.map((pt, i) => {
          const hLs = Math.min(100, (Math.abs(lsRes[i]) / maxAbs) * 100);
          const hRob = Math.min(100, (Math.abs(robRes[i]) / maxAbs) * 100);
          return (
            <div
              key={pt.index}
              className={`dp-res-col ${pt.isOutlier ? "dp-res-col-outlier" : ""}`}
              title={`Point #${pt.index}: LS=${lsRes[i].toFixed(2)}, Robust=${robRes[i].toFixed(2)}`}
            >
              <div className="dp-res-pair">
                <div
                  className="dp-res-bar dp-res-bar-ls"
                  style={{ height: `${Math.max(4, hLs)}%` }}
                />
                <div
                  className="dp-res-bar dp-res-bar-rob"
                  style={{ height: `${Math.max(4, hRob)}%` }}
                />
              </div>
              <span className="dp-res-idx">{pt.index}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
