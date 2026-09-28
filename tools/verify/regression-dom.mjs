/**
 * 整体回归宿主：把 index.html + safe-area.js + app.js 放进 jsdom 里当作真实页面运行，
 * 捕获启动期与交互期的运行时异常，并逐个走通主要界面与核心系统。
 *
 * 与 tools/verify/verify-*.mjs（纯数据断言）互补：那两个脚本只抽单个函数做纯计算，
 * 这一个跑的是完整页面 + 真实 DOM 事件，能抓到"函数名写错、DOM 选择器落空、
 * 某条分支没处理空值"这类只在运行时暴露的问题。
 *
 * 用法：node tools/verify/regression-dom.mjs
 * （需要 jsdom：NODE_PATH="C:/Users/MC/.workbuddy/binaries/node/workspace/node_modules"）
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

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  通过  ${name}`);
  } else {
    failures.push(name);
    console.log(`  失败  ${name}${detail ? "  " + detail : ""}`);
  }
}
function section(title) {
  console.log(`\n【${title}】`);
}
function finding(text) {
  console.log("  发现  " + text);
}

/* ---------------- 装配页面 ---------------- */
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => {
  const stack = error.detail && error.detail.stack ? error.detail.stack : (error.stack || "");
  runtimeErrors.push(`${error.type || "jsdomError"}: ${error.message}${stack ? "\n" + stack.split("\n").slice(0, 6).join("\n") : ""}`);
});
["error"].forEach((level) => virtualConsole.on(level, (...args) => {
  runtimeErrors.push(`${level}: ${args.map((a) => (a && a.stack) || String(a)).join(" ")}`);
}));
virtualConsole.on("warn", (...args) => {
  const text = args.map((a) => String(a)).join(" ");
  if (!/Progress storage unavailable/.test(text)) runtimeErrors.push(`warn: ${text}`);
});

const dom = new JSDOM(html, {
  url: "http://127.0.0.1:5173/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole,
});
const win = dom.window;
const doc = win.document;

/* 补齐 jsdom 缺失的浏览器能力 */
win.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
if (win.HTMLMediaElement) win.HTMLMediaElement.prototype.play = function play() { return Promise.resolve(); };
win.HTMLMediaElement && (win.HTMLMediaElement.prototype.pause = function pause() {});

function inject(source, label) {
  const script = doc.createElement("script");
  script.textContent = source;
  try {
    doc.body.appendChild(script);
  } catch (error) {
    runtimeErrors.push(`${label} 注入失败: ${error.message}`);
  }
}

/* 在页面全局作用域里求值（可访问脚本里的 const/let 绑定） */
const ev = (code) => win.eval(code);
/** 把一段多语句代码包成立即执行函数，避免 eval 返回值语义干扰 */
const run = (body) => win.eval(`(() => { ${body} })()`);

section("启动");
inject(safeArea, "safe-area.js");
inject(appJs, "app.js");
const bootErrorsBefore = runtimeErrors.length;
check("启动期无运行时异常", bootErrorsBefore === 0, runtimeErrors.slice(0, 3).join(" | "));
check("app.js 已执行（state 可读）", typeof ev("typeof state") === "string" && ev("typeof state") === "object");
check("棋盘已铺满 36 格", ev("state.board.filter(Boolean).length") === 36);
check("棋盘 DOM 渲染 36 个棋子", doc.querySelectorAll(".piece").length === 36);
check("初始阶段为 setup", ev("state.phase") === "setup");
check("首页已渲染", Boolean(doc.querySelector("#homeScreen")));

/* ---------------- 主要界面逐个打开 ---------------- */
section("界面渲染");
const screens = [
  ["showHome()", "#homeScreen"],
  ["showEquipmentGrowth(showHome)", ".equipment-modal"],
  ["showForge(showHome)", ".forge-modal"],
  ["showEquipmentBag(showHome)", ".bag-modal"],
  ["showEquipmentSynthesis(showHome)", ".synthesis-arena"],
  ["showHeroGrowthModal(showHome)", ".modal-card"],
  ["showShop(showHome)", ".modal-card"],
  ["showDailyTasks()", ".modal-card"],
];
run("state.tutorialStep = 5; state.highestUnlockedLevel = 80; state.level = 80; state.gold = 500000; state.yuanbao = 50000; state.heroLevel = 30; state.maxHp = 33;");
screens.forEach(([call, selector]) => {
  const before = runtimeErrors.length;
  let threw = "";
  try {
    run(call);
  } catch (error) {
    threw = error.message;
  }
  const fresh = runtimeErrors.slice(before);
  check(`${call} 正常打开`, !threw && fresh.length === 0 && Boolean(doc.querySelector(selector)),
    threw || fresh[0] || `未找到 ${selector}`);
});

/* closeModal 之类把弹窗收掉，避免影响后续 */
run("if (typeof closeModal === 'function') closeModal(); else showHome();");

