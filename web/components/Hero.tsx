import React from "react";

export function Hero() {
  return (
    <header className="dp-hero">
      <div className="dp-hero-meta">
        <span className="dp-hero-tag">
          DEPAUL STEM RESEARCH SHOWCASE · ENES DEMIREL
        </span>
        <span className="dp-hero-tag">
          FACULTY SPONSOR DR. ENRICO AU-YEUNG
        </span>
      </div>
      <h1 className="dp-hero-stack">
        <span className="dp-strip dp-strip-1">CONVEX UNTIL</span>
        <span className="dp-strip-row-3">
          <span className="dp-strip dp-strip-2">PROVEN GUILTY</span>
          <span className="dp-arrow-tile" aria-hidden="true">
            →
          </span>
        </span>
      </h1>
    </header>
  );
}
