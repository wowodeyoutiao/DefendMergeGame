/**
 * 静态扫描：找 app.js 里"调用了但没定义"的函数、已删除符号的残留引用、
 * 以及 index.html 与 app.js 之间不通的 DOM 引用。
 *
 * 先做一次迷你词法剥离：注释与字符串（含模板字面量的字面量部分）置空，
 * 但保留模板里 ${...} 中的真实表达式——否则 CSS transform 的 "scale(...)"
 * 会污染调用列表，而 `${getEquipmentIcon(...)}` 里的真调用会被漏掉。
 *
 * 用法：node tools/verify/static-scan.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

/* ---------- 迷你词法器：把字符串 / 注释里的内容替换成空格 ---------- */
function stripLiterals(src) {
  const out = new Array(src.length);
  let i = 0;
  const frames = [];   // 每层未闭合的模板字面量：{ expr: 是否正处于 ${ } 中, depth: ${ } 内的花括号深度 }
  let mode = "code";
  const blank = (index) => { out[index] = src[index] === "\n" ? "\n" : " "; };
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    const top = frames[frames.length - 1];

    if (mode === "code") {
      if (top && top.expr) {
        if (c === "{") { top.depth += 1; out[i] = c; i += 1; continue; }
        if (c === "}") {
          if (top.depth > 0) { top.depth -= 1; out[i] = c; i += 1; continue; }
          top.expr = false; mode = "tpl"; out[i] = c; i += 1; continue;
        }
      }
      if (c === "/" && d === "/") { mode = "line"; blank(i); blank(i + 1); i += 2; continue; }
      if (c === "/" && d === "*") { mode = "block"; blank(i); blank(i + 1); i += 2; continue; }
      if (c === "'" ) { mode = "sq"; blank(i); i += 1; continue; }
      if (c === '"') { mode = "dq"; blank(i); i += 1; continue; }
      if (c === "`") { frames.push({ expr: false, depth: 0 }); mode = "tpl"; blank(i); i += 1; continue; }
      out[i] = c; i += 1; continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; out[i] = "\n"; i += 1; continue; }
      blank(i); i += 1; continue;
    }
    if (mode === "block") {
      if (c === "*" && d === "/") { mode = "code"; blank(i); blank(i + 1); i += 2; continue; }
      blank(i); i += 1; continue;
    }
    if (mode === "sq" || mode === "dq") {
      if (c === "\\") { blank(i); blank(i + 1); i += 2; continue; }
      if ((mode === "sq" && c === "'") || (mode === "dq" && c === '"')) { mode = "code"; blank(i); i += 1; continue; }
      blank(i); i += 1; continue;
    }
    if (mode === "tpl") {
      if (c === "\\") { blank(i); blank(i + 1); i += 2; continue; }
      if (c === "`") { frames.pop(); mode = "code"; blank(i); i += 1; continue; }
      if (c === "$" && d === "{") { top.expr = true; top.depth = 0; mode = "code"; blank(i); blank(i + 1); i += 2; continue; }
      blank(i); i += 1; continue;
    }
  }
  return out.join("");
}

const code = stripLiterals(appJs);
const lineOf = (index) => code.slice(0, index).split("\n").length;

/* ---------- 1. 收集定义 ---------- */
const defined = new Set();
for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
for (const m of code.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
for (const m of code.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) defined.add(m[1]);
for (const m of code.matchAll(/^\s*const\s*\{([^}]*)\}\s*=/gm)) {
  m[1].split(",").forEach((part) => {
    const name = part.split(":").pop().trim().replace(/=.*$/, "").trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name);
  });
}
for (const m of code.matchAll(/^\s*const\s*\[([^\]]*)\]\s*=/gm)) {
  m[1].split(",").forEach((part) => {
    const name = part.trim().replace(/=.*$/, "").trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name);
  });
}
/* 形参：function 签名 / 箭头函数 / 回调（含解构与默认值） */
function collectParams(sig) {
  sig.split(",").forEach((part) => {
    const name = part.split(":").pop().split("=")[0].replace(/[{}\[\]\s.]/g, "").replace(/^\.\.\./, "").trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name);
  });
}
for (const m of code.matchAll(/\bfunction\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/g)) collectParams(m[1]);
for (const m of code.matchAll(/\(([^)]*)\)\s*=>/g)) collectParams(m[1]);
for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*=>/g)) defined.add(m[1]);
for (const m of code.matchAll(/\bcatch\s*\(([^)]*)\)/g)) collectParams(m[1]);
/* 对象字面量里的方法简写 */
for (const m of code.matchAll(/^\s{2,}([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) defined.add(m[1]);
/* 对象字面量里的 `key: value` 形式属性（供 `{ name: fn }` 引用）不需要，跳过 */

/* ---------- 2. 收集调用 ---------- */
const KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "function", "return", "typeof", "new", "do", "else",
  "await", "delete", "void", "in", "of", "case", "throw", "yield", "super", "with", "instanceof",
]);
const BUILTINS = new Set([
  "parseInt", "parseFloat", "isNaN", "isFinite", "Number", "String", "Boolean", "Array", "Object",
  "Math", "JSON", "Date", "Map", "Set", "WeakMap", "WeakSet", "Promise", "Error", "RegExp", "Symbol",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
  "cancelAnimationFrame", "alert", "confirm", "prompt", "fetch", "encodeURIComponent",
  "decodeURIComponent", "structuredClone", "queueMicrotask", "performance", "Function", "URL",
  "matchMedia", "getComputedStyle", "Image", "Audio", "localStorage", "BigInt", "Proxy", "Reflect",
  "IntersectionObserver", "ResizeObserver", "MutationObserver", "CustomEvent", "Event",
]);

const missing = new Map();
for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
  const name = m[1];
  if (KEYWORDS.has(name) || BUILTINS.has(name) || defined.has(name)) continue;
  if (!missing.has(name)) missing.set(name, lineOf(m.index));
}