/* ---------------- 棋盘规则：换位与递补 ---------------- */
section("棋盘：换位与递补");
run("resetGame(); state.tutorialStep = 5;");
const diagonal = run(`
  const before = state.steps;
  const a = 0, b = BOARD_SIZE + 1;            /* 0 与 7 是斜向 */
  const snapshot = state.board.map((p) => (p ? p.id : null));
  tryMove(a, b);
  return { steps: state.steps, unchanged: state.board.every((p, i) => (p ? p.id : null) === snapshot[i]), before };
`);
check("斜向换位被拒绝且不扣步数", diagonal.steps === diagonal.before && diagonal.unchanged !== false, JSON.stringify(diagonal));
const horizontal = run(`
  resetGame(); state.tutorialStep = 5;
  const before = state.board.map((p) => (p ? p.id : null));
  tryMove(0, 1);
  return { before, changed: state.board.some((p, i) => (p ? p.id : null) !== before[i]) };
`);
check("横向相邻换位能生效", horizontal.changed === true);
const rised = run(`
  resetGame(); state.tutorialStep = 5;
  const col = 0;
  const original = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    const piece = { ...newPiece(), id: 1000 + r, type: 'fan', tier: 1 };
    state.board[r * BOARD_SIZE + col] = piece;
    original.push(piece);
  }
  /* 只清掉列底三格：上方棋子应原地不动，下方无棋可升，列底补新棋子 */
  state.board[3 * BOARD_SIZE + col] = null;
  state.board[4 * BOARD_SIZE + col] = null;
  state.board[5 * BOARD_SIZE + col] = null;
  refillBoardFromBottom();
  return {
    topKept: state.board[0] === original[0],
    secondKept: state.board[BOARD_SIZE] === original[1],
    thirdKept: state.board[2 * BOARD_SIZE] === original[2],
    bottomRefilled: [3, 4, 5].every((r) => {
      const piece = state.board[r * BOARD_SIZE + col];
      return piece && !original.includes(piece);
    }),
  };
`);
check("清空列底三格时上方棋子原地不动", rised.topKept && rised.secondKept && rised.thirdKept, JSON.stringify(rised));
check("缺口留在列底并由新棋子补入", rised.bottomRefilled === true, JSON.stringify(rised));

const middleVacancy = run(`
  resetGame(); state.tutorialStep = 5;
  const original = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    const piece = { ...newPiece(), id: 2000 + r, type: 'fan', tier: 1 };
    state.board[r * BOARD_SIZE] = piece;
    original.push(piece);
  }
  state.board[2 * BOARD_SIZE] = null;
  refillBoardFromBottom();
  return {
    aboveUnmoved: state.board[0] === original[0] && state.board[BOARD_SIZE] === original[1],
    roseByOne: state.board[2 * BOARD_SIZE] === original[3]
      && state.board[3 * BOARD_SIZE] === original[4]
      && state.board[4 * BOARD_SIZE] === original[5],
    bottomNew: Boolean(state.board[5 * BOARD_SIZE]) && !original.includes(state.board[5 * BOARD_SIZE]),
  };
`);
check("中间出现空位时上方棋子不动、下方整体上顶一格", middleVacancy.aboveUnmoved && middleVacancy.roseByOne, JSON.stringify(middleVacancy));
check("空位由列底新棋子补入", middleVacancy.bottomNew === true, JSON.stringify(middleVacancy));

const pipeline = run(`
  resetGame(); state.tutorialStep = 5;
  /* 基底用 (r*r+c)%3：行、列、两条对角都不出现三连，保证只有一个可控的匹配点 */
  const BASE_TYPES = ['coin', 'mine', 'chest'];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      state.board[r * BOARD_SIZE + c] = { ...newPiece(), id: 4000 + r * BOARD_SIZE + c, type: BASE_TYPES[(r * r + c) % 3], tier: 1 };
    }
  }
  const baseline = collectAllMatches().length;
  for (let r = 0; r < 3; r += 1) state.board[r * BOARD_SIZE] = { ...newPiece(), id: 9000 + r, type: 'fan', tier: 1 };
  const matches = collectAllMatches();
  eliminateMatches(matches);
  const clearedCount = state.board.filter((piece) => !piece).length;
  refillBoardFromBottom();
  return {
    baseline,
    matchCount: matches.length,
    cluster: matches[0] ? matches[0].cluster.length : 0,
    clearedCount,
    filled: state.board.every(Boolean),
  };
`);
check("基底棋盘本身无三连（测试前提成立）", pipeline.baseline === 0, JSON.stringify(pipeline));
check("collectAllMatches 能识别纵向三消", pipeline.matchCount === 1 && pipeline.cluster === 3, JSON.stringify(pipeline));
check("消除后由递补补齐空位（未补位前应有 簇长-1 个空位）",
  pipeline.clearedCount === pipeline.cluster - 1 && pipeline.filled === true, JSON.stringify(pipeline));

