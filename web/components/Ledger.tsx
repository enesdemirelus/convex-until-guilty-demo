import React from "react";
import { MethodId } from "@/lib/math/presets";
import { Badge, BadgeStatus } from "./Badge";

export interface LedgerRowData {
  id: MethodId;
  glyph: string;
  name: string;
  steps: number;
  slope: number;
  status: BadgeStatus;
  badgeSteps?: number;
  isWinner?: boolean;
}

export const METHOD_META: Record<
  MethodId,
  { glyph: string; name: string; glyphClass: string }
> = {
  gd: {
    glyph: "G",
    name: "GRADIENT DESCENT",
    glyphClass: "dp-glyph-gd",
  },
  momentum: {
    glyph: "M",
    name: "HEAVY-BALL MOMENTUM",
    glyphClass: "dp-glyph-momentum",
  },
  nesterov: {
    glyph: "N",
    name: "NESTEROV AGD",
    glyphClass: "dp-glyph-nesterov",
  },
  alg1: {
    glyph: "1",
    name: "ALG 1 · UNTIL GUILTY",
    glyphClass: "dp-glyph-alg1",
  },
  alg3: {
    glyph: "3",
    name: "ALG 3 · GUARDED AGD",
    glyphClass: "dp-glyph-alg3",
  },
};

export function formatSlope(val: number): string {
  if (!Number.isFinite(val)) return "∞";
  if (val === 0) return "0.00";
  if (val < 1e-3 || val >= 1000) return val.toExponential(1);
  if (val >= 100) return val.toFixed(1);
  return val.toFixed(3);
}

interface LedgerProps {
  rows: LedgerRowData[];
  startCoordsText: string;
  lValueText: string;
}

export function Ledger({ rows, startCoordsText, lValueText }: LedgerProps) {
  return (
    <div>
      <div className="dp-ledger-header">
        <span className="dp-ledger-title">RACE LEDGER (HUD)</span>
        <span className="dp-ledger-title">
          START {startCoordsText} · L = {lValueText}
        </span>
      </div>
      <table className="dp-ledger-table" aria-label="Algorithm race ledger">
        <thead>
          <tr>
            <th scope="col">METHOD</th>
            <th scope="col">STEPS</th>
            <th scope="col">|SLOPE|</th>
            <th scope="col">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const meta = METHOD_META[row.id];
            return (
              <tr
                key={row.id}
                className={row.isWinner ? "dp-ledger-row-winner" : undefined}
              >
                <td>
                  <div className="dp-method-cell">
                    <span
                      className={`dp-method-glyph ${meta.glyphClass}`}
                      aria-hidden="true"
                    >
                      {meta.glyph}
                    </span>
                    <span className="dp-method-name">{meta.name}</span>
                  </div>
                </td>
                <td>
                  <span className="dp-hud-num">{row.steps}</span>
                </td>
                <td>
                  <span className="dp-hud-slope">{formatSlope(row.slope)}</span>
                </td>
                <td>
                  <Badge status={row.status} steps={row.badgeSteps} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
