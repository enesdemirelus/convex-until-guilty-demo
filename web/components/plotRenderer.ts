import { THEME } from "@/lib/theme";
import {
  Domain2D,
  FixedMarker,
  MethodId,
  PresetConfig,
  SIX_POINT_ARRANGEMENTS,
  SixPointArrangementId,
} from "@/lib/math/presets";
import { Vec } from "@/lib/math/vec";

export interface PlotViewport {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  plotW: number;
  plotH: number;
  domain: Domain2D;
}

export function getPlotViewport(
  width: number,
  height: number,
  domain: Domain2D
): PlotViewport {
  const padLeft = 46;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 38;
  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    plotW: Math.max(10, width - padLeft - padRight),
    plotH: Math.max(10, height - padTop - padBottom),
    domain,
  };
}

export function worldToScreen(
  vp: PlotViewport,
  x: number,
  y: number
): [number, number] {
  const { domain, padLeft, padTop, plotW, plotH } = vp;
  const u = (x - domain.xMin) / (domain.xMax - domain.xMin);
  const v = (y - domain.yMin) / (domain.yMax - domain.yMin);
  return [padLeft + u * plotW, padTop + (1 - v) * plotH];
}

export function screenToWorld(
  vp: PlotViewport,
  sx: number,
  sy: number
): [number, number] {
  const { domain, padLeft, padTop, plotW, plotH } = vp;
  const u = Math.max(0, Math.min(1, (sx - padLeft) / plotW));
  const v = Math.max(0, Math.min(1, 1 - (sy - padTop) / plotH));
  return [
    domain.xMin + u * (domain.xMax - domain.xMin),
    domain.yMin + v * (domain.yMax - domain.yMin),
  ];
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function render2DBackdrop(
  preset: PresetConfig,
  vp: PlotViewport,
  showNotABowl: boolean
): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = vp.width;
  off.height = vp.height;
  const ctx = off.getContext("2d");
  if (!ctx) return off;

  ctx.fillStyle = THEME.colors.contrast;
  ctx.fillRect(0, 0, vp.width, vp.height);

  const { padLeft, padTop, plotW, plotH, domain } = vp;
  const w = Math.floor(plotW);
  const h = Math.floor(plotH);
  if (w <= 0 || h <= 0) return off;

  // Evaluate f on pixel grid
  const vals = new Float64Array(w * h);
  const nonConvex = new Uint8Array(w * h);
  let fMin = Infinity;
  let fMax = -Infinity;

  for (let py = 0; py < h; py++) {
    const wy = domain.yMax - (py / (h - 1)) * (domain.yMax - domain.yMin);
    for (let px = 0; px < w; px++) {
      const wx = domain.xMin + (px / (w - 1)) * (domain.xMax - domain.xMin);
      const idx = py * w + px;
      const z = [wx, wy];
      const val = preset.f(z);
      vals[idx] = val;
      if (val < fMin) fMin = val;
      if (val > fMax) fMax = val;
      if (showNotABowl && preset.minHessianEig(z) < -1e-6) {
        nonConvex[idx] = 1;
      }
    }
  }

  const eps = Math.max(1e-4, (fMax - fMin) * 0.0025);
  const logMax = Math.log(fMax - fMin + eps) - Math.log(eps);
  const bands = new Uint8Array(w * h);

  for (let i = 0; i < vals.length; i++) {
    const t =
      logMax > 0
        ? (Math.log(Math.max(0, vals[i] - fMin) + eps) - Math.log(eps)) / logMax
        : 0;
    const b = Math.max(0, Math.min(7, Math.floor(t * 8)));
    bands[i] = b;
  }

  const bandRGB = THEME.colors.mapBands.map(parseHex);
  const inkRGB = parseHex(THEME.colors.ink);
  const signalRGB = parseHex(THEME.colors.signal);

  const img = ctx.createImageData(w, h);
  const data = img.data;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = py * w + px;
      const b = bands[idx];

      // 2px crisp black contour on band edges
      let isContour = false;
      for (let dy = -1; dy <= 1 && !isContour; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          const ny = py + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            if (bands[ny * w + nx] !== b) {
              isContour = true;
              break;
            }
          }
        }
      }

      // 2px diagonal red hatching 12px apart where smallest Hessian eigenvalue < 0
      const isHatch =
        nonConvex[idx] === 1 && (((px + py) % 12) + 12) % 12 < 2;

      let rgb = bandRGB[b];
      if (isHatch) rgb = signalRGB;
      if (isContour) rgb = inkRGB;

      const p4 = idx * 4;
      data[p4] = rgb[0];
      data[p4 + 1] = rgb[1];
      data[p4 + 2] = rgb[2];
      data[p4 + 3] = 255;
    }
  }

  ctx.putImageData(img, padLeft, padTop);
  drawAxes(ctx, vp, preset.axisLabels);

  return off;
}