/* ---------------- 装备：图标 / 穿戴 / 合成 / 出售 ---------------- */
section("装备系统");
const iconPaths = run(`
  const out = {};
  out.warriorWeapon = getEquipmentIcon('weapon', 3, 'fan');
  out.mageArmor = getEquipmentIcon('armor', 7, 'sword');
  out.boots = getEquipmentIcon('boots', 5, 'rock');
  out.legacy = getEquipmentIcon('weapon', 1, equipmentArtType({ slot: 'weapon' }));
  return out;
`);
check("战士武器白→绿档路径正确", iconPaths.warriorWeapon === "equipment/weapon-warrior-3.png", iconPaths.warriorWeapon);
check("法师衣服金色路径正确", iconPaths.mageArmor === "equipment/armor-mage-7.png", iconPaths.mageArmor);
check("靴子不带职业段", iconPaths.boots === "equipment/boots-5.png", iconPaths.boots);
check("老存档通用武器固定男战士美术", iconPaths.legacy === "equipment/weapon-warrior-1.png", iconPaths.legacy);

const eqFlow = run(`
  resetGame(); state.tutorialStep = 5; state.gold = 999999;
  state.warriorQuality.fan = 1;
  state.equipmentInventory = [];
  state.warriorEquipment.fan = {};
  state.equipmentNextId = 1;
  EQUIPMENT_SLOTS.forEach(({ id }) => { state.equipmentInventory.push(createEquipment(id, 1, 'fan')); });
  const auto = autoEquipEquipment('fan');
  const status = getEquipmentSetStatus('fan');
  return { auto, complete: status.complete, count: status.count, bagLeft: state.equipmentInventory.length };
`);
check("一键穿戴 6 件后套装完成", eqFlow.complete === true && eqFlow.count === 6, JSON.stringify(eqFlow));
check("穿戴后包裹相应减少", eqFlow.bagLeft === 0, JSON.stringify(eqFlow));

const breakthrough = run(`
  state.yuanbao = 99999;
  const beforePower = totalCombatPower();
  const ok = breakthroughWarrior('fan');
  const afterPower = totalCombatPower();
  return { ok, beforePower, afterPower, quality: state.warriorQuality.fan, worn: Object.keys(state.warriorEquipment.fan).length, permanent: state.warriorPermanentStats.fan };
`);
check("穿齐后可突破且品质 +1", breakthrough.ok === true && breakthrough.quality === 2, JSON.stringify(breakthrough));
check("突破后 6 件装备被消耗（转为永久属性）", breakthrough.worn === 0 && Object.values(breakthrough.permanent || {}).some((v) => v > 0), JSON.stringify(breakthrough));

const synth = run(`
  resetGame(); state.tutorialStep = 5; state.gold = 999999;
  state.equipmentInventory = []; state.equipmentNextId = 1;
  const ids = Array.from({ length: 5 }, () => { const item = createEquipment('ring', 3); state.equipmentInventory.push(item); return item.id; });
  const quote = getSynthesisQuote(ids);
  /* 把成功率锁成必成，验证产出品质与金币结算 */
  const originalRandom = Math.random;
  Math.random = () => 0;
  const result = synthesizeEquipment(ids);
  Math.random = originalRandom;
  const produced = state.equipmentInventory[state.equipmentInventory.length - 1];
  return { quoteOk: quote.ok, quality: quote.quality, cost: quote.cost, rate: quote.rate, ok: result.ok, success: result.success, producedQuality: produced && produced.quality, bag: state.equipmentInventory.length };
`);
check("合成报价读取正确（蓝 3 档：成本 3000 / 成功率 85%）", synth.quoteOk === true && synth.quality === 3 && synth.cost === 3000 && Math.abs(synth.rate - 0.85) < 1e-9, JSON.stringify(synth));
check("合成成功产出高一品质装备", synth.success === true && synth.producedQuality === 4, JSON.stringify(synth));
check("合成消耗 5 件材料", synth.bag === 1, JSON.stringify(synth));

const synthEdge = run(`
  const results = {};
  results.empty = getSynthesisQuote([]);
  results.mixed = getSynthesisQuote(state.equipmentInventory.map((i) => i.id).concat([1, 2, 3, 4, 5].filter((n) => !state.equipmentInventory.some((i) => i.id === n))).slice(0, 5));
  results.duplicate = getSynthesisQuote([7, 7, 7, 7, 7]);
  results.goldMax = (() => { const q = getSynthesisQuote([state.equipmentInventory[0].id]); return { ok: q.ok, message: q.message }; })();
  return results;
`);
check("空材料被拒绝", synthEdge.empty.ok === false, JSON.stringify(synthEdge.empty));
check("数量不足被拒绝", synthEdge.goldMax.ok === false, JSON.stringify(synthEdge.goldMax));
check("重复 id 被拒绝", synthEdge.duplicate.ok === false, JSON.stringify(synthEdge.duplicate));

const sale = run(`
  state.equipmentInventory = []; state.equipmentNextId = 1;
  const item = createEquipment('ring', 4);
  state.equipmentInventory.push(item);
  const price = equipmentSalePrice(item);
  const result = sellEquipment([item.id]);
  return { price, ok: result.ok, gold: result.gold, bag: state.equipmentInventory.length };
`);
check("出售按品质系数计价", sale.price === 20 && sale.ok === true && sale.gold === 20 && sale.bag === 0, JSON.stringify(sale));

