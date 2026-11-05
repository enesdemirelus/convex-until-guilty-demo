/**
 * 1-D (scalar as length-1 array) and 2-D vector helpers in float64.
 */

export type Vec = readonly number[];

export function add(a: Vec, b: Vec): Vec {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

export function sub(a: Vec, b: Vec): Vec {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

export function scale(a: Vec, s: number): Vec {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * s;
  return out;
}

export function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function normSq(a: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return s;
}

export function norm(a: Vec): number {
  return Math.sqrt(normSq(a));
}

export function dist(a: Vec, b: Vec): number {
  return norm(sub(a, b));
}

export function clone(a: Vec): Vec {
  return a.slice();
}