export function drawAxes(
  ctx: CanvasRenderingContext2D,
  vp: PlotViewport,
  axisLabels: [string, string]
) {
  const { padLeft, padTop, plotW, plotH, domain } = vp;

  ctx.save();
  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(padLeft, padTop, plotW, plotH);

  ctx.fillStyle = THEME.colors.ink;
  ctx.font = `800 12px ${THEME.typography.face}`;

  // X ticks (3 ticks: min, mid, max)
  const xTicks = [
    domain.xMin,
    0 >= domain.xMin && 0 <= domain.xMax
      ? 0
      : 0.5 * (domain.xMin + domain.xMax),
    domain.xMax,
  ];
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const xt of xTicks) {
    const [sx] = worldToScreen(vp, xt, domain.yMin);
    ctx.beginPath();
    ctx.moveTo(sx, padTop + plotH);
    ctx.lineTo(sx, padTop + plotH + 5);
    ctx.stroke();
    ctx.fillText(formatTick(xt), sx, padTop + plotH + 7);
  }

  // Y ticks
  const yTicks = [
    domain.yMin,
    0 >= domain.yMin && 0 <= domain.yMax
      ? 0
      : 0.5 * (domain.yMin + domain.yMax),
    domain.yMax,
  ];
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const yt of yTicks) {
    const [, sy] = worldToScreen(vp, domain.xMin, yt);
    ctx.beginPath();
    ctx.moveTo(padLeft - 5, sy);
    ctx.lineTo(padLeft, sy);
    ctx.stroke();
    ctx.fillText(formatTick(yt), padLeft - 7, sy);
  }

  // Axis names
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(axisLabels[0], padLeft + plotW, padTop + plotH + 34);

  ctx.save();
  ctx.translate(12, padTop + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(axisLabels[1], 0, 0);
  ctx.restore();

  ctx.restore();
}

function formatTick(v: number): string {
  if (Math.abs(v) < 1e-9) return "0";
  if (Math.abs(v) >= 10 || Number.isInteger(v)) return v.toFixed(0);
  return v.toFixed(1);
}

export function draw1DQuarticCurve(
  ctx: CanvasRenderingContext2D,
  preset: PresetConfig,
  vp: PlotViewport
) {
  ctx.fillStyle = THEME.colors.contrast;
  ctx.fillRect(0, 0, vp.width, vp.height);

  drawAxes(ctx, vp, preset.axisLabels);

  const { padLeft, padTop, plotW, plotH, domain } = vp;

  ctx.save();
  ctx.beginPath();
  ctx.rect(padLeft, padTop, plotW, plotH);
  ctx.clip();

  // 3px baseline at f(3) = 32
  const [, baseSy] = worldToScreen(vp, 3, 32);
  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(padLeft, baseSy);
  ctx.lineTo(padLeft + plotW, baseSy);
  ctx.stroke();
  ctx.setLineDash([]);

  // 4px black curve
  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const wx = domain.xMin + (i / steps) * (domain.xMax - domain.xMin);
    const wy = preset.f([wx]);
    const [sx, sy] = worldToScreen(vp, wx, wy);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Minimum marker at x = 3, f(3) = 32
  const [minSx, minSy] = worldToScreen(vp, 3, 32);
  drawTag(ctx, "MIN X = 3 (F = 32)", minSx, minSy + 20, THEME.colors.emphasis);

  ctx.restore();
}