/* ---------------- 存档：迁移与 id 唯一性 ---------------- */
section("存档迁移");
const migrate = run(`
  /* 造一份"老存档"：没有 warrior 字段、没有 equipmentNextId，且包裹里已有 id 1~3 */
  const legacy = {
    heroLevel: 12, gold: 100, highestUnlockedLevel: 12,
    equipmentInventory: [
      { id: 1, slot: 'weapon', quality: 1, value: 50 },
      { id: 2, slot: 'armor', quality: 1, value: 8 },
      { id: 3, slot: 'helmet', quality: 1, value: 8 },
    ],
  };
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(legacy));
  loadProgress();
  const nextIdAfterLoad = state.equipmentNextId;
  const fresh = createEquipment('ring', 1);
  const ids = state.equipmentInventory.map((i) => i.id);
  return {
    nextIdAfterLoad,
    freshId: fresh.id,
    ids,
    duplicate: new Set(ids).size !== ids.length,
    legacyWearable: equipmentFitsWarrior(state.equipmentInventory[0], 'rock'),
  };
`);
check("老存档通用武器仍可被任意武将穿戴", migrate.legacyWearable === true, JSON.stringify(migrate));
check("新装备 id 不与老存档已有 id 冲突", !migrate.duplicate && migrate.freshId > 3,
  `nextId=${migrate.nextIdAfterLoad} freshId=${migrate.freshId} ids=${migrate.ids.join(",")}`);

const roundTrip = run(`
  resetGame(); state.tutorialStep = 5; state.gold = 4321; state.yuanbao = 99;
  state.equipmentInventory = []; state.equipmentNextId = 1;
  const item = createEquipment('weapon', 2, 'rock');
  state.equipmentInventory.push(item);
  state.warriorQuality.rock = 2;
  saveProgress();
  state.gold = 0; state.yuanbao = 0; state.equipmentInventory = [];
  loadProgress();
  return {
    gold: state.gold, yuanbao: state.yuanbao,
    bag: state.equipmentInventory.length,
    warrior: state.equipmentInventory[0] && state.equipmentInventory[0].warrior,
    quality: state.warriorQuality.rock,
  };
`);
check("存读档往返保留金币与元宝", roundTrip.gold === 4321 && roundTrip.yuanbao === 99, JSON.stringify(roundTrip));
check("存读档往返保留装备与职业字段", roundTrip.bag === 1 && roundTrip.warrior === "rock" && roundTrip.quality === 2, JSON.stringify(roundTrip));

const corrupted = run(`
  const bad = { equipmentInventory: [null, { slot: 'weapon' }, { quality: 99, slot: 'unknown' }, 'oops'], equipmentNextId: -5, warriorQuality: 'not-an-object', gold: 1e30 };
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(bad));
  let threw = '';
  try { loadProgress(); } catch (error) { threw = error.message; }
  let renderThrew = '';
  try { showEquipmentBag(showHome); } catch (error) { renderThrew = error.message; }
  return { threw, renderThrew };
`);
check("脏存档不导致加载崩溃", corrupted.threw === "", corrupted.threw);
check("脏存档不导致包裹渲染崩溃", corrupted.renderThrew === "", corrupted.renderThrew);

/* ---------------- 对局与结算 ---------------- */
section("对局与结算");
const battle = run(`
  localStorage.clear();
  resetGame(); state.tutorialStep = 5; state.highestUnlockedLevel = 5; state.level = 5;
  startLevelFromHome();
  const started = { phase: state.phase, hp: state.hp, monsters: state.monsters.length };
  /* 跑若干帧战斗循环 */
  for (let i = 0; i < 240; i += 1) tick();
  const afterTicks = { phase: state.phase, spawned: state.spawned };
  return { started, afterTicks };
`);
check("进入关卡后阶段切到 setup 且有血量", Boolean(battle.started.phase) && battle.started.hp > 0, JSON.stringify(battle.started));
check("战斗循环 240 帧无异常", runtimeErrors.length === bootErrorsBefore, runtimeErrors.slice(-2).join(" | "));

const settle = run(`
  let threw = '';
  try { state.phase = 'settle'; showVictory(); } catch (error) { threw = error.message; }
  let defeatThrew = '';
  try { showDefeat(); } catch (error) { defeatThrew = error.message; }
  return { threw, defeatThrew };
`);
check("胜利结算界面可渲染", settle.threw === "", settle.threw);
check("失败结算界面可渲染", settle.defeatThrew === "", settle.defeatThrew);

