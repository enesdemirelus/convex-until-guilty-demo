import React from "react";

export type BadgeStatus =
  | "ready"
  | "running"
  | "converged"
  | "caught"
  | "escaped"
  | "flewoff";

interface BadgeProps {
  status: BadgeStatus;
  steps?: number;
}

export function Badge({ status, steps }: BadgeProps) {
  switch (status) {
    case "converged":
      return (
        <span className="dp-badge dp-badge-converged">
          <span aria-hidden="true">✓</span>
          <span>
            CONVERGED{typeof steps === "number" ? ` · ${steps} STEPS` : ""}
          </span>
        </span>
      );
    case "caught":
      return (
        <span className="dp-badge dp-badge-caught">
          <span aria-hidden="true">✕</span>
          <span>CAUGHT · NOT A BOWL</span>
        </span>
      );
    case "escaped":
      return (
        <span className="dp-badge dp-badge-escaped">
          <span aria-hidden="true">↗</span>
          <span>
            ESCAPED{typeof steps === "number" ? ` · ${steps} ROUNDS` : ""}
          </span>
        </span>
      );
    case "flewoff":
      return (
        <span className="dp-badge dp-badge-flewoff">
          <span aria-hidden="true">→</span>
          <span>L TOO SMALL · FLEW OFF</span>
        </span>
      );
    case "running":
      return (
        <span className="dp-badge dp-badge-running">
          <span aria-hidden="true">▶</span>
          <span>RUNNING</span>
        </span>
      );
    case "ready":
    default:
      return (
        <span className="dp-badge dp-badge-ready">
          <span aria-hidden="true">■</span>
          <span>AT REST</span>
        </span>
      );
  }
}
