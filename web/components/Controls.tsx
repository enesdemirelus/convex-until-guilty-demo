import React from "react";
import {
  OUTLIER_STARTS,
  PresetId,
  SIX_POINT_ARRANGEMENTS,
  SixPointArrangementId,
} from "@/lib/math/presets";
import { Button } from "./Button";

export type SpeedOption = 0.25 | 0.5 | 1 | 2;

interface ControlsProps {
  presetId: PresetId;
  isRunning: boolean;
  onRunPause: () => void;
  onReset: () => void;
  speed: SpeedOption;
  onSpeedChange: (s: SpeedOption) => void;
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
  zoomToAction: boolean;
  onToggleZoom: () => void;
}

export function Controls({
  presetId,
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
  zoomToAction,
  onToggleZoom,
}: ControlsProps) {
  // Log scale for quartic L in [1, 1000]: slider value u in [0, 1000] -> L = 10^(3 * u / 1000)
  const sliderVal = Math.round((Math.log10(Math.max(1, quarticL)) / 3) * 1000);
  const trueLPercent = (Math.log10(312) / 3) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const u = Number(e.target.value);
    const rawL = Math.pow(10, (3 * u) / 1000);
    // Snap near 312 or 5 for easy discovery
    if (Math.abs(rawL - 312) < 18) {
      onQuarticLChange(312);
    } else if (Math.abs(rawL - 5) < 0.8) {
      onQuarticLChange(5);
    } else {
      onQuarticLChange(Math.max(1, Math.round(rawL)));
    }
  };

  return (
    <div className="dp-controls-bar" role="region" aria-label="Stage controls">
      <div className="dp-controls-group">
        <Button
          variant={isRunning ? "pause" : "primary"}
          onClick={onRunPause}
        >
          {isRunning ? "❚❚ PAUSE" : "▶ RUN"}
        </Button>
        <Button variant="secondary" onClick={onReset}>
          ↺ RESET
        </Button>

        <div className="dp-controls-group" style={{ marginLeft: "6px" }}>
          <span className="dp-control-label">SPEED</span>
          {([0.25, 0.5, 1, 2] as const).map((s) => (
            <Button
              key={s}
              variant="chip"
              active={speed === s}
              onClick={() => onSpeedChange(s)}
              aria-pressed={speed === s}
            >
              {s}×
            </Button>
          ))}
        </div>

        <div className="dp-controls-group" style={{ marginLeft: "6px" }}>
          <span className="dp-control-label">VIEW</span>
          <Button
            variant="chip"
            active={zoomToAction}
            onClick={() => {
              if (!zoomToAction) onToggleZoom();
            }}
            aria-pressed={zoomToAction}
          >
            ZOOM PATH
          </Button>
          <Button
            variant="chip"
            active={!zoomToAction}
            onClick={() => {
              if (zoomToAction) onToggleZoom();
            }}
            aria-pressed={!zoomToAction}
          >
            FULL MAP
          </Button>
        </div>
      </div>

      {/* Preset-specific controls */}
      <div className="dp-controls-group">
        {presetId === "bowl" && (
          <>
            <span className="dp-control-label">STRETCH κ = L/σ</span>
            {([10, 100, 1000] as const).map((k) => (
              <Button
                key={k}
                variant="chip"
                active={bowlK === k}
                onClick={() => onBowlKChange(k)}
                aria-pressed={bowlK === k}
              >
                κ = {k}
              </Button>
            ))}
          </>
        )}

        {presetId === "quartic" && (
          <div className="dp-controls-group">
            <div className="dp-slider-wrap">
              <div className="dp-slider-header">
                <label htmlFor="quartic-l-slider">
                  SHARPEST BEND L = {quarticL}
                </label>
                <span>STEP = 1/{quarticL}</span>
              </div>
              <div className="dp-slider-track-box">
                <input
                  id="quartic-l-slider"
                  type="range"
                  min={0}
                  max={1000}
                  value={sliderVal}
                  onChange={handleSliderChange}
                  className="dp-range"
                  aria-label="Sharpest bend L parameter"
                />
                <div
                  className="dp-true-l-tick"
                  style={{ left: `${trueLPercent}%` }}
                >
                  <div className="dp-true-l-line" />
                  <span className="dp-true-l-tag">TRUE L = 312</span>
                </div>
              </div>
            </div>
            <Button
              variant="chip"
              active={quarticL === 5}
              onClick={() => onQuarticLChange(5)}
            >
              TRY L = 5 (TOO SMALL)
            </Button>
            <Button
              variant="chip"
              active={quarticL === 312}
              onClick={() => onQuarticLChange(312)}
            >
              TRUE L = 312
            </Button>
          </div>
        )}

        {(presetId === "saddle" || presetId === "outlier") && (
          <Button
            variant="chip"
            active={showNotABowl}
            onClick={onToggleNotABowl}
            aria-pressed={showNotABowl}
          >
            ▨ NOT A BOWL {showNotABowl ? "ON" : "OFF"}
          </Button>
        )}

        {presetId === "sixpoints" && (
          <>
            <span className="dp-control-label">STORES</span>
            {(
              Object.keys(SIX_POINT_ARRANGEMENTS) as SixPointArrangementId[]
            ).map((arrId) => (
              <Button
                key={arrId}
                variant="chip"
                active={sixArrangement === arrId}
                onClick={() => onSixArrangementChange(arrId)}
                aria-pressed={sixArrangement === arrId}
              >
                {SIX_POINT_ARRANGEMENTS[arrId].label}
              </Button>
            ))}
          </>
        )}

        {presetId === "outlier" && (
          <>
            <span className="dp-control-label">START</span>
            {OUTLIER_STARTS.map((st, idx) => (
              <Button
                key={st.label}
                variant="chip"
                active={outlierStartIdx === idx}
                onClick={() => onOutlierStartChange(idx)}
                aria-pressed={outlierStartIdx === idx}
              >
                {st.label}
              </Button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