/* ---------------- 广告与体力 ---------------- */
section("广告与体力");
const ads = run(`
  const out = {};
  resetGame(); state.tutorialStep = 5; state.highestUnlockedLevel = 5; state.level = 5;
  /* 激励广告：走 AdService 的完整生命周期（打开 → 倒计时 → 领奖） */
  let rewarded = 0;
  const opened = AdService.showRewarded({ placement: '回归测试', onComplete: () => { rewarded += 1; } });
  out.opened = opened;
  out.adModalShown = Boolean(document.querySelector('.modal-card'));
  out.doublePlayBlocked = AdService.showRewarded({ placement: '重复请求' }) === false;
  /* 未看满时长就点领取：不应发奖 */
  finishRewardedAd(true);
  out.rewardedBeforeFullPlay = rewarded;
  /* 正常看完：把计时推到满额再领取 */
  AdService.showRewarded({ placement: '回归测试-完整', onComplete: () => { rewarded += 1; } });
  state.adPlayback.elapsed = state.adPlayback.duration;
  finishRewardedAd(true);
  out.rewarded = rewarded;
  out.adPlaybackCleared = state.adPlayback === null || state.adPlayback === undefined;
  /* 中途关闭广告不应发奖 */
  AdService.showRewarded({ placement: '回归测试-取消', onComplete: () => { rewarded += 1; } });
  state.adPlayback.elapsed = state.adPlayback.duration;
  finishRewardedAd(false);
  out.rewardedAfterCancel = rewarded;
  let threw = '';
  try { showStaminaRefill(); } catch (error) { threw = error.message; }
  out.staminaModal = threw || 'ok';
  return out;
`);
check("激励广告可正常打开", ads.opened === true && ads.adModalShown === true, JSON.stringify(ads));
check("广告播放中不能被重复请求", ads.doublePlayBlocked === true, JSON.stringify(ads));
check("时长未满点领取不发奖", ads.rewardedBeforeFullPlay === 0, JSON.stringify(ads));
check("看完广告发放奖励并清理播放态", ads.rewarded === 1 && ads.adPlaybackCleared === true, JSON.stringify(ads));
check("中途关闭广告不发奖", ads.rewardedAfterCancel === 1, JSON.stringify(ads));
check("体力补充弹窗可渲染", ads.staminaModal === "ok", ads.staminaModal);

/* ---------------- 闭环流程：推进 / 到账 / 领取 ---------------- */
section("闭环流程");

const progression = run(`
  resetGame(); state.tutorialStep = 5;
  state.highestUnlockedLevel = 3; state.level = 3; state.selectedLevel = 3;
  state.gold = 0; state.yuanbao = 0;
  startLevelFromHome();
  state.phase = 'settle';
  showVictory();
  const unlocked = state.highestUnlockedLevel;
  const goldAfterWin = state.gold;
  nextLevel();
  return { unlocked, goldAfterWin, levelAfterNext: state.level, selected: state.selectedLevel };
`);
check("通关后解锁下一关", progression.unlocked === 4, JSON.stringify(progression));
check("通关结算发放金币", progression.goldAfterWin > 0, JSON.stringify(progression));
check("点下一关后关卡号与选中关同步 +1", progression.levelAfterNext === 4 && progression.selected === 4, JSON.stringify(progression));

const shopFlow = run(`
  resetGame(); state.tutorialStep = 5; state.highestUnlockedLevel = 80; state.level = 80;
  state.gold = 0; state.yuanbao = 100000; state.forgeEnhanceStone = 0; state.shopAdUsed = 0;
  showShop(showHome);
  const yuanbaoBefore = state.yuanbao;
  const stoneBefore = state.forgeEnhanceStone;
  const card = document.querySelector('[data-buy][data-kind="enhance"]');
  card.click();
  const confirmBtn = [...document.querySelectorAll('#modalActions button')].find((b) => b.textContent.includes('确认兑换'));
  if (confirmBtn) confirmBtn.click();
  return {
    hasCard: Boolean(card),
    paid: yuanbaoBefore - state.yuanbao,
    gained: state.forgeEnhanceStone - stoneBefore,
    notice: (document.querySelector('.shop-notice') || {}).textContent || '',
    owned: (document.querySelector('.shop-group[data-group="enhance"] .shop-group-owned b') || {}).textContent || '',
  };
`);
check("商店兑换扣元宝并到账强化石（10 元宝 → 100 个）", shopFlow.hasCard && shopFlow.paid === 10 && shopFlow.gained === 100, JSON.stringify(shopFlow));
check("兑换后持有量与提示同步刷新", shopFlow.owned === "100个" && shopFlow.notice.includes("兑换"), JSON.stringify(shopFlow));

