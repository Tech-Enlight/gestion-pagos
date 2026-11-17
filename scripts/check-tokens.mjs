// Guarda contra el desfase de colores: `src/index.css` (:root) es la fuente única; `T` en
// `src/components/decision/tokens.ts` repite algunos valores en hex/rgba porque necesita concatenarles alpha
// (`${T.jade}40`), cosa que var(--x) no permite. Este chequeo falla si alguno de los dos cambia sin el otro.
// Uso: npm run check:tokens
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "src/index.css"), "utf8");
const ts = fs.readFileSync(path.join(root, "src/components/decision/tokens.ts"), "utf8");

const cssVar = (name) => {
  const m = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`Falta --${name} en index.css`);
  return m[1].trim();
};
const tsKey = (key) => {
  const m = new RegExp(`\\b${key}:\\s*"([^"]+)"`).exec(ts);
  if (!m) throw new Error(`Falta T.${key} en tokens.ts`);
  return m[1].trim();
};
// "#00aa85" / "rgba(255, 255, 255, .60)" / "rgba(255,255,255,0.6)" → forma comparable
const norm = (v) => {
  const s = v.toLowerCase().replace(/\s+/g, "");
  const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(s);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},${Number(m[4])})` : s;
};

// T.<clave> ↔ variable de index.css
const PAIRS = [
  ["jade", "enl-jade"], ["steel", "enl-cerceta"], ["ink", "enl-acero"], ["pageBg", "enl-marino"],
  ["panelBg", "surface-panel"], ["modalBg", "surface-modal"], ["red", "signal-red"], ["amber", "signal-amber"],
  ["text", "wa-90"], ["textSub", "wa-70"], ["textMuted", "wa-60"], ["cardBorder", "wa-08"], ["cardBg", "wa-04"],
];

let bad = 0;
for (const [key, name] of PAIRS) {
  const a = norm(tsKey(key));
  const b = norm(cssVar(name));
  const ok = a === b;
  if (!ok) bad++;
  console.log(`${ok ? "OK   " : "DIFIERE"} T.${key.padEnd(10)} ${a.padEnd(26)} --${name.padEnd(14)} ${b}`);
}
if (bad) {
  console.error(`\n${bad} token(s) desfasados entre tokens.ts y index.css. Corrige uno para que coincida con el otro.`);
  process.exit(1);
}
console.log("\nTokens sincronizados.");
