/**
 * 专项回归：通关后点「下一关」进入新关，广告提示 / 广告洗牌按钮必须可用。
 *
 * 历史 bug：canRequestMergeHint / canRequestBoardShuffle 依赖 state.levelStaminaSpent，
 * 而「下一关」路径（nextLevel → resetGame）不结算体力、该标记为 false，
 * 导致新关开局操作期两个广告按钮被锁死（从主页进关却正常，表现不一致）。
 *
 * 同时校验：重开本局不会重复扣体力（restartLevel 保留已付标记）。
 *
 * 用法：
 *   NODE_PATH="C:/Users/MC/.workbuddy/binaries/node/workspace/node_modules" \
 *     node tools/verify/verify-next-level-ad-buttons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire("C:/Users/MC/.workbuddy/binaries/node/workspace/");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const html = read("index.html");
const safeArea = read("safe-area.js");
const appJs = read("app.js");

const failures = [];
const runtimeErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => runtimeErrors.push(`jsdomError: ${e.message}`));
virtualConsole.on("error", (...a) => runtimeErrors.push(`error: ${a.map(String).join(" ")}`));

const dom = new JSDOM(html, {
  url: "http://127.0.0.1:5173/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole,
});
const win = dom.window;
const doc = win.document;
win.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
if (win.HTMLMediaElement) {
  win.HTMLMediaElement.prototype.play = () => Promise.resolve();
  win.HTMLMediaElement.prototype.pause = () => {};
}
const inject = (src) => {
  const s = doc.createElement("script");
  s.textContent = src;
  doc.body.appendChild(s);
};
const ev = (code) => win.eval(code);

function check(name, cond, detail = "") {
  if (cond) console.log(`  通过  ${name}`);
  else { failures.push(name); console.log(`  失败  ${name}${detail ? "  " + detail : ""}`); }
}
const btn = (id) => doc.getElementById(id);
const hintDisabled = () => btn("mergeHintBtn").disabled;
const shuffleDisabled = () => btn("boardShuffleBtn").disabled;

inject(safeArea);
inject(appJs);

console.log("=== 通关后「下一关」广告按钮可用性 ===");
check("脚本无启动期异常", runtimeErrors.length === 0, runtimeErrors.slice(0, 2).join(" | "));

/* ---------- 场景 1：从主页进关（对照组） ---------- */
ev("state.stamina = 60;");
ev("startLevelFromHome();");
check("主页进关后进入战斗界面", ev("currentView") === "battle", `currentView=${ev("currentView")}`);
check("主页进关后阶段为 setup", ev("state.phase") === "setup");
check("对照组：广告提示按钮可用", hintDisabled() === false);
check("对照组：广告洗牌按钮可用", shuffleDisabled() === false);
const staminaAfterEnter = ev("state.stamina");
check("主页进关已扣体力", staminaAfterEnter === 50, `stamina=${staminaAfterEnter}`);

/* ---------- 场景 2：通关后点「下一关」（bug 场景） ---------- */
const levelBefore = ev("state.level");
ev("nextLevel();");
check("已推进到下一关", ev("state.level") === levelBefore + 1, `level=${ev("state.level")}`);
check("新关阶段为 setup", ev("state.phase") === "setup");
check("新关操作期未处于结算中", ev("state.resolving") === false);
check("新关次数已重置（提示）", ev("state.mergeHintsUsed") === 0);
check("新关次数已重置（洗牌）", ev("state.boardShufflesUsed") === 0);
check("新关广告残留态已清空", ev("!state.hintAd && !state.adPlayback && !state.hintIndices.length"));
// 核心断言：即使 levelStaminaSpent 尚未结算（体力到第一次出怪才扣），按钮也必须可用
check("【核心】下一关后广告提示按钮可用", hintDisabled() === false,
  `disabled=${hintDisabled()} levelStaminaSpent=${ev("state.levelStaminaSpent")}`);
check("【核心】下一关后广告洗牌按钮可用", shuffleDisabled() === false,
  `disabled=${shuffleDisabled()} levelStaminaSpent=${ev("state.levelStaminaSpent")}`);
check("次数显示已刷新为满额", btn("mergeHintCount").textContent.startsWith("5/5")
  && btn("boardShuffleCount").textContent.startsWith("3/3"),
  `${btn("mergeHintCount").textContent} / ${btn("boardShuffleCount").textContent}`);

/* ---------- 场景 3：重开本局不重复扣体力 ---------- */
console.log("\n=== 重开本局 ===");
// 先把关卡/解锁状态恢复成一个可正常进关的干净局面（上一步 nextLevel 把 level 推高了）
ev("state.level = 1; state.selectedLevel = 1;");
ev("state.highestUnlockedLevel = Math.max(state.highestUnlockedLevel || 1, 1);");
ev("state.stamina = 60; startLevelFromHome();");
const staminaPaid = ev("state.stamina");           // 已扣 10
check("重开场景：进关已扣体力且标记已置位",
  staminaPaid === 50 && ev("state.levelStaminaSpent") === true,
  `stamina=${staminaPaid} spent=${ev("state.levelStaminaSpent")}`);
ev("restartLevel();");
check("重开后保留已付体力标记", ev("state.levelStaminaSpent") === true);
ev("startWave();");
const staminaAfterWave = ev("state.stamina");
check("重开后出怪不再重复扣体力", staminaAfterWave === staminaPaid,
  `重开前=${staminaPaid} 出怪后=${staminaAfterWave}`);
ev("stopLoop();");

console.log(failures.length ? `\n结论：${failures.length} 项失败` : "\n结论：全部通过");
process.exit(failures.length ? 1 : 0);