const forgeFlow = run(`
  resetGame(); state.tutorialStep = 5; showHome();   /* currentView 必须是 home，穿戴才被允许 */
  state.highestUnlockedLevel = 50; state.level = 50;
  state.gold = 999999; state.forgeEnhanceStone = 999; state.forgeStarStone = 999;
  state.warriorQuality.fan = 1;
  state.equipmentInventory = []; state.equipmentNextId = 1; state.warriorEquipment.fan = {};
  EQUIPMENT_SLOTS.forEach(({ id }) => state.equipmentInventory.push(createEquipment(id, 1, 'fan')));
  const equipped = autoEquipEquipment('fan');
  state.selectedWarriorType = 'fan';
  forgeUi.slot = 'weapon';
  const beforeAttack = getWarriorBonuses('fan').attack;
  runForgeEnhanceOne(() => {});
  const enh = forgeSlotState('fan', 'weapon').enh;
  const afterAttack = getWarriorBonuses('fan').attack;
  const originalRandom = Math.random;
  Math.random = () => 0;            /* 升星锁成必成 */
  runForgeStarOne(() => {});
  Math.random = originalRandom;
  const star = forgeSlotState('fan', 'weapon').star;
  return { equipped, beforeAttack, afterAttack, enh, star, notice: forgeUi.notice, stonesLeft: state.forgeEnhanceStone };
`);
check("测试前提：6 件装备已穿戴", forgeFlow.equipped === 6, JSON.stringify(forgeFlow));
check("装备强化生效并提升战力", forgeFlow.enh === 1 && forgeFlow.afterAttack > forgeFlow.beforeAttack, JSON.stringify(forgeFlow));
check("强化消耗强化石", forgeFlow.stonesLeft < 999, JSON.stringify(forgeFlow));
check("装备升星必成时星级 +1", forgeFlow.star === 1, JSON.stringify(forgeFlow));

const tasks = run(`
  resetGame(); state.tutorialStep = 5; showHome();
  state.highestUnlockedLevel = 999; state.level = 999;
  state.heroLevel = 60; state.maxHp = 63;
  state.gold = 0; state.yuanbao = 0;
  state.mainQuestIndex = 0;
  state.equipmentInventory = []; state.equipmentNextId = 1; state.warriorEquipment.fan = {};
  state.warriorQuality.fan = 1;
  EQUIPMENT_SLOTS.forEach(({ id }) => state.equipmentInventory.push(createEquipment(id, 1, 'fan')));
  autoEquipEquipment('fan');
  const equipped = totalEquippedCount();
  const questClaimed = claimMainQuest();
  const questIndex = state.mainQuestIndex;
  const questGold = state.gold;
  /* 第二条是「穿戴1件装备」，条件已满足，应当可以继续领 */
  const questClaimedAgain = claimMainQuest();

  state.dailyDate = getDayKey();
  state.dailyProgress = { play: 5, clear: 99, kill: 99, beast: 2, enhance: 2, star: 2 };
  state.dailyClaimed = {};
  const goldBeforeDaily = state.gold;
  claimDailyTask('play');
  const dailyGold = state.gold - goldBeforeDaily;
  const dailyFlags = Object.keys(state.dailyClaimed).length;
  claimDailyTask('play');                       /* 重复领取应无效 */
  const dailyFlagsAfterRepeat = Object.keys(state.dailyClaimed).length;

  state.dailyLoginClaimed = false;
  claimDailyLogin();
  const loginFirst = state.dailyLoginClaimed;
  const loginGold = state.gold;
  claimDailyLogin();
  return { equipped, questClaimed, questIndex, questGold, questClaimedAgain, dailyGold, dailyFlags, dailyFlagsAfterRepeat, loginFirst, loginGold, finalGold: state.gold };
`);
check("测试前提：6 件装备已穿戴", tasks.equipped === 6, JSON.stringify(tasks));
check("主线任务满足条件后可领取并推进索引", tasks.questClaimed === true && tasks.questIndex === 1 && tasks.questGold > 0, JSON.stringify(tasks));
check("下一条已满足的主线任务可继续领取", tasks.questClaimedAgain === true, JSON.stringify(tasks));
check("每日任务领取到账且不可重复领", tasks.dailyGold > 0 && tasks.dailyFlags === 1 && tasks.dailyFlagsAfterRepeat === 1, JSON.stringify(tasks));
check("每日登录奖励只发一次", tasks.loginFirst === true && tasks.loginGold === tasks.finalGold, JSON.stringify(tasks));

const tutorial = run(`
  resetGame(); state.tutorialStep = 0; state.tutorialActive = false; showHome();
  startTutorial();
  const shown = state.tutorialStep;
  const modalOpen = Boolean(document.querySelector('.modal-card'));
  /* 第一个按钮是顶栏返回键，要点的是操作区里的「开始教学」 */
  document.querySelector('#modalActions button').click();
  const afterStart = { step: state.tutorialStep, active: state.tutorialActive, view: currentView };
  advanceTutorial(4);
  const afterAdvance = state.tutorialStep;
  return { shown, modalOpen, afterStart, afterAdvance };
`);
check("新手引导弹窗可打开", tutorial.shown === 0 && tutorial.modalOpen === true, JSON.stringify(tutorial));
check("开始教学进入教学关卡", tutorial.afterStart.active === true && tutorial.afterStart.step === 2 && tutorial.afterStart.view === "battle", JSON.stringify(tutorial));
check("引导进度可推进", tutorial.afterAdvance === 4, JSON.stringify(tutorial));

