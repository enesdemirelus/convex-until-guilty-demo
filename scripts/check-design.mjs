#!/usr/bin/env node
// Enforces the hard rules of DESIGN.md section 8 on the app's UI code.
// Usage (from demo/web): node ../scripts/check-design.mjs
// Exits 1 and lists file:line for every violation.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const demo = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const web = join(demo, "web");
const roots = ["app", "components", "lib"].map((d) => join(web, d));
const exts = [".ts", ".tsx", ".css", ".js", ".jsx", ".mjs"];

// The only files allowed to hold color literals.
const colorFiles = new Set(["app/tokens.css", "lib/theme.ts"]);
// Math code has no UI.
const skipDirs = ["lib/math"];

// `when` limits a rule to lines that look like class lists, to avoid flagging prose.
const isClassLine = (line) => /class(Name)?\s*=|clsx\(|cn\(|cva\(/.test(line);
const rules = [
  { name: "gradient", re: /(linear|radial|conic)-gradient\(|create(Linear|Radial|Conic)Gradient|\bbg-gradient-/ },
  { name: "blur", re: /\bblur\(|backdrop-filter|backdrop-blur|\bshadowBlur\s*=(?!\s*0\b)/ },
  { name: "rounded corners", re: /border-radius\s*:(?!\s*0(px)?\s*(;|}|"|'|`|$))|borderRadius\s*:(?!\s*["'`]?0(px)?\b)/ },
  { name: "rounded corners", re: /(^|[\s"'`])rounded(?!-none\b)(-[\w[\]./]+)?(?=[\s"'`]|$)/, when: isClassLine },
  { name: "soft shadow", re: /(^|[\s"'`])shadow(-(sm|md|lg|xl|2xl|inner))?(?=[\s"'`]|$)/, when: isClassLine },
  { name: "soft shadow", re: /box-shadow\s*:[^;]*-?\d+(px)?\s+-?\d+(px)?\s+[1-9]\d*(px)?/ },
  { name: "glass / glow", re: /\bbackdrop-|\bdrop-shadow|text-shadow\s*:[^;]*[1-9]\d*px\s*[^;]*[1-9]/ },
];
const colorRule = { name: "color literal outside tokens", re: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/ };

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "node_modules" && !name.startsWith(".")) walk(path, out);
    } else if (exts.some((e) => name.endsWith(e))) {
      out.push(path);
    }
  }
  return out;
}

const violations = [];
for (const file of roots.flatMap((r) => walk(r))) {
  const rel = relative(web, file).split(sep).join("/");
  if (skipDirs.some((d) => rel.startsWith(d + "/"))) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/design-check-ignore/.test(line)) return;
    for (const rule of rules) {
      if (rule.when && !rule.when(line)) continue;
      if (rule.re.test(line)) violations.push(`${rel}:${i + 1}  ${rule.name}: ${line.trim()}`);
    }
    if (!colorFiles.has(rel) && colorRule.re.test(line)) {
      violations.push(`${rel}:${i + 1}  ${colorRule.name}: ${line.trim()}`);
    }
  });
}

if (violations.length) {
  console.error(`check:design failed with ${violations.length} violation(s) (see DESIGN.md section 8):\n`);
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("check:design passed");
