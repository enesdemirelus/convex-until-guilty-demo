import React from "react";
import { PresetId } from "@/lib/math/presets";

export interface PresetTileInfo {
  id: PresetId;
  name: string;
  hint: string;
}

export const PRESET_TILES: ReadonlyArray<PresetTileInfo> = [
  {
    id: "bowl",
    name: "STRETCHED BOWL",
    hint: "Why Nesterov beats plain gradient descent in a narrow valley.",
  },
  {
    id: "quartic",
    name: "QUARTIC CURVE",
    hint: "Pick step bend L = 312 vs L = 5 and watch a bad step fly off.",
  },
  {
    id: "saddle",
    name: "SADDLE PASS",
    hint: "Algorithm 1 catches the hill; Algorithm 3 uses it to escape.",
  },
  {
    id: "sixpoints",
    name: "6-POINT MEDIAN",
    hint: "Shortest total distance from one warehouse to six stores.",
  },
  {
    id: "outlier",
    name: "OUTLIER FIT",
    hint: "Ignore one bad data point without getting trapped in hills.",
  },
];

function PresetLineIcon({ id }: { id: PresetId }) {
  switch (id) {
    case "bowl":
      return (
        <svg width="42" height="28" viewBox="0 0 42 28" aria-hidden="true">
          <ellipse
            cx="21"
            cy="14"
            rx="17"
            ry="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <ellipse
            cx="21"
            cy="14"
            rx="9"
            ry="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
      );
    case "quartic":
      return (
        <svg width="42" height="28" viewBox="0 0 42 28" aria-hidden="true">
          <path
            d="M 4 4 C 10 24, 32 24, 38 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <line
            x1="4"
            y1="25"
            x2="38"
            y2="25"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
      );
    case "saddle":
      return (
        <svg width="42" height="28" viewBox="0 0 42 28" aria-hidden="true">
          <path
            d="M 4 22 Q 21 6 38 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M 10 6 Q 21 20 32 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
      );
    case "sixpoints":
      return (
        <svg width="42" height="28" viewBox="0 0 42 28" aria-hidden="true">
          <rect x="5" y="4" width="5" height="5" fill="currentColor" />
          <rect x="32" y="4" width="5" height="5" fill="currentColor" />
          <rect x="3" y="18" width="5" height="5" fill="currentColor" />
          <rect x="34" y="18" width="5" height="5" fill="currentColor" />
          <rect x="18" y="2" width="5" height="5" fill="currentColor" />
          <rect x="19" y="20" width="5" height="5" fill="currentColor" />
        </svg>
      );
    case "outlier":
      return (
        <svg width="42" height="28" viewBox="0 0 42 28" aria-hidden="true">
          <line
            x1="4"
            y1="23"
            x2="38"
            y2="9"
            stroke="currentColor"
            strokeWidth="3"
          />
          <rect x="10" y="18" width="4" height="4" fill="currentColor" />
          <rect x="22" y="13" width="4" height="4" fill="currentColor" />
          <rect x="13" y="3" width="6" height="6" fill="currentColor" />
        </svg>
      );
  }
}

interface PresetPickerProps {
  selected: PresetId;
  onSelect: (id: PresetId) => void;
}

export function PresetPicker({ selected, onSelect }: PresetPickerProps) {
  return (
    <section className="dp-field-band" aria-label="Preset landscapes">
      <div className="dp-field-header">
        <p className="dp-field-sentence">
          Pick a landscape, press Run, and watch optimization balls race downhill
          while monitoring whether the surface is a true bowl or a hidden hill.
        </p>
        <span className="dp-section-label">PICK A LANDSCAPE</span>
      </div>
      <div
        className="dp-preset-grid"
        role="radiogroup"
        aria-label="Optimization landscape presets"
      >
        {PRESET_TILES.map((tile) => {
          const isSelected = tile.id === selected;
          return (
            <button
              key={tile.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(tile.id)}
              className={`dp-btn dp-preset-tile ${
                isSelected ? "dp-preset-tile-selected" : ""
              }`.trim()}
            >
              <div className="dp-preset-tile-top">
                <PresetLineIcon id={tile.id} />
                <span className="dp-preset-check" aria-hidden="true">
                  {isSelected ? "✓" : ""}
                </span>
              </div>
              <div>
                <div className="dp-preset-name">{tile.name}</div>
                <div className="dp-preset-hint">{tile.hint}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