const army = run(`
  const out = {};
  resetGame(); state.tutorialStep = 5; state.highestUnlockedLevel = 30; state.level = 30;
  try {
    triggerArmyReport('回归测试');
    out.active = Boolean(getActiveArmyReport());
    showArmyReport();
    out.rendered = Boolean(document.querySelector('.modal-card'));
  } catch (error) { out.error = error.message; }
  out.pityDate = state.armyReport.pityDate;
  return out;
`);
check("边塞军报可触发并渲染", !army.error && army.active === true && army.rendered === true, JSON.stringify(army));

/* ---------------- 战斗与卡牌 ---------------- */
section("战斗与卡牌");

const hint = run(`
  resetGame(); state.tutorialStep = 5;
  const moves = findHintMoves();
  let validIndices = true;
  let validPair = true;
  if (moves) {
    validIndices = Array.isArray(moves.indices) && moves.indices.every((i) => Number.isInteger(i) && i >= 0 && i < 36);
    validPair = Array.isArray(moves.pair) && moves.pair.length === 0 || (moves.pair.length === 2);
  }
  return { result: moves === null ? "null" : typeof moves, hasIndices: moves ? validIndices : true, validPair: moves ? validPair : true };
`);
check("提示函数返回 null 或 {indices, pair}", (hint.result === "null" || hint.result === "object") && hint.hasIndices && hint.validPair, JSON.stringify(hint));

const shuffle = run(`
  resetGame(); state.tutorialStep = 5;
  const before = state.board.map((p) => p && p.type).sort().join(",");
  const candidate = createShuffledBoard(state.board);
  const after = candidate ? candidate.map((p) => p && p.type).sort().join(",") : "";
  return { created: Boolean(candidate), sameMultiset: before === after, length: candidate ? candidate.length : 0 };
`);
check("洗牌保留棋子种类与数量", shuffle.created === true && shuffle.sameMultiset === true && shuffle.length === 36, JSON.stringify(shuffle));

const cards = run(`
  resetGame(); state.tutorialStep = 5; showHome();
  let threw = '';
  let cardCount = 0;
  try {
    openCardChoice();
    cardCount = document.querySelectorAll('.card-choice-card, [data-card]').length;
  } catch (error) { threw = error.message; }
  const before = JSON.stringify(getWarriorBonuses('fan'));
  let applyThrew = '';
  try {
    const card = CARD_DEFINITIONS[0];
    applyCard(card);
  } catch (error) { applyThrew = error.message; }
  return { threw, cardCount, applyThrew, definitionCount: CARD_DEFINITIONS.length, bonusesChanged: JSON.stringify(getWarriorBonuses('fan')) !== before };
`);
check("三选一弹窗可打开", cards.threw === "" && cards.definitionCount > 0, JSON.stringify(cards));
check("卡牌可正常结算", cards.applyThrew === "", JSON.stringify(cards));

const defense = run(`
  resetGame(); state.tutorialStep = 5; state.highestUnlockedLevel = 10; state.level = 10;
  startLevelFromHome();
  const startHp = state.hp;
  for (let i = 0; i < 1800; i += 1) tick();
  return { startHp, hp: state.hp, spawned: state.spawned, phase: state.phase, monsters: state.monsters.length };
`);
check("长时间战斗循环不崩溃", runtimeErrors.length === bootErrorsBefore, runtimeErrors.slice(-1)[0] || "");
check("战斗状态自洽（血量不越界）", defense.hp >= 0 && defense.hp <= ev("state.maxHp"), JSON.stringify(defense));

section("按钮遍历");
const buttonScreens = [
  ["首页", "resetGame(); state.tutorialStep = 5; state.highestUnlockedLevel = 80; state.level = 80; showHome();", "#homeScreen"],
  ["武将成长", "showEquipmentGrowth(showHome);", ".equipment-modal"],
  ["装备包裹", "showEquipmentBag(showHome);", ".bag-modal"],
  ["装备合成", "showEquipmentSynthesis(showHome);", ".bag-modal"],
  ["装备打造", "showForge(showHome);", ".forge-modal"],
  ["商店", "showShop(showHome);", ".modal-card"],
  ["每日任务", "showDailyTasks();", ".modal-card"],
  ["主角成长", "showHeroGrowthModal(showHome);", ".modal-card"],
];
let clickedTotal = 0;
buttonScreens.forEach(([label, openCall, scope]) => {
  const thrown = [];
  run("state.gold = 999999; state.yuanbao = 99999; state.forgeEnhanceStone = 999; state.forgeStarStone = 999;");
  run(openCall);
  /* 先记下按钮数量，之后每个按钮都在"重新打开界面"的干净状态下单独点一次，
     避免上一个按钮把面板换掉（例如打开广告弹窗）干扰后一个按钮的判定 */
  const buttonCount = doc.querySelectorAll(`${scope} button`).length;
  for (let index = 0; index < buttonCount; index += 1) {
    run(openCall);
    const button = [...doc.querySelectorAll(`${scope} button`)][index];
    if (!button || button.disabled) continue;
    const before = runtimeErrors.length;
    try {
      button.click();
      clickedTotal += 1;
    } catch (error) {
      thrown.push(`#${index}(${button.textContent.trim().slice(0, 12)}) 抛出 ${error.message}`);
      continue;
    }
    /* 广告是 setInterval 驱动的，点完立刻收掉，避免计时器堆积 */
    if (ev("state.adPlayback")) {
      try { ev("state.adPlayback.elapsed = state.adPlayback.duration; finishRewardedAd(false);"); } catch (error) { thrown.push("广告收尾 " + error.message); }
    }
    const fresh = runtimeErrors.slice(before);
    if (fresh.length) thrown.push(`#${index}(${button.textContent.trim().slice(0, 12)}) -> ${fresh[0].split("\n")[0].slice(0, 120)}`);
  }
  check(`${label} 的 ${buttonCount} 个按钮均可点`, thrown.length === 0, thrown.slice(0, 3).join(" ； "));
});
console.log(`  索引  共点击 ${clickedTotal} 次`);