export function drawTag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bgColor: string = THEME.colors.contrast,
  borderColor: string = THEME.colors.ink
) {
  ctx.save();
  ctx.font = `800 11px ${THEME.typography.face}`;
  const metrics = ctx.measureText(text);
  const padX = 6;
  const boxW = Math.ceil(metrics.width) + padX * 2;
  const boxH = 20;
  const bx = Math.round(x - boxW / 2);
  const by = Math.round(y - boxH / 2);

  ctx.fillStyle = THEME.colors.ink;
  ctx.fillRect(bx + 2, by + 2, boxW, boxH);

  ctx.fillStyle = bgColor;
  ctx.fillRect(bx, by, boxW, boxH);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, boxW, boxH);

  ctx.fillStyle = THEME.colors.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, bx + boxW / 2, by + boxH / 2 + 1);
  ctx.restore();
}

export function drawSixPointsOverlay(
  ctx: CanvasRenderingContext2D,
  vp: PlotViewport,
  arrangement: SixPointArrangementId,
  currentQ: Vec
) {
  const pts = SIX_POINT_ARRANGEMENTS[arrangement].points;
  const [qx, qy] = worldToScreen(vp, currentQ[0], currentQ[1]);

  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.padLeft, vp.padTop, vp.plotW, vp.plotH);
  ctx.clip();

  // Live lines from Q to all 6 points
  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i < pts.length; i++) {
    const [px, py] = worldToScreen(vp, pts[i][0], pts[i][1]);
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Draw the 6 store points as bold square markers with numbers
  for (let i = 0; i < pts.length; i++) {
    const [px, py] = worldToScreen(vp, pts[i][0], pts[i][1]);
    const sz = 18;
    ctx.fillStyle = THEME.colors.ink;
    ctx.fillRect(px - sz / 2 + 2, py - sz / 2 + 2, sz, sz);
    ctx.fillStyle = THEME.colors.contrast;
    ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    ctx.strokeStyle = THEME.colors.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);

    ctx.fillStyle = THEME.colors.ink;
    ctx.font = `800 11px ${THEME.typography.face}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`P${i + 1}`, px, py + 1);
  }

  ctx.restore();
}

export function drawFixedMarkers(
  ctx: CanvasRenderingContext2D,
  vp: PlotViewport,
  markers: FixedMarker[]
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.padLeft, vp.padTop, vp.plotW, vp.plotH);
  ctx.clip();

  for (const m of markers) {
    const [sx, sy] = worldToScreen(vp, m.point[0], m.point[1]);

    if (m.kind === "star") {
      // True rule ★ black (3, 4) -> offset tag lower-right
      drawStar(ctx, sx, sy, 9, THEME.colors.ink, THEME.colors.emphasis);
      drawTag(ctx, m.label, sx + 48, sy + 18, THEME.colors.contrast);
    } else if (m.kind === "square") {
      // Least squares ■ red (2.59, 4.65) -> offset tag upper-left
      const sz = 14;
      ctx.fillStyle = THEME.colors.ink;
      ctx.fillRect(sx - sz / 2 + 2, sy - sz / 2 + 2, sz, sz);
      ctx.fillStyle = THEME.colors.signal;
      ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
      ctx.strokeStyle = THEME.colors.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - sz / 2, sy - sz / 2, sz, sz);
      drawTag(ctx, m.label, sx - 56, sy - 20, THEME.colors.contrast);
    } else if (m.kind === "diamond") {
      // Robust fit ◆ violet (2.85, 4.14) -> offset tag lower-left
      drawDiamond(ctx, sx, sy, 9, THEME.colors.field);
      drawTag(ctx, m.label, sx - 64, sy + 20, THEME.colors.field);
    }
  }

  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  fill: string,
  stroke: string
) {
  const innerR = outerR * 0.45;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawNotABowlLegendChip(
  ctx: CanvasRenderingContext2D,
  vp: PlotViewport
) {
  const x = vp.padLeft + 10;
  const y = vp.padTop + 10;
  const w = 128;
  const h = 24;

  ctx.save();
  ctx.fillStyle = THEME.colors.ink;
  ctx.fillRect(x + 2, y + 2, w, h);

  ctx.fillStyle = THEME.colors.contrast;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Hatch swatch
  const sx = x + 6;
  const sy = y + 5;
  const sw = 14;
  const sh = 14;
  ctx.strokeStyle = THEME.colors.signal;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy + sh);
  ctx.lineTo(sx + sw, sy);
  ctx.moveTo(sx, sy + sh / 2);
  ctx.lineTo(sx + sw / 2, sy);
  ctx.moveTo(sx + sw / 2, sy + sh);
  ctx.lineTo(sx + sw, sy + sh / 2);
  ctx.stroke();
  ctx.strokeStyle = THEME.colors.ink;
  ctx.strokeRect(sx, sy, sw, sh);

  ctx.fillStyle = THEME.colors.ink;
  ctx.font = `800 11px ${THEME.typography.face}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("NOT A BOWL", sx + sw + 7, y + h / 2 + 1);
  ctx.restore();
}