/* ---------- 3. 已删除符号的残留 ---------- */
const REMOVED = [
  ["EQUIPMENT_ICONS", "已改为 getEquipmentIcon"],
  ["fallDistance", "已改为 riseDistance"],
  ["fallToVacancy", "已改为 riseToVacancy"],
  ["--fall-distance", "已改为 --rise-distance"],
  ["piece.falling", "旧下落标记，已改为 rising"],
];

/* ---------- 输出 ---------- */
const problems = [];
[...missing.entries()].sort((a, b) => a[1] - b[1]).forEach(([name, line]) => {
  problems.push(`app.js:${line} 调用了未定义的 ${name}()`);
});
REMOVED.forEach(([symbol, hint]) => {
  for (const m of appJs.matchAll(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))) {
    problems.push(`app.js:${lineOf(m.index)} 残留已删除符号 ${symbol}（${hint}）`);
  }
});

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const jsIds = new Set();
for (const m of appJs.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)) jsIds.add(m[1]);
for (const m of appJs.matchAll(/\b(?:querySelector|querySelectorAll)\(\s*["']#([A-Za-z_$][\w$-]*)["']/g)) jsIds.add(m[1]);
jsIds.forEach((id) => { if (!htmlIds.has(id)) problems.push(`app.js 引用了 index.html 里不存在的 #${id}`); });

/* ---------- 4. JS 里挂的类名 / CSS 里的关键帧是否对得上 ---------- */
const css = ["styles.css", "theme.css"].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const keyframes = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
/* CSS 里 animation / animation-name 引用的关键帧必须存在 */
for (const m of css.matchAll(/animation(?:-name)?\s*:\s*([^;{}]+)/g)) {
  m[1].split(",").forEach((part) => {
    const name = part.trim().split(/\s+/)[0];
    if (!name || /^(none|inherit|initial|unset)$/.test(name)) return;
    if (/^[\d.]/.test(name)) return; /* 纯时长写法，跳过 */
    if (!keyframes.has(name) && !/^(ease|linear|cubic-bezier|steps|infinite|alternate|forwards|backwards|both|running|paused)$/.test(name)) {
      problems.push(`${"styles/theme"}.css 引用了不存在的关键帧 ${name}`);
    }
  });
}
/* JS 里 classList.add/toggle 挂的类名必须在 CSS 里有对应规则 */
const jsClasses = new Set();
for (const m of appJs.matchAll(/classList\.(?:add|toggle|remove)\(\s*["']([\w-]+)["']/g)) jsClasses.add(m[1]);
const missingRows = [];
jsClasses.forEach((name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`\\.${escaped}(?![\\w-])`).test(css)) missingRows.push(name);
});
if (missingRows.length) problems.push(`app.js 挂了 CSS 里没有样式规则的类：${missingRows.join("、")}`);

console.log("=== 静态扫描 ===");
console.log(`  索引  剥离后代码 ${code.length} 字符；已识别定义 ${defined.size} 个；index.html id ${htmlIds.size} 个，app.js 引用其中 ${[...jsIds].filter((id) => htmlIds.has(id)).length} 个`);

/* state 初始键 vs 实际读取 */
const stateBlock = appJs.match(/const state = \{[\s\S]*?\n\};/);
if (!stateBlock) {
  problems.push("未找到 state 初始定义");
} else {
  const initKeys = new Set([...stateBlock[0].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]));
  const readKeys = new Map();
  for (const m of code.matchAll(/(?<![.\w$])state\.([A-Za-z_$][\w$]*)/g)) {
    if (!readKeys.has(m[1])) readKeys.set(m[1], lineOf(m.index));
  }
  const uninit = [...readKeys.entries()].filter(([key]) => !initKeys.has(key));
  if (uninit.length) {
    console.log(`\n  state 读取到但初始定义里没有的字段（共 ${uninit.length} 个，需确认是否由迁移逻辑补上）：`);
    uninit.forEach(([key, line]) => console.log(`    - state.${key}  首次读取 app.js:${line}`));
  }
}

console.log("");
if (problems.length) {
  console.log(`发现 ${problems.length} 处问题：`);
  problems.forEach((p) => console.log("  问题  " + p));
} else {
  console.log("符号层面未发现问题。");
}
process.exit(problems.length ? 1 : 0);