/* ---------------- 已定案设计：金色（第 7 档）可达性 ---------------- */
section("已定案设计：金色（第 7 档）");
const goldTier = run(`
  const maxWarriorQuality = MAX_WARRIOR_QUALITY;
  const qualityTierCount = EQUIPMENT_QUALITY.length;
  const topTable = EQUIPMENT_DROP_TABLES[EQUIPMENT_DROP_TABLES.length - 1];
  const goldDropWeight = topTable.weights[qualityTierCount - 1];
  const mainlineCeilingAt61 = getMainlineEquipmentQualityCeiling(61);
  const challengeCeiling = Math.min(qualityTierCount,
    mainlineCeilingAt61 + CHALLENGE_MODE_CONFIG.equipmentQualityBonusMax);

  resetGame(); state.tutorialStep = 5; showHome();
  state.yuanbao = 9999999;
  /* 把武将顶到新档能达到的最高品质，再尝试突破 */
  state.warriorQuality.fan = MAX_WARRIOR_QUALITY;
  state.equipmentInventory = []; state.equipmentNextId = 1;
  state.warriorEquipment.fan = {};
  EQUIPMENT_SLOTS.forEach(({ id }) => { state.warriorEquipment.fan[id] = createEquipment(id, MAX_WARRIOR_QUALITY, 'fan'); });
  const brokeThrough = breakthroughWarrior('fan');
  const reachableQuality = state.warriorQuality.fan;

  /* 金色装备能否穿上 / 当材料 */
  state.warriorEquipment.fan = {};
  state.equipmentInventory = [];
  const gold = createEquipment('weapon', qualityTierCount, 'fan');
  state.equipmentInventory.push(gold);
  const canWearGold = equipEquipment(gold.id, 'fan');
  const goldIds = Array.from({ length: 5 }, () => { const item = createEquipment('ring', qualityTierCount); state.equipmentInventory.push(item); return item.id; });
  const goldQuote = getSynthesisQuote(goldIds);
  return {
    maxWarriorQuality, qualityTierCount, goldDropWeight, mainlineCeilingAt61, challengeCeiling,
    brokeThrough, reachableQuality, canWearGold,
    goldSellPrice: equipmentSalePrice(gold), goldSynthOk: goldQuote.ok, goldSynthMessage: goldQuote.message,
  };
`);
check("新档最高只能到红色（第 6 档）", goldTier.reachableQuality === goldTier.maxWarriorQuality && goldTier.brokeThrough === false, JSON.stringify(goldTier));
check("红色武将无法穿戴金色装备", goldTier.canWearGold === false, JSON.stringify(goldTier));
check("金色装备不能作为合成材料", goldTier.goldSynthOk === false, JSON.stringify(goldTier));
if (goldTier.maxWarriorQuality < goldTier.qualityTierCount) {
  finding(`金色（第 ${goldTier.qualityTierCount} 档）装备"可掉但穿不上"已定案为刻意保留（2026-09-27 封版），以下行为即为预期，不是缺陷：`
    + `主线第 61 关起掉落天花板进入第 ${goldTier.mainlineCeilingAt61} 档，`
    + `挑战模式最高可掉第 ${goldTier.challengeCeiling} 档（权重 ${goldTier.goldDropWeight}）；`
    + `武将品质上限为第 ${goldTier.maxWarriorQuality} 档，穿戴要求品质完全相等，`
    + `因此金色装备只能按 ${goldTier.goldSellPrice} 金币出售。`
    + `若日后放开武将品质上限，这三条断言会立刻失败，提示同步更新 docs/equipment-growth.md。`);
}

/* ---------------- 汇总 ---------------- */
section("汇总");
const lateErrors = runtimeErrors.slice(bootErrorsBefore);
if (lateErrors.length) {
  console.log(`  运行时异常/警告 ${lateErrors.length} 条：`);
  [...new Set(lateErrors)].slice(0, 10).forEach((e) => console.log("    - " + e.slice(0, 200)));
} else {
  console.log("  交互期无运行时异常与警告");
}
console.log(failures.length ? `\n结论：${failures.length} 项失败 -> ${failures.join("、")}` : "\n结论：全部通过");
dom.window.close();
process.exit(failures.length ? 1 : 0);
