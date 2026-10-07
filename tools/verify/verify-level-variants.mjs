// 一次性校验：从 app.js 抽取差异化数据层并真跑，验证关卡不变量。
// 用法：node tools/verify/verify-level-variants.mjs
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
const start = src.indexOf("const TRAIT_CARD_BIAS = {");
const end = src.indexOf("const LEVEL_WAVE_PROFILES");
if (start < 0 || end < 0) { console.error("FAIL: 找不到抽取区间"); process.exit(1); }
const block = src.slice(start, end);

// 仅注入差异逻辑依赖的最小环境
const RESIST = { columnArmor: "col", colTutorial: "col", rowArmor: "row", rowTutorial: "row" };
const MONSTER_TRAITS = Object.fromEntries(
  Object.entries(RESIST).map(([k, v]) => [k, { resistAxis: v }])
);
let CHALLENGE_FLAG = false;
const isChallengeMode = () => CHALLENGE_FLAG;

const sandbox = { MONSTER_TRAITS, isChallengeMode, get isChallengeMode() { return isChallengeMode; } };
const factory = new Function("MONSTER_TRAITS", "isChallengeMode", block + "\nreturn { LEVEL_MODIFIERS, NORMAL_CYCLE, CHALLENGE_BOARD_LAYOUTS, normalModifierForLevel, enrichChallenge, getStageModifier };");
const M = factory(MONSTER_TRAITS, isChallengeMode);

let problems = [];
const seen = { twoAxis: [], dup: [], badCol: [], singleBoardMismatch: [] };

function hasTwoAxes(traits) {
  const axes = new Set(traits.map((t) => RESIST[t]).filter(Boolean));
  return axes.size >= 2;
}
function hasDup(traits) {
  return new Set(traits).size !== traits.length;
}
function colsOk(board) {
  if (!board) return true;
  for (const k of ["hazardColumn", "blessedColumn"]) {
    if (board[k] != null && (board[k] < 0 || board[k] > 5)) return false;
  }
  return true;
}

const MAX = 200;
for (let lv = 1; lv <= MAX; lv++) {
  CHALLENGE_FLAG = false;
  const n = M.getStageModifier(lv);
  const nt = n.monsterTraits || [];
  if (hasTwoAxes(nt)) seen.twoAxis.push(`L${lv}(normal)`);
  if (hasDup(nt)) seen.dup.push(`L${lv}(normal)`);
  if (!colsOk(n.board)) seen.badCol.push(`L${lv}(normal)`);

  CHALLENGE_FLAG = true;
  const c = M.getStageModifier(lv);
  const ct = c.monsterTraits || [];
  if (hasTwoAxes(ct)) seen.twoAxis.push(`L${lv}(challenge)`);
  if (hasDup(ct)) seen.dup.push(`L${lv}(challenge)`);
  if (!colsOk(c.board)) seen.badCol.push(`L${lv}(challenge)`);

  // 新梯度规则：挑战关只叠特性(无双棋盘) ⇔ 普通关是复合关(≥2特性) 或 level%6===0
  const baseIsComposite = (M.normalModifierForLevel(lv).monsterTraits || []).length >= 2;
  const expectedSingle = baseIsComposite || lv % 6 === 0;
  const chalHasDoubleBoard = c.board && c.board.hazardColumn != null && c.board.blessedColumn != null;
  const chalSingleBoard = !chalHasDoubleBoard;
  if (chalSingleBoard !== expectedSingle) {
    seen.singleBoardMismatch.push(`L${lv} expectedSingle=${expectedSingle} chalSingle=${chalSingleBoard}`);
  }
  // 双棋盘的列位必须不同（险恶列≠增益列）
  if (chalHasDoubleBoard && c.board.hazardColumn === c.board.blessedColumn) {
    seen.badCol.push(`L${lv}(challenge) 双棋盘同列`);
  }
}

// 统计挑战关只叠特性的比例
let singleCount = 0, chalTotal = 0;
for (let lv = 1; lv <= MAX; lv++) {
  CHALLENGE_FLAG = true;
  const c = M.getStageModifier(lv);
  chalTotal++;
  const dbl = c.board && c.board.hazardColumn != null && c.board.blessedColumn != null;
  if (!dbl) singleCount++;
}

if (seen.twoAxis.length || seen.dup.length || seen.badCol.length || seen.singleBoardMismatch.length) {
  console.log("PROBLEMS FOUND:");
  console.log("  twoAxis:", seen.twoAxis);
  console.log("  dup:", seen.dup);
  console.log("  badCol:", seen.badCol);
  console.log("  singleBoardMismatch:", seen.singleBoardMismatch);
  process.exit(1);
} else {
  console.log(`INVARIANTS OK (levels 1-${MAX})`);
  console.log(`  挑战关只叠特性(不叠双棋盘)比例: ${singleCount}/${chalTotal} = ${(singleCount / chalTotal * 100).toFixed(1)}%`);
  console.log(`  普通复合关(≥2特性)出现在每 16 步循环的第 4/8/12/16 位 → 挑战梯度锚定在这些关`);
  process.exit(0);
}