export function drawTrail(
  ctx: CanvasRenderingContext2D,
  vp: PlotViewport,
  preset: PresetConfig,
  methodId: MethodId,
  points: Vec[]
) {
  if (points.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.padLeft, vp.padTop, vp.plotW, vp.plotH);
  ctx.clip();

  const screenPts = points.map((pt) => {
    const wy = preset.view === "curve" ? preset.f(pt) : pt[1];
    return worldToScreen(vp, pt[0], wy);
  });

  if (methodId === "gd") {
    // Solid 3px red with 1px black edges -> draw 5px black then 3px red
    ctx.strokeStyle = THEME.colors.ink;
    ctx.lineWidth = 5;
    strokePolyline(ctx, screenPts);

    ctx.strokeStyle = THEME.colors.signal;
    ctx.lineWidth = 3;
    strokePolyline(ctx, screenPts);
  } else if (methodId === "momentum") {
    // Dashed 3px black
    ctx.strokeStyle = THEME.colors.ink;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    strokePolyline(ctx, screenPts);
    ctx.setLineDash([]);
  } else if (methodId === "nesterov" || methodId === "alg1") {
    // Solid 3px black
    ctx.strokeStyle = THEME.colors.ink;
    ctx.lineWidth = 3;
    strokePolyline(ctx, screenPts);
  } else if (methodId === "alg3") {
    // Dashed 3px red (with subtle black under-dash for contrast on light/dark bands)
    ctx.strokeStyle = THEME.colors.ink;
    ctx.lineWidth = 5;
    ctx.setLineDash([8, 5]);
    strokePolyline(ctx, screenPts);

    ctx.strokeStyle = THEME.colors.signal;
    ctx.lineWidth = 3;
    strokePolyline(ctx, screenPts);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>
) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  vp: PlotViewport,
  preset: PresetConfig,
  methodId: MethodId,
  pos: Vec,
  offsetPx: [number, number] = [0, 0]
) {
  const wy = preset.view === "curve" ? preset.f(pos) : pos[1];
  const [rawX, rawY] = worldToScreen(vp, pos[0], wy);
  const sx = rawX + offsetPx[0];
  const sy = rawY + offsetPx[1];

  // Clamp inside viewport check
  if (
    sx < vp.padLeft - 20 ||
    sx > vp.padLeft + vp.plotW + 20 ||
    sy < vp.padTop - 20 ||
    sy > vp.padTop + vp.plotH + 20
  ) {
    return;
  }

  const r = 12; // 24px diameter (within 22-28px spec)
  let fill: string = THEME.colors.ink;
  let textFill: string = THEME.colors.emphasis;
  let letter = "1";

  if (methodId === "gd") {
    fill = THEME.colors.signal;
    textFill = THEME.colors.ink;
    letter = "G";
  } else if (methodId === "momentum") {
    fill = THEME.colors.contrast;
    textFill = THEME.colors.ink;
    letter = "M";
  } else if (methodId === "nesterov") {
    fill = THEME.colors.ink;
    textFill = THEME.colors.emphasis;
    letter = "N";
  } else if (methodId === "alg1") {
    fill = THEME.colors.ink;
    textFill = THEME.colors.emphasis;
    letter = "1";
  } else if (methodId === "alg3") {
    fill = THEME.colors.signal;
    textFill = THEME.colors.ink;
    letter = "3";
  }

  ctx.save();
  // Hard offset shadow (black disc offset 3px, no blur)
  ctx.beginPath();
  ctx.arc(sx + 3, sy + 3, r, 0, Math.PI * 2);
  ctx.fillStyle = THEME.colors.ink;
  ctx.fill();

  // Circle body with 3px black outline
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = THEME.colors.ink;
  ctx.stroke();

  // Letter inside
  ctx.fillStyle = textFill;
  ctx.font = `800 12px ${THEME.typography.face}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, sx, sy + 1);
  ctx.restore();
}

export function drawWitnessPair(
  ctx: CanvasRenderingContext2D,
  vp: PlotViewport,
  preset: PresetConfig,
  u: Vec,
  v: Vec
) {
  const uy = preset.view === "curve" ? preset.f(u) : u[1];
  const vy = preset.view === "curve" ? preset.f(v) : v[1];
  const [ux, usy] = worldToScreen(vp, u[0], uy);
  const [vx, vsy] = worldToScreen(vp, v[0], vy);

  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.padLeft, vp.padTop, vp.plotW, vp.plotH);
  ctx.clip();

  // Thick dashed black segment joining U and V
  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 4;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(ux, usy);
  ctx.lineTo(vx, vsy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Square labels U and V (white fill, 2px border), clamped inside viewport
  const clampX = (x: number) =>
    Math.max(vp.padLeft + 18, Math.min(vp.padLeft + vp.plotW - 18, x));
  const clampY = (y: number) =>
    Math.max(vp.padTop + 16, Math.min(vp.padTop + vp.plotH - 16, y));

  drawTag(ctx, "U", clampX(ux + 24), clampY(usy - 18), THEME.colors.contrast);
  drawTag(ctx, "V", clampX(vx + 22), clampY(vsy - 14), THEME.colors.contrast);
  ctx.restore();
}

export function drawEscapeArrow(
  ctx: CanvasRenderingContext2D,
  vp: PlotViewport,
  preset: PresetConfig,
  u: Vec,
  target: Vec
) {
  const uy = preset.view === "curve" ? preset.f(u) : u[1];
  const ty = preset.view === "curve" ? preset.f(target) : target[1];
  const [ux, usy] = worldToScreen(vp, u[0], uy);
  const [tx, tsy] = worldToScreen(vp, target[0], ty);

  const dx = tx - ux;
  const dy = tsy - usy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  // Ensure the arrow is visually clear on screen (at least 48px long)
  const drawLen = Math.max(len, 52);
  const ex = ux + (dx / len) * drawLen;
  const ey = usy + (dy / len) * drawLen;

  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.padLeft, vp.padTop, vp.plotW, vp.plotH);
  ctx.clip();

  const angle = Math.atan2(ey - usy, ex - ux);

  // Black outline shaft
  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(ux, usy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Violet inner shaft
  ctx.strokeStyle = THEME.colors.field;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ux, usy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Arrowhead
  const headLen = 13;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(
    ex - headLen * Math.cos(angle - Math.PI / 6),
    ey - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    ex - headLen * Math.cos(angle + Math.PI / 6),
    ey - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = THEME.colors.field;
  ctx.fill();
  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawTag(ctx, "ESCAPED ↗", ex + 46, ey - 16, THEME.colors.field);

  ctx.restore();
}

export function drawFlewOffTile(
  ctx: CanvasRenderingContext2D,
  vp: PlotViewport,
  flewOffX: number
) {
  const text = `FLEW OFF → X = ${flewOffX.toFixed(1)}`;
  ctx.save();
  ctx.font = `800 13px ${THEME.typography.face}`;
  const m = ctx.measureText(text);
  const boxW = Math.ceil(m.width) + 24;
  const boxH = 36;
  const bx = vp.padLeft + vp.plotW - boxW - 14;
  const by = vp.padTop + Math.round(vp.plotH * 0.35);

  ctx.fillStyle = THEME.colors.ink;
  ctx.fillRect(bx + 4, by + 4, boxW, boxH);

  ctx.fillStyle = THEME.colors.signal;
  ctx.fillRect(bx, by, boxW, boxH);

  ctx.strokeStyle = THEME.colors.ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, boxW, boxH);

  ctx.fillStyle = THEME.colors.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, bx + boxW / 2, by + boxH / 2 + 1);
  ctx.restore();
}
