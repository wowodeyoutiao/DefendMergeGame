const ASSET = "./public/assets/";
const DAMAGE_GLYPHS = Object.fromEntries([
  ...Array.from({ length: 10 }, (_, digit) => [String(digit), `ui/fonts/monster-damage/${digit}.png`]),
  ["-", "ui/fonts/monster-damage/minus.png"],
  ["+", "ui/fonts/monster-damage/plus.png"],
]);
const COMBAT_POPUP_LABELS = { critical: "ui/fonts/combat-labels/word_baoji.png", miss: "ui/fonts/combat-labels/word_shanbi.png" };
const BOARD_SIZE = 6;
const MONSTER_SPAWN_Y = 5.45;

/**
 * 怪物纵向像素偏移。
 * y >= 0：棋盘内，按 --cell 走。
 * y < 0 ：接近区，按接近区实际高度等比压缩 —— 接近区可随屏幕高度伸缩，
 *         但「出现 → 进入棋盘」的逻辑时长不变（monster.y 的推进速度没动）。
 */
function monsterOffsetY(monsterY, cell, approachHeight) {
  if (monsterY >= 0) return approachHeight + monsterY * cell;
  return approachHeight * (1 + monsterY / MONSTER_SPAWN_Y);
}
const ATTACK_RANGE_BY_TIER = [0, 3, 4, 5, 6];
const AREA_RADIUS_BY_TIER = [0, 0.5, 1, 1.5, 2];
const ATTACK_INTERVAL_BY_TIER = [0, 0.8, 0.62, 0.46, 0.34];
const MONSTER_MOVE_INTERVAL = 1.24;
const CARD_KILL_STEPS = [4, 8, 13, 18, 23, 28];
const STAMINA_COST_PER_LEVEL = 10;
const STARTING_STAMINA = 60;
const MAX_STAMINA = 60;
const STAMINA_OVERFLOW_LIMIT = 500;
const STAMINA_REFILL_AMOUNT = 60;
const STAMINA_PURCHASE_COST = 50;
const SHOP_AD_DAILY_LIMIT = 5; // 边塞商店每日可看广告领元宝次数
const SHOP_AD_YUANBAO = 10; // 每次广告可得元宝
const SETTLEMENT_AD_EQUIPMENT_CHANCE = 0.35;
// 关卡三个宝箱（达成条件以「通关时防线血量占比」判定）：
//   ① 成功通关（防线大于0%）——通关即达成
//   ② 成功防御（防线大于50%）——须严格大于 50%
//   ③ 完美守城（防线等于100%）——防线未被击破
const STAGE_CHEST_META = [
  { key: "complete", label: "成功通关", condition: "防线大于0%", amount: 50, threshold: 0, inclusive: true },
  { key: "intact", label: "成功防御", condition: "防线大于50%", amount: 100, threshold: 0.5, inclusive: false },
  { key: "perfect", label: "完美守城", condition: "防线等于100%", amount: 150, threshold: 1, inclusive: true },
];
const STAMINA_REGEN_INTERVAL = 18 * 60 * 1000;
const CHALLENGE_MODE_CONFIG = {
  staminaCost: 20,
  dailyAttemptLimit: 3,
  rewardMultiplierMin: 2.5,
  rewardMultiplierMax: 3,
  extraWavesMin: 5,
  extraWavesMax: 10,
  bossEveryWaves: 3,
  bossesPerBossWave: 2,
  monsterTotalMultiplier: 1.2,
  difficultyMultiplier: 1.35,
  equipmentQualityBonusMin: 1,
  equipmentQualityBonusMax: 2,
  equipmentDoubleChance: 0.35,
};

/* ========== 通关奖励口径（2026-09-20 调参表 v2）==========
   与《合战守格_经济产销与关卡难度调参表》表 1「主线关卡产出」一一对应：
   ① 通关金币 = 基数 + 关卡 × 递增。主线结算与边塞军报共用同一组值，
      历史上两处各写一份（getFullLevelReward / getBeastGoldRange）易漂移，此处收敛。
   ② 通关元宝：v2 起停用（enabled=false）。元宝改为只由每关三个宝箱
      （STAGE_CHEST_META）产出——宝箱每关仅可领一次，重刷不再套利。
      如需恢复随通关发放，把 enabled 改回 true 即可。 */
const LEVEL_GOLD_REWARD = { base: 180, step: 20 };
const LEVEL_YUANBAO_REWARD = { enabled: false, base: 20, step: 5 };

/* ========== 边塞军报 · 异兽入侵（纯 IAA 限时副本）==========
   规格（2026-09-18 定案）：
   ① 玩家持续在线期间，每 10 分钟判定一次，10% 几率触发「异兽入侵」；
      判定触发后军报出现并给出「挑战」入口，进入异兽入侵专属副本。
      副本玩法同主线副本，只是波次更多（10 波、每 5 波一个 BOSS 波），且不消耗体力。
      通关必得：高品质装备（主线可产出最高品质 +1~2）、大量金币、50~200 元宝；
      几率获得：装备强化材料、装备升星材料。
      挑战失败则只发必得奖励，且数量按范围最低值给（几率材料不发放）。
   ② 每条军报都有 5 分钟倒计时；倒计时结束仍未挑战，则军报消失、不可再挑战。
   ③ 军报触发后主界面出现走马灯消息提示，军报按钮挂小红点。
   所有数值均为配置项，方便按投放节奏统一调整。 */
const ARMY_REPORT_CONFIG = {
  checkIntervalMs: 10 * 60 * 1000, // 在线每 10 分钟判定一次
  triggerChance: 0.1,              // 每次判定触发几率 10%
  pityMissRequired: 3,             // 保底：当日连续 3 次侦查未发现 → 下一次侦查必出
  pityDailyLimit: 1,               // 保底每日至多生效 1 次（按自然日重置）
  stayMs: 5 * 60 * 1000,           // 单条军报存活 5 分钟
  waves: 10,                       // 异兽入侵波次总数
  bossEveryWaves: 5,               // 每 5 波为 BOSS 波（第 5 / 10 波）
  difficultyMultiplier: 1.12,      // 入侵关难度系数（在主线同关基础上加成）
  qualityBonusMin: 0,              // 必得装备品质 = 主线可产出最高品质 +0~1
  qualityBonusMax: 1,
  goldMultiplierMin: 2,            // 大量金币 = 主线满通金币 × (2 ~ 5)
  goldMultiplierMax: 5,
  yuanbaoMin: 15,                  // 元宝必得 15 ~ 40
  yuanbaoMax: 40,
  enhanceChance: 0.45,             // 强化石（几率）
  starChance: 0.25,                // 升星石（几率）
  stoneMultiplier: 2,              // 材料数量 = 当前档位通关材料 × 2
  enterCostStamina: 0,             // 入场不消耗体力
  monsterTotalMultiplier: 1.15,    // 军报总怪数 = 主线同关总怪数 × 1.15（10 波分摊，保持军报更硬）
};
const ARMY_REPORT_MESSAGES = [
  "边塞急报：北境异兽群正在集结，请少主立刻整备防线！",
  "边塞急报：斥候回报异兽入侵在即，军报已至，速去迎敌！",
  "边塞急报：异兽先锋已近关隘，守住防线方保边塞安宁！",
];
const HERO_MAX_LEVEL = 150;
// DEPRECATED · 未生效，勿调（主角升级已改为经验制，实际读 HERO_EXP_TABLE）
const HERO_LEVEL_COST_BASE = 80;
// DEPRECATED · 未生效，勿调（同上）
const HERO_LEVEL_COST_STEP = 20;
const HERO_EXP_PER_STAMINA = 100; // 每点体力值折算经验 = 100 × 角色当前等级
const HERO_EXP_TABLE = Array.from({ length: HERO_MAX_LEVEL }, (_, index) => {
  const level = index + 1;
  const equivalentWins = Math.ceil(1.5 + level * 0.32
    + Math.max(0, level - 20) * 0.18
    + Math.max(0, level - 60) * 0.35);
  return equivalentWins * STAMINA_COST_PER_LEVEL * HERO_EXP_PER_STAMINA * level;
});
const HERO_BREAKTHROUGH_COST = 150;
const PROGRESS_STORAGE_KEY = "defend-merge-progress-v1";
const MAX_PIECE_TIER = 4;
const MAX_MERGE_HINTS = 5;
const MAX_BOARD_SHUFFLES = 3;
const HINT_AD_DURATION_MS = 3000;
const REWARDED_AD_DURATION_MS = 2000;
// DEPRECATED · 未生效，勿调（引导进度走 PROGRESS_STORAGE_KEY 一并存档）
const TUTORIAL_STORAGE_KEY = "defend-merge-tutorial-v1";
const EQUIPMENT_SLOTS = [
  { id: "weapon", name: "武器", stat: "attack", label: "攻击力" },
  { id: "armor", name: "衣服", stat: "crit", label: "暴击值" },
  { id: "helmet", name: "头盔", stat: "hit", label: "命中值" },
  { id: "necklace", name: "护腕", stat: "attack", label: "攻击力" },
  { id: "ring", name: "饰品", stat: "attack", label: "攻击力" },
  { id: "boots", name: "靴子", stat: "speed", label: "攻速" },
];
/* 武将成长面板的六槽位左右分列（2026-09-22 超哥对齐 UI 示意图）：
   左列 武器 / 头盔 / 衣服，右列 护腕 / 靴子 / 饰品。
   只决定展示顺序与分组，槽位 id、图标、掉落 / 合成规则均不变。 */
const EQUIPMENT_SLOT_COLUMNS = {
  left: ["weapon", "helmet", "armor"],
  right: ["necklace", "boots", "ring"],
};
const EQUIPMENT_QUALITY = [
  { id: 1, name: "白色", prefix: "粗制", color: "#d8dedc", coefficient: 1, asset: "ui/bag/quality-1.png" },
  { id: 2, name: "绿色", prefix: "精良", color: "#70bd78", coefficient: 1.25, asset: "ui/bag/quality-2.png" },
  { id: 3, name: "蓝色", prefix: "秘银", color: "#69a9df", coefficient: 1.55, asset: "ui/bag/quality-3.png" },
  { id: 4, name: "紫色", prefix: "星辉", color: "#aa7bd0", coefficient: 1.95, asset: "ui/bag/quality-4.png" },
  { id: 5, name: "橙色", prefix: "龙魂", color: "#e49a4a", coefficient: 2.5, asset: "ui/bag/quality-5.png" },
  { id: 6, name: "红色", prefix: "神威", color: "#dc5c63", coefficient: 3.2, asset: "ui/bag/quality-6.png" },
  { id: 7, name: "金色", prefix: "天命", color: "#e8c45d", coefficient: 4, asset: "ui/bag/quality-7.png" },
];
const EQUIPMENT_BASE_VALUES = { weapon: 50, necklace: 30, ring: 20, armor: 8, helmet: 8, boots: 6 };
const COMBAT_RATING_CONFIG = { baseHit: 100, baseCrit: 0, criticalCoefficient: 0.005, criticalFlatPercent: 4, criticalDamageMultiplier: 1.5 };

/* ========== 战斗力系统（规格来源：《我来野》战斗力系统，文档编号 1.0）==========
   文档算法：战力 = 有效生命×有效生命系数 + 有效输出×有效输出系数 + 命中×命中系数
   + 闪避×闪避系数 + 暴击×暴击系数 + …… ，最后四舍五入取整；总战力 = 各角色战力之和。
   本作角色仅有 攻击 / 暴击 / 命中 / 攻速 四项属性，故按文档结构做等价简化：
   战力 = 主角等级 × 等级权重 + Σ( 武将属性终值 × 属性权重 )，最后四舍五入取整；
   总战力 = 各武将战力之和，展示在主页与打造面板。
   · 武将属性终值 = 突破永久属性 + Σ各槽位( 装备基础值 + 强化加成 + 升星加成 )，
     再叠加该属性的强化 / 升星大师加成（大师档位标注了生效属性：攻击 / 攻速 / 暴击 / 命中）。
     装备是穿在具体武将身上的，所以这套养成永久记在该武将身上，局内局外同时生效。
   · 该属性终值就是局内战斗读取的属性（getWarriorBonuses），故战力与实际战力同源。
   · 依据文档「强化 / 升星数值需该槽位穿戴装备后才生效」，空槽位不计入强化 / 升星加成。
   · 局内合并升级带来的属性成长只在局内有效，不计入战力。
   全部系数均为配置参数，便于后续按数值投放统一调整。 */
const COMBAT_POWER_CONFIG = {
  levelWeight: 60,
  statWeight: { attack: 10, crit: 45, hit: 18, speed: 55 },
  breakthroughSkillWeight: 120,
  padDigits: 8,
  countForgeWithoutEquipment: false,
};
const BOSS_COMBAT_RATINGS = { dodge: 100, resilience: 0 };
const EQUIPMENT_BREAKTHROUGH_COSTS = [100, 250, 500, 900, 1500, 2400];
const EQUIPMENT_SYNTHESIS_COSTS = [200, 800, 3000, 12000, 48000, 160000];
const EQUIPMENT_SYNTHESIS_RATES = [1, 0.95, 0.85, 0.72, 0.58, 0.45];
const EQUIPMENT_SYNTHESIS_BONUS = { enabled: false, chance: 0.1, salePriceMultiplier: 2 };
const EQUIPMENT_DROP_CHANCE = 0.68;
const EQUIPMENT_DROP_PITY_MISSES = 3;
const EQUIPMENT_DROP_TABLES = [
  { minLevel: 1, weights: [0.94, 0.055, 0.005, 0, 0, 0, 0] },
  { minLevel: 21, weights: [0.8, 0.16, 0.035, 0.005, 0, 0, 0] },
  { minLevel: 41, weights: [0.68, 0.22, 0.08, 0.018, 0.002, 0, 0] },
  { minLevel: 61, weights: [0.55, 0.25, 0.14, 0.05, 0.009, 0.001, 0] },
  { minLevel: 81, weights: [0.43, 0.26, 0.18, 0.09, 0.035, 0.0045, 0.0005] },
  { minLevel: 121, weights: [0.32, 0.25, 0.2, 0.13, 0.07, 0.025, 0.005] },
];
const EQUIPMENT_ICONS = {
  weapon: "equipment/weapon.png",
  armor: "equipment/armor.png",
  helmet: "equipment/helmet.png",
  necklace: "equipment/necklace.png",
  ring: "equipment/ring.png",
  boots: "equipment/boots.png",
};
/* ========== 装备打造（成长页签）：强化 / 升星 / 洗炼 / 魂石 ==========
   规格来源：《我来野》打造模块-装备系统
   - 强化：消耗金币+强化石，针对装备槽位，无成功率，等级上限 = 角色等级 × 2
   - 升星：消耗金币+升星石，针对装备槽位，有成功率，最高 30 星
   - 洗炼 / 魂石：本轮未开放，仅占位
   - 强化大师 / 升星大师：全身槽位等级同时达标才激活加成
*/
const FORGE_TABS = [
  { id: "enhance", name: "强化" },
  { id: "star", name: "升星" },
  { id: "refine", name: "洗炼" },
  { id: "gem", name: "魂石" },
];
const FORGE_UNLOCKED_TABS = ["enhance", "star"];
const FORGE_CONFIG = {
  enhanceCapFactor: 2,
  enhanceGoldBase: 200,
  enhanceGoldStep: 120,
  enhanceValueRate: 0.15,
  starMax: 30,
  starGoldBase: 400,
  starGoldStep: 160,
  starValueRate: 0.08,
};
const SHOP_EXCHANGE_CONFIG = Object.freeze({
  enhance: { label: "强化石", rate: 10, batchCosts: [10, 50, 200, 500] },
  star: { label: "升星石", rate: 1, batchCosts: [10, 50, 200, 500] },
  gold: { label: "金币", rate: 1000, batchCosts: [1, 10, 50, 100] },
});
const FORGE_ECONOMY = {
  startingEnhanceStone: 24,
  startingStarStone: 8,
  progressionTiers: [
    { maxLevel: 14, name: "新手补给", levelEnhance: 2, levelStar: 1, dailyEnhance: [4, 6], dailyStar: 2 },
    { maxLevel: 35, name: "成长阶段", levelEnhance: 3, levelStar: 1, dailyEnhance: [5, 7], dailyStar: 3 },
    { maxLevel: 70, name: "进阶阶段", levelEnhance: 4, levelStar: 2, dailyEnhance: [6, 8], dailyStar: 4 },
    { maxLevel: 120, name: "精英阶段", levelEnhance: 5, levelStar: 2, dailyEnhance: [7, 10], dailyStar: 5 },
    { maxLevel: Number.MAX_SAFE_INTEGER, name: "传说阶段", levelEnhance: 6, levelStar: 3, dailyEnhance: [9, 12], dailyStar: 6 },
  ],
  enhanceCostTiers: [
    { maxLevel: 5, stone: 1, goldMultiplier: 1 },
    { maxLevel: 10, stone: 2, goldMultiplier: 1.15 },
    { maxLevel: 20, stone: 3, goldMultiplier: 1.4 },
    { maxLevel: 35, stone: 5, goldMultiplier: 1.8 },
    { maxLevel: 50, stone: 8, goldMultiplier: 2.25 },
    { maxLevel: 65, stone: 12, goldMultiplier: 2.8 },
    { maxLevel: Number.MAX_SAFE_INTEGER, stone: 18, goldMultiplier: 3.5 },
  ],
  starCostTiers: [
    { maxLevel: 3, stone: 1, goldMultiplier: 1 },
    { maxLevel: 5, stone: 2, goldMultiplier: 1.15 },
    { maxLevel: 10, stone: 3, goldMultiplier: 1.4 },
    { maxLevel: 15, stone: 5, goldMultiplier: 1.85 },
    { maxLevel: 20, stone: 8, goldMultiplier: 2.35 },
    { maxLevel: 25, stone: 12, goldMultiplier: 3 },
    { maxLevel: Number.MAX_SAFE_INTEGER, stone: 18, goldMultiplier: 3.8 },
  ],
  /* 兑换仅用于补缺口，不能替代关卡与每日任务的长期产出。 */
  exchangeOffers: {
    enhance: { price: 20, amount: 20 * SHOP_EXCHANGE_CONFIG.enhance.rate },
    star: { price: 20, amount: 20 * SHOP_EXCHANGE_CONFIG.star.rate },
  },
};
const FORGE_STAR_RATES = [
  1, 1, 1, 0.8, 0.8, 0.6, 0.6, 0.6, 0.6, 0.6,
  0.45, 0.45, 0.45, 0.45, 0.45, 0.35, 0.35, 0.35, 0.35, 0.35,
  0.25, 0.25, 0.25, 0.25, 0.25,
  0.15, 0.15, 0.15, 0.15, 0.15,
];
const FORGE_ENHANCE_MASTER = [
  { level: 5, stat: "攻击", value: "+3%" },
  { level: 10, stat: "攻击", value: "+6%" },
  { level: 15, stat: "攻速", value: "+4%" },
  { level: 20, stat: "攻击", value: "+10%" },
  { level: 25, stat: "暴击", value: "+6%" },
  { level: 30, stat: "攻击", value: "+15%" },
];
const FORGE_STAR_MASTER = [
  { level: 3, stat: "攻击", value: "+2%" },
  { level: 6, stat: "命中", value: "+4%" },
  { level: 9, stat: "攻击", value: "+6%" },
  { level: 12, stat: "暴击", value: "+5%" },
  { level: 15, stat: "攻击", value: "+9%" },
  { level: 18, stat: "攻速", value: "+5%" },
  { level: 21, stat: "攻击", value: "+12%" },
  { level: 24, stat: "暴击", value: "+8%" },
  { level: 27, stat: "攻击", value: "+15%" },
  { level: 30, stat: "攻击", value: "+20%" },
];
const DAILY_TASKS = [
  { id: "play", title: "完成 1 局", target: 1 },
  { id: "clear", title: "消除 30 个棋子", target: 30 },
  { id: "kill", title: "击败 20 个怪物", target: 20 },
  { id: "beast", title: "参与 1 次军报挑战", target: 1 },
  { id: "enhance", title: "强化装备 1 次", target: 1 },
  { id: "star", title: "升星装备 1 次", target: 1 },
];
const MAIN_QUESTS = [
  { id: "clear-1", type: "level", target: 1, title: "通关第1关", action: "battle", reward: { gold: 300 } },
  { id: "equip-1", type: "equip", target: 1, title: "穿戴1件装备", action: "equipment", reward: { enhance: 10 } },
  { id: "clear-2", type: "level", target: 2, title: "通关第2关", action: "battle", reward: { yuanbao: 20 } },
  { id: "enhance-1", type: "enhance", target: 1, title: "完成1次装备强化", action: "enhance", reward: { gold: 500 } },
  { id: "clear-3", type: "level", target: 3, title: "通关第3关", action: "battle", reward: { star: 3 } },
  { id: "equip-3", type: "equip", target: 3, title: "任意武将穿戴3件装备", action: "equipment", reward: { gold: 300, enhance: 15 } },
  { id: "clear-4", type: "level", target: 4, title: "通关第4关", action: "battle", reward: { yuanbao: 25 } },
  { id: "star-1", type: "star", target: 1, title: "完成1次装备升星", action: "star", reward: { gold: 800 } },
  { id: "clear-5", type: "level", target: 5, title: "通关第5关", action: "battle", reward: { star: 5 } },
  { id: "equip-6", type: "equip", target: 6, title: "任意武将穿戴全套装备", action: "equipment", reward: { yuanbao: 30 } },
  { id: "breakthrough-1", type: "breakthrough", target: 1, title: "完成1次武将突破", action: "equipment", reward: { gold: 1200, enhance: 25 } },
  { id: "clear-7", type: "level", target: 7, title: "通关第7关", action: "battle", reward: { yuanbao: 50 } },
];
// 进度表由任务清单派生：以后加任务只改上面这份清单，不用再手改重置逻辑
function makeDailyProgress() {
  const progress = {};
  DAILY_TASKS.forEach((task) => { progress[task.id] = 0; });
  return progress;
}
const HERO_SKILLS = [
  {
    id: "meteor", name: "裂地重击", level: 1, cooldown: 18,
    icon: "ui/skills/skill-smash.png",
    description: "全场造成最大生命 30% 伤害（至少 55 点），禁锢 1.5 秒。",
    effect: { damagePct: 0.30, damageMin: 55, root: 1.5 },
  },
  {
    id: "shadow-lock", name: "幽影禁锢", level: 10, cooldown: 26,
    icon: "ui/skills/skill-shadow.png",
    description: "全场怪物禁锢 5 秒，不造成伤害。",
    effect: { root: 5 },
  },
  {
    id: "whirlwind", name: "青风横扫", level: 20, cooldown: 22,
    icon: "ui/skills/skill-wind.png",
    description: "全场造成最大生命 45% 伤害（至少 80 点），禁锢 1 秒。",
    effect: { damagePct: 0.45, damageMin: 80, root: 1 },
  },
  {
    id: "sacred-ward", name: "圣光护城", level: 30, cooldown: 34,
    icon: "ui/skills/skill-ward.png",
    description: "恢复 1 点防线，并禁锢怪物 2 秒。",
    effect: { heal: 1, root: 2 },
  },
  {
    id: "flame-storm", name: "烈焰风暴", level: 40, cooldown: 24,
    icon: "ui/theme/buff-burst.png",
    description: "全场造成最大生命 60% 伤害（至少 120 点），禁锢 2.5 秒。",
    effect: { damagePct: 0.60, damageMin: 120, root: 2.5 },
  },
  {
    id: "thunder-judge", name: "雷霆裁决", level: 50, cooldown: 22,
    icon: "ui/theme/buff-thunder.png",
    description: "全场造成最大生命 80% 伤害（至少 160 点）。",
    effect: { damagePct: 0.80, damageMin: 160 },
  },
  {
    id: "iron-wall", name: "钢铁壁垒", level: 60, cooldown: 38,
    icon: "ui/skills/skill-ward.png",
    description: "恢复 3 点防线，并禁锢全场怪物 2 秒。",
    effect: { heal: 3, root: 2 },
  },
  {
    id: "frost-cage", name: "寒冰囚笼", level: 70, cooldown: 32,
    icon: "ui/theme/buff-frost.png",
    description: "全场怪物禁锢 8 秒，不造成伤害。",
    effect: { root: 8 },
  },
  {
    id: "holy-judge", name: "神圣审判", level: 80, cooldown: 24,
    icon: "ui/theme/buff-crossfire.png",
    description: "全场造成最大生命 100% 伤害（至少 220 点），禁锢 3 秒。",
    effect: { damagePct: 1.0, damageMin: 220, root: 3 },
  },
  {
    id: "unyielding", name: "不屈意志", level: 90, cooldown: 44,
    icon: "ui/theme/buff-control.png",
    description: "防线回满，并禁锢全场怪物 3 秒。",
    effect: { heal: "full", root: 3 },
  },
  {
    id: "destroy-cannon", name: "毁灭轰击", level: 100, cooldown: 22,
    icon: "ui/skills/skill-smash.png",
    description: "全场造成最大生命 130% 伤害（至少 300 点）。",
    effect: { damagePct: 1.3, damageMin: 300 },
  },
  {
    id: "ragnarok", name: "诸神黄昏", level: 110, cooldown: 34,
    icon: "ui/theme/buff-burst.png",
    description: "全场造成最大生命 160% 伤害（至少 400 点），禁锢 4 秒。",
    effect: { damagePct: 1.6, damageMin: 400, root: 4 },
  },
  {
    id: "skyfall", name: "天穹陨落", level: 120, cooldown: 28,
    icon: "ui/theme/buff-thunder.png",
    description: "全场造成最大生命 200% 伤害（至少 520 点），禁锢 2 秒。",
    effect: { damagePct: 2.0, damageMin: 520, root: 2 },
  },
  {
    id: "eternal-frost", name: "永冻结界", level: 130, cooldown: 42,
    icon: "ui/theme/buff-frost.png",
    description: "全场怪物禁锢 12 秒，不造成伤害。",
    effect: { root: 12 },
  },
  {
    id: "life-sanctuary", name: "生命圣域", level: 140, cooldown: 52,
    icon: "ui/skills/skill-ward.png",
    description: "防线回满，并禁锢全场怪物 5 秒。",
    effect: { heal: "full", root: 5 },
  },
];
const MONSTER_PROFILES = {
  normal: { move: 1, hp: 1, reward: 18, dodge: 100, resilience: 0 },
  runner: { move: 1.2, hp: 0.72, reward: 20, dodge: 100, resilience: 0 },
  brute: { move: 0.78, hp: 1.7, reward: 28, dodge: 100, resilience: 0 },
  elite: { move: 0.92, hp: 1.35, reward: 34, dodge: 100, resilience: 0 },
};
// DEPRECATED · 未生效，勿调（波次出怪实际读 CHAPTERS[].roster，见 getWaveProfile）
const LEVEL_WAVE_PROFILES = [
  ["normal", "normal", "normal"],
  ["normal", "runner", "normal"],
  ["normal", "runner", "brute"],
  ["normal", "runner", "brute", "normal"],
  ["normal", "runner", "brute", "elite", "normal"],
  ["runner", "brute", "normal", "elite", "runner", "brute"],
  ["runner", "brute", "elite", "normal", "runner", "brute", "elite"],
];

// ---- 章节 / 场景 / Boss 扩展配置 ----
// DEPRECATED · 未生效，勿调（关卡无限推进，无内容总数上限）
const LEVEL_CONTENT_COUNT = 900;

const CHAPTERS = [
  {
    name: "冰雪荒原",
    scene: "ice",
    roster: ["normal", "normal", "runner", "brute", "elite", "runner", "brute"],
    typeSprites: { normal: "melee-1", runner: "ranged-1", brute: "melee-2", elite: "ranged-2" },
    bossSprite: "boss-melee-1",
    bossName: "冰原巨像",
  },
  {
    name: "黄沙要塞",
    scene: "desert",
    roster: ["runner", "normal", "brute", "elite", "normal", "brute", "elite"],
    typeSprites: { normal: "melee-3", runner: "ranged-2", brute: "melee-4", elite: "ranged-3" },
    bossSprite: "boss-ranged-1",
    bossName: "沙暴魔将",
  },
  {
    name: "腐沼秘林",
    scene: "swamp",
    roster: ["normal", "runner", "brute", "elite", "runner", "brute", "elite"],
    typeSprites: { normal: "melee-5", runner: "ranged-3", brute: "melee-7", elite: "ranged-4" },
    bossSprite: "boss-melee-2",
    bossName: "沼渊魔鳄",
  },
  {
    name: "翠野边城",
    scene: "grass",
    roster: ["runner", "normal", "brute", "elite", "normal", "runner", "elite"],
    typeSprites: { normal: "melee-8", runner: "ranged-4", brute: "melee-9", elite: "ranged-5" },
    bossSprite: "boss-melee-3",
    bossName: "荆棘兽王",
  },
  {
    name: "雨林遗迹",
    scene: "rainforest",
    roster: ["normal", "runner", "brute", "elite", "runner", "brute", "elite"],
    typeSprites: { normal: "melee-10", runner: "ranged-5", brute: "melee-11", elite: "ranged-6" },
    bossSprite: "boss-ranged-2",
    bossName: "古树吞噬者",
  },
  {
    name: "熔岩山脉",
    scene: "lava",
    roster: ["runner", "normal", "brute", "elite", "normal", "brute", "elite"],
    typeSprites: { normal: "melee-12", runner: "ranged-6", brute: "melee-13", elite: "ranged-7" },
    bossSprite: "boss-melee-4",
    bossName: "熔火领主",
  },
  {
    name: "魔法山脊",
    scene: "magic",
    roster: ["normal", "runner", "brute", "elite", "runner", "brute", "elite"],
    typeSprites: { normal: "melee-14", runner: "ranged-7", brute: "melee-15", elite: "ranged-8" },
    bossSprite: "boss-ranged-3",
    bossName: "星界监察者",
  },
];

const BOSS_CONFIG = {
  hpMultiplier: 4,       // Boss 基础血量为同波次普通怪的 4 倍（手感调优旋钮）
  reward: 200,           // Boss 击杀金币
  skillInterval: 7,      // 每 7 秒释放一次狂暴
  enrageDuration: 3,     // 狂暴持续 3 秒
  enrageSpeed: 1.4,      // 狂暴期间全场怪物移速 ×1.4
  defenseHit: 0,         // 狂暴不再隔空扣防线；只有怪物越过棋盘边界才造成防线伤害
};

/* ========== 关卡强度曲线（2026-09-20 调参表 v2 定案）==========
   旧公式「怪数与单怪血量双线性相乘」使单关总血量 ×1,080（关卡1 3,300 → 关卡50 3,562,496），
   而玩家养成是线性加法 → 中后期必然撞战力墙。
   新公式改为幂函数，并给20关后增加封顶的养成追赶压力：
     单关总怪数 = monsterTotalBase × 关卡^monsterTotalPower
     单怪平均血量 = hpBase × 关卡^hpPower × 后期封顶倍率
     后期倍率只从21关开始增加，避免新手期突然跳难；1～20关保持原有手感。
   关卡 1 与旧公式逐波完全一致（9/11/13 只 · 86/100/114 血），前期手感零变化。
   对应调参表：表 1「十一、难度曲线（新方案）」；改这里即改整条难度曲线。 */
const LEVEL_SCALING = {
  monsterTotalBase: 33,    // 关卡 1 的单关总怪数
  monsterTotalPower: 0.35, // 总怪数幂次
  hpBase: 100,             // 关卡 1 的单怪平均血量
  hpPower: 0.72,           // 单怪血量幂次，匹配普通玩家装备成长
  lateHpStart: 20,         // 前20关保持现有新手体验
  lateHpPerLevel: 0.003,   // 21关后逐关增加0.3%血量压力
  lateHpCap: 1.35,         // 后期附加倍率封顶，避免无限膨胀
};

function getLevelHpScale(level) {
  const currentLevel = Math.max(1, Number(level) || 1);
  const lateMultiplier = Math.min(
    LEVEL_SCALING.lateHpCap,
    1 + Math.max(0, currentLevel - LEVEL_SCALING.lateHpStart) * LEVEL_SCALING.lateHpPerLevel,
  );
  return LEVEL_SCALING.hpBase * Math.pow(currentLevel, LEVEL_SCALING.hpPower) * lateMultiplier;
}

function getChapterIndex(level) {
  return Math.floor((Math.max(1, level) - 1) / 5);
}
function getChapter(level) {
  return CHAPTERS[getChapterIndex(level) % CHAPTERS.length];
}
function getSceneKey(level) {
  return getChapter(level).scene;
}
function isBossLevel(level) {
  return level % 5 === 0;
}
function getLevelName(level) {
  const ch = getChapter(level);
  return `${ch.name}·第${((level - 1) % 5) + 1}关`;
}
function getMonsterActionsForType(level, type) {
  const ch = getChapter(level);
  const sprite = ch.typeSprites[type] || ch.typeSprites.normal;
  return {
    stand: `monsters/actions/${sprite}-stand.gif`,
    walk: `monsters/actions/${sprite}-walk.gif`,
    attack: `monsters/actions/${sprite}-attack.gif`,
  };
}
function getBossActions(level) {
  const sprite = getChapter(level).bossSprite;
  return {
    stand: `monsters/actions/${sprite}-stand.gif`,
    walk: `monsters/actions/${sprite}-walk.gif`,
    attack: `monsters/actions/${sprite}-attack.gif`,
  };
}
function getMonsterIconForType(level, type) {
  return getMonsterActionsForType(level, type).stand;
}
function getBossIcon(level) {
  return getBossActions(level).stand;
}
function setSceneBg(sceneKey) {
  const src = `${ASSET}scenes/${sceneKey}.png`;
  if (stageBg && stageBg.getAttribute("src") !== src) stageBg.src = src;
  if (homeSceneBg && homeSceneBg.getAttribute("src") !== src) homeSceneBg.src = src;
  if (homeStageMapImage && homeStageMapImage.getAttribute("src") !== src) homeStageMapImage.src = src;
}

const HOME_CHEST_OPEN = "./public/assets/home/reward-chest.png";
const HOME_CHEST_LOCKED = "./public/assets/home/reward-chest-locked.png";
/* 数组顺序 = 界面上的武将页签顺序：
   2026-09-22 按超哥 UI 示意图调整为 男战士 / 男法师 / 女祭司（武将成长与装备打造两处一致）。 */
const WARRIORS = [
  {
    type: "fan",
    name: "男战士",
    modelRole: "warrior",
    attackLabel: "同行攻击",
    modelBounds: [[72, 105, 236, 312], [68, 102, 253, 310], [49, 63, 248, 284], [64, 113, 246, 298], [95, 68, 290, 306], [42, 157, 258, 293]],
  },
  {
    type: "sword",
    name: "男法师",
    modelRole: "mage",
    attackLabel: "同列攻击",
    modelBounds: [[40, 8, 288, 313], [34, 13, 282, 297], [36, 45, 309, 302], [10, 34, 309, 307], [30, 11, 296, 312], [41, 96, 245, 303]],
  },
  {
    type: "rock",
    name: "女祭司",
    modelRole: "priest",
    attackLabel: "范围攻击",
    modelBounds: [[22, 8, 302, 313], [31, 85, 292, 310], [57, 11, 295, 290], [59, 116, 270, 305], [32, 28, 250, 303], [7, 36, 302, 309]],
  },
];
const warriorImageCache = new Map();
const WARRIOR_BREAKTHROUGH_SKILLS = {
  sword: [
    { quality: 2, name: "引雷入脉", description: "同列攻击伤害提升 5%。", effect: { damageMultiplier: 1.05 } },
    { quality: 3, name: "法阵疾行", description: "同列攻击速度提升 4%。", effect: { speedMultiplier: 1.04 } },
    { quality: 4, name: "贯列回响", description: "同列一次实际命中 2 个以上目标时，本次伤害提升 8%。", effect: { multiTargetDamageMultiplier: 1.08 } },
    { quality: 5, name: "寒芒定身", description: "同列一次实际命中 2 个以上目标时，禁锢 0.35 秒，每 4 秒最多触发一次。", effect: { multiTargetRoot: 0.35, rootCooldown: 4 } },
    { quality: 6, name: "天罡列阵", description: "同列攻击伤害再次提升 8%。", effect: { damageMultiplier: 1.08 } },
  ],
  fan: [
    { quality: 2, name: "破阵强袭", description: "同行攻击伤害提升 6%。", effect: { damageMultiplier: 1.06 } },
    { quality: 3, name: "逐风步", description: "同行攻击速度提升 5%。", effect: { speedMultiplier: 1.05 } },
    { quality: 4, name: "横扫回响", description: "同行一次实际命中 2 个以上目标时，本次伤害提升 10%。", effect: { multiTargetDamageMultiplier: 1.1 } },
    { quality: 5, name: "震阵压制", description: "同行一次实际命中 2 个以上目标时，禁锢 0.5 秒，每 3.5 秒最多触发一次。", effect: { multiTargetRoot: 0.5, rootCooldown: 3.5 } },
    { quality: 6, name: "无双战意", description: "同行攻击伤害再次提升 10%。", effect: { damageMultiplier: 1.1 } },
  ],
  rock: [
    { quality: 2, name: "星辉共鸣", description: "范围攻击伤害提升 8%。", effect: { damageMultiplier: 1.08 } },
    { quality: 3, name: "灵光流转", description: "范围攻击速度提升 6%。", effect: { speedMultiplier: 1.06 } },
    { quality: 4, name: "震荡扩散", description: "范围内一次实际命中 2 个以上目标时，本次伤害提升 12%。", effect: { multiTargetDamageMultiplier: 1.12 } },
    { quality: 5, name: "星落禁制", description: "范围内一次实际命中 2 个以上目标时，禁锢 0.65 秒，每 3.5 秒最多触发一次。", effect: { multiTargetRoot: 0.65, rootCooldown: 3.5 } },
    { quality: 6, name: "天星坠落", description: "范围攻击伤害再次提升 12%。", effect: { damageMultiplier: 1.12 } },
  ],
};
const MAX_WARRIOR_QUALITY = 6;

function getWarriorBreakthroughSkills(type, quality = state.warriorQuality[type] || 1) {
  return (WARRIOR_BREAKTHROUGH_SKILLS[type] || []).filter((skill) => skill.quality <= quality);
}

function getNextWarriorBreakthroughSkill(type, quality = state.warriorQuality[type] || 1) {
  return (WARRIOR_BREAKTHROUGH_SKILLS[type] || []).find((skill) => skill.quality > quality) || null;
}

function getWarriorSkillProfile(type, quality = state.warriorQuality[type] || 1) {
  const profile = {
    damageMultiplier: 1,
    speedMultiplier: 1,
    multiTargetDamageMultiplier: 1,
    multiTargetRoot: 0,
    rootCooldown: 0,
  };
  getWarriorBreakthroughSkills(type, quality).forEach((skill) => {
    const effect = skill.effect || {};
    if (effect.damageMultiplier) profile.damageMultiplier *= effect.damageMultiplier;
    if (effect.speedMultiplier) profile.speedMultiplier *= effect.speedMultiplier;
    if (effect.multiTargetDamageMultiplier) profile.multiTargetDamageMultiplier *= effect.multiTargetDamageMultiplier;
    profile.multiTargetRoot = Math.max(profile.multiTargetRoot, effect.multiTargetRoot || 0);
    profile.rootCooldown = Math.max(profile.rootCooldown, effect.rootCooldown || 0);
  });
  return profile;
}

const TYPES = {
  sword: {
    name: "男法师",
    desc: "等级提升同列射程、攻击力与攻速",
    icon: "icon-sword.png",
    kind: "unit",
    color: "#cf3d2c",
    dps: 10,
  },
  fan: {
    name: "男战士",
    desc: "等级提升同行射程、攻击力与攻速",
    icon: "icon-fan.png",
    kind: "unit",
    color: "#3c8f74",
    dps: 8,
  },
  rock: {
    name: "女祭司",
    desc: "攻击与控制半径 0.5/1/1.5/2 格",
    icon: "icon-rock.png",
    kind: "unit",
    color: "#5676aa",
    dps: 7,
  },
  gourd: {
    name: "葫芦",
    desc: "消除时回复防线",
    icon: "ix-gourd.png",
    kind: "item",
    color: "#8b49b9",
    dps: 0,
  },
  coin: {
    name: "铜钱",
    desc: "消除时获得金币",
    icon: "icon-coin.png",
    kind: "item",
    color: "#d17833",
    dps: 0,
  },
  chest: {
    name: "宝箱",
    desc: "3连返1步，4连返2步",
    icon: "ix-chest.png",
    kind: "item",
    color: "#c7952c",
    dps: 0,
  },
  trap: {
    name: "陷阱",
    desc: "消除数量决定禁锢时长",
    icon: "ix-trap.png",
    kind: "device",
    color: "#3f9b53",
    dps: 0,
  },
  mine: {
    name: "地雷",
    desc: "消除数量决定触发伤害",
    icon: "ix-mine.png",
    kind: "device",
    color: "#d06428",
    dps: 0,
  },
};

const CARD_DEFINITIONS = [
  {
    id: "frost",
    mark: "控",
    tag: "怪物控制",
    title: "霜锁阵",
    description: "当前所有怪物禁锢 3 秒。",
  },
  {
    id: "thunder",
    mark: "伤",
    tag: "全屏伤害",
    title: "天火落雷",
    description: "对场上所有怪物造成最大生命值 35% 的伤害。",
  },
  {
    id: "war-cry",
    mark: "攻",
    tag: "武将强化",
    title: "战意高涨",
    description: "所有武将伤害提高 25%。",
  },
  {
    id: "rapid-fire",
    mark: "速",
    tag: "武将强化",
    title: "急袭令",
    description: "所有武将攻击速度提高 22%。",
  },
  {
    id: "crossfire",
    mark: "阵",
    tag: "攻击模式",
    title: "交叉火力",
    description: "武将进入扩散模式，额外覆盖相邻路线。",
  },
  {
    id: "execution",
    mark: "斩",
    tag: "武将强化",
    title: "破阵斩首",
    description: "对生命值高于 50% 的怪物造成 35% 额外伤害。",
  },
];

const state = {
  level: 1,
  selectedLevel: 1,
  highestUnlockedLevel: 1,
  phase: "setup",
  round: 1,
  maxRounds: 3,
  steps: 8,
  gold: 0,
  hp: 4,
  maxHp: 4,
  board: [],
  selected: null,
  monsters: [],
  nextMonsterId: 1,
  nextPieceId: 1,
  spawnTimer: 0,
  moveTimer: 0,
  spawned: 0,
  bossLane: null,
  waveConfig: null,
  loopId: null,
  speed: 1,
  revived: false,
  doubled: false,
  resolving: false,
  resolutionId: 0,
  totalKills: 0,
  killsSinceCard: 0,
  cardsOffered: 0,
  nextCardKillTarget: CARD_KILL_STEPS[0],
  cardQueued: false,
  cardCooldown: 0,
  damageMultiplier: 1,
  attackSpeedMultiplier: 1,
  attackMode: "standard",
  executionReady: false,
  stamina: STARTING_STAMINA,
  maxStamina: MAX_STAMINA,
  staminaLastRegenAt: Date.now(),
  staminaRefillDate: getDayKey(),
  staminaPurchaseUsed: false,
  staminaAdUsed: false,
  shopAdDate: getDayKey(),
  shopAdUsed: 0,
  stageChests: {},
  challengeChests: {},
  challengeAttemptsDate: getDayKey(),
  challengeAttempts: {},
  challengeMode: false,
  challengeRewardMultiplier: 1,
  // 边塞军报：active = 当前有效军报；nextCheckAt = 下一次在线判定时间
  armyReport: { active: null, nextCheckAt: 0, totalTriggered: 0, totalCleared: 0, pityDate: getDayKey(), pityMisses: 0, pityUsed: 0 },
  // 异兽入侵副本上下文（active 为 true 时战斗读取 beastRaid.level / waves）
  beastRaid: null,
  beastPaid: null,
  beastVictoryTarget: null,
  beastDefeatTarget: null,
  levelStaminaSpent: false,
  heroLevel: 1,
  heroExp: 0,
  levelExpAwarded: false,
  levelExpGain: 0,
  levelExpLeveled: 0,
  heroBreakthrough: 0,
  yuanbao: 0,
  heroSkillIndex: 0,
  heroSkillQueue: [],
  heroRallyRemaining: 0,
  heroDamageRemaining: 0,
  heroSpeedRemaining: 0,
  heroSkillCooldowns: Object.fromEntries(HERO_SKILLS.map((skill) => [skill.id, 0])),
  rewardGranted: 0,
  paidReward: 0,
  paidYuanbao: 0,
  paidForgeEnhanceStone: 0,
  paidForgeStarStone: 0,
  mergeHintsUsed: 0,
  boardShufflesUsed: 0,
  shuffleAnimationPending: false,
  hintIndices: [],
  hintPair: [],
  hintAd: null,
  adPlayback: null,
  tutorialActive: false,
  tutorialStep: 0,
  dailyDate: getDayKey(),
  dailyProgress: makeDailyProgress(),
  dailyClaimed: {},
  dailyLoginClaimed: false,
  mainQuestIndex: 0,
  mainQuestStats: { equip: 0, enhance: 0, star: 0, breakthrough: 0 },
  equipmentInventory: [],
  equipmentNextId: 1,
  warriorEquipment: { sword: {}, fan: {}, rock: {} },
  warriorQuality: { sword: 1, fan: 1, rock: 1 },
  warriorPermanentStats: {
    sword: { attack: 0, crit: 0, hit: 0, speed: 0 },
    fan: { attack: 0, crit: 0, hit: 0, speed: 0 },
    rock: { attack: 0, crit: 0, hit: 0, speed: 0 },
  },
  selectedWarriorType: "fan",
  equipmentDropGranted: false,
  equipmentDropMisses: 0,
  lastEquipmentDrop: null,
  settlementAdEquipmentDropGranted: false,
  lastSettlementAdEquipmentDrop: null,
  settlementAdHeroExpGranted: false,
  forgeEnhanceStone: FORGE_ECONOMY.startingEnhanceStone,
  forgeStarStone: FORGE_ECONOMY.startingStarStone,
  forge: { sword: {}, fan: {}, rock: {} },
};

const boardEl = document.getElementById("board");
const monsterLayer = document.getElementById("monsterLayer");
const laneLayer = document.getElementById("laneLayer");
const fxLayer = document.getElementById("fxLayer");
const stepsText = document.getElementById("stepsText");
const goldText = document.getElementById("goldText");
const yuanbaoText = document.getElementById("yuanbaoText");
const staminaText = document.getElementById("staminaText");
const staminaBtn = document.getElementById("staminaBtn");
const phaseText = document.getElementById("phaseText");
const roundText = document.getElementById("roundText");
const cardProgressText = document.getElementById("cardProgress");
const levelText = document.getElementById("levelText");
const defenseHpText = document.getElementById("defenseHpText");
const defenseHpTrack = document.getElementById("defenseHpTrack");
const defenseHpFill = document.getElementById("defenseHpFill");
const heroSkillBtn = document.getElementById("heroSkillBtn");
const heroSkillTimer = document.getElementById("heroSkillTimer");
const heroSkillStrip = document.getElementById("heroSkillStrip");
const heroSkillIcon = document.getElementById("heroSkillIcon");
const heroSkillName = document.getElementById("heroSkillName");
const tipText = document.getElementById("tipText");
const speedBtn = document.getElementById("speedBtn");
const startWaveBtn = document.getElementById("startWaveBtn");
const adStepsBtn = document.getElementById("adStepsBtn");
const mergeHintBtn = document.getElementById("mergeHintBtn");
const mergeHintCount = document.getElementById("mergeHintCount");
const boardShuffleBtn = document.getElementById("boardShuffleBtn");
const boardShuffleCount = document.getElementById("boardShuffleCount");
const resetBtn = document.getElementById("resetBtn");
const homeScreen = document.getElementById("homeScreen");
const gameScreen = document.getElementById("gameScreen");
const homeGoldText = document.getElementById("homeGoldText");
const homeYuanbaoText = document.getElementById("homeYuanbaoText");
const homeStaminaText = document.getElementById("homeStaminaText");
const homeGrowthText = document.getElementById("homeGrowthText");
const homePowerText = document.getElementById("homePowerText");
const homeLevelText = document.getElementById("homeLevelText");
const homeStageName = document.getElementById("homeStageName");
const homeRecordText = document.getElementById("homeRecordText");
const homeStageMapImage = document.getElementById("homeStageMapImage");
const homeQuickTask = document.getElementById("homeQuickTask");
const homeQuickTaskIndex = document.getElementById("homeQuickTaskIndex");
const homeQuickTaskTitle = document.getElementById("homeQuickTaskTitle");
const homeQuickTaskFill = document.getElementById("homeQuickTaskFill");
const homeQuickTaskProgress = document.getElementById("homeQuickTaskProgress");
const homeQuickTaskReward = document.getElementById("homeQuickTaskReward");
const homeQuickTaskAction = document.getElementById("homeQuickTaskAction");
const homeEnemy = document.getElementById("homeEnemy");
const stageBg = document.querySelector(".stage-bg");
const homeSceneBg = document.querySelector(".home-background-sky");
const homeRewardRow = document.getElementById("homeRewardRow");
const homeStartBtn = document.getElementById("homeStartBtn");
const homeStaminaBtn = document.getElementById("homeStaminaBtn");
const homeHeroAvatar = document.getElementById("homeHeroAvatar");
const homePrevLevelBtn = document.getElementById("homePrevLevelBtn");
const homeNextLevelBtn = document.getElementById("homeNextLevelBtn");
const homeStageFocus = document.querySelector(".home-stage-focus");
const homeStageCast = document.querySelector(".home-stage-cast");
const homeNormalModeBtn = document.getElementById("homeNormalModeBtn");
const homeChallengeModeBtn = document.getElementById("homeChallengeModeBtn");
const battleHomeBtn = document.getElementById("battleHomeBtn");
const legend = document.getElementById("legend");
const modal = document.getElementById("modal");
const modalCard = document.querySelector(".modal-card");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalActions = document.getElementById("modalActions");
const modalArt = document.getElementById("modalArt");
const modalDetail = document.getElementById("modalDetail");
const modalBackButton = document.getElementById("modalBackButton");
const bossWarning = document.getElementById("bossWarning");
const tutorialCoach = document.getElementById("tutorialCoach");
const dailyTaskDot = document.getElementById("dailyTaskDot");
const armyReportDot = document.getElementById("armyReportDot");
let currentView = "home";
let lastSavedProgress = "";
let progressStorageUnavailable = false;

function saveProgress() {
  if (progressStorageUnavailable) return;
  const progress = JSON.stringify({
    heroLevel: state.heroLevel,
    heroExp: state.heroExp,
    heroBreakthrough: state.heroBreakthrough,
    gold: state.gold,
    yuanbao: state.yuanbao,
    highestUnlockedLevel: state.highestUnlockedLevel,
    stamina: state.stamina,
    staminaLastRegenAt: state.staminaLastRegenAt,
    staminaRefillDate: state.staminaRefillDate,
    staminaPurchaseUsed: state.staminaPurchaseUsed,
    staminaAdUsed: state.staminaAdUsed,
    shopAdDate: state.shopAdDate,
    shopAdUsed: state.shopAdUsed,
    stageChests: state.stageChests,
    challengeChests: state.challengeChests,
    challengeAttemptsDate: state.challengeAttemptsDate,
    challengeAttempts: state.challengeAttempts,
    armyReport: {
      active: state.armyReport.active,
      totalTriggered: state.armyReport.totalTriggered,
      totalCleared: state.armyReport.totalCleared,
      pityDate: state.armyReport.pityDate,
      pityMisses: state.armyReport.pityMisses,
      pityUsed: state.armyReport.pityUsed,
    },
    tutorialComplete: state.tutorialStep >= 5,
    dailyDate: state.dailyDate,
    dailyProgress: state.dailyProgress,
    dailyClaimed: state.dailyClaimed,
    dailyLoginClaimed: state.dailyLoginClaimed,
    mainQuestIndex: state.mainQuestIndex,
    mainQuestStats: state.mainQuestStats,
    equipmentInventory: state.equipmentInventory,
    equipmentNextId: state.equipmentNextId,
    warriorEquipment: state.warriorEquipment,
    warriorQuality: state.warriorQuality,
    selectedWarriorType: state.selectedWarriorType,
    warriorPermanentStats: state.warriorPermanentStats,
    equipmentDropMisses: state.equipmentDropMisses,
    forgeEnhanceStone: state.forgeEnhanceStone,
    forgeStarStone: state.forgeStarStone,
    forge: state.forge,
  });
  if (progress === lastSavedProgress) return;
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, progress);
    lastSavedProgress = progress;
  } catch (error) {
    progressStorageUnavailable = true;
    console.warn("Progress storage unavailable; using this session only.", error);
  }
}

function loadProgress() {
  try {
    const progress = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || "null");
    if (!progress || typeof progress !== "object") return;
    const readInteger = (key, fallback, minimum, maximum) => Number.isSafeInteger(progress[key])
      ? Math.max(minimum, Math.min(maximum, progress[key])) : fallback;
    state.heroLevel = readInteger("heroLevel", 1, 1, HERO_MAX_LEVEL);
    state.heroExp = readInteger("heroExp", 0, 0, 2000000000000);
    state.heroBreakthrough = readInteger("heroBreakthrough", 0, 0, Math.floor(state.heroLevel / 10));
    state.heroLevel = Math.min(state.heroLevel, (state.heroBreakthrough + 1) * 10);
    state.maxHp = 4 + state.heroLevel - 1;
    state.gold = readInteger("gold", 0, 0, Number.MAX_SAFE_INTEGER);
    state.yuanbao = readInteger("yuanbao", 0, 0, Number.MAX_SAFE_INTEGER);
    state.highestUnlockedLevel = readInteger("highestUnlockedLevel", 1, 1, 1000000);
    state.level = state.selectedLevel = state.highestUnlockedLevel;
    state.stamina = readInteger("stamina", STARTING_STAMINA, 0, STAMINA_OVERFLOW_LIMIT);
    state.staminaLastRegenAt = readInteger("staminaLastRegenAt", Date.now(), 0, Date.now());
    if (progress.staminaRefillDate === getDayKey()) {
      state.staminaPurchaseUsed = progress.staminaPurchaseUsed === true;
      state.staminaAdUsed = progress.staminaAdUsed === true;
    }
    if (progress.shopAdDate === getDayKey()) {
      state.shopAdUsed = Number.isSafeInteger(progress.shopAdUsed)
        ? Math.max(0, Math.min(SHOP_AD_DAILY_LIMIT, progress.shopAdUsed)) : 0;
    }
    if (progress.stageChests && typeof progress.stageChests === "object" && !Array.isArray(progress.stageChests)) {
      state.stageChests = { ...progress.stageChests };
    }
    if (progress.challengeChests && typeof progress.challengeChests === "object" && !Array.isArray(progress.challengeChests)) {
      state.challengeChests = { ...progress.challengeChests };
    }
    if (progress.challengeAttemptsDate === getDayKey() && progress.challengeAttempts && typeof progress.challengeAttempts === "object") {
      state.challengeAttemptsDate = progress.challengeAttemptsDate;
      state.challengeAttempts = Object.fromEntries(Object.entries(progress.challengeAttempts)
        .filter(([key, value]) => /^\d+$/.test(key) && Number.isSafeInteger(value))
        .map(([key, value]) => [key, Math.max(0, Math.min(CHALLENGE_MODE_CONFIG.dailyAttemptLimit, value))]));
    }
    if (progress.armyReport && typeof progress.armyReport === "object") {
      const saved = progress.armyReport;
      state.armyReport.totalTriggered = Number.isSafeInteger(saved.totalTriggered)
        ? Math.max(0, saved.totalTriggered) : 0;
      state.armyReport.totalCleared = Number.isSafeInteger(saved.totalCleared)
        ? Math.max(0, saved.totalCleared) : 0;
      const active = saved.active;
      if (active && Number.isFinite(active.expiresAt) && active.expiresAt > Date.now()) {
        state.armyReport.active = {
          id: Number.isSafeInteger(active.id) ? active.id : state.armyReport.totalTriggered,
          spawnedAt: Number.isFinite(active.spawnedAt) ? active.spawnedAt : Date.now(),
          expiresAt: active.expiresAt,
          message: typeof active.message === "string" && active.message
            ? active.message : ARMY_REPORT_MESSAGES[0],
          source: "restore",
        };
      }
    }
    // 保底计数：只继承同一自然日的进度；旧存档或跨日一律清零（不依赖 state 初值）
    const savedReport = (progress.armyReport && typeof progress.armyReport === "object")
      ? progress.armyReport : null;
    const pitySameDay = Boolean(savedReport) && savedReport.pityDate === getDayKey();
    state.armyReport.pityDate = getDayKey();
    state.armyReport.pityMisses = pitySameDay && Number.isSafeInteger(savedReport.pityMisses)
      ? Math.max(0, Math.min(ARMY_REPORT_CONFIG.pityMissRequired, savedReport.pityMisses)) : 0;
    state.armyReport.pityUsed = pitySameDay && Number.isSafeInteger(savedReport.pityUsed)
      ? Math.max(0, Math.min(ARMY_REPORT_CONFIG.pityDailyLimit, savedReport.pityUsed)) : 0;
    // 离线时间不计入「持续在线」：重连后重新起算下一次侦查
    state.armyReport.nextCheckAt = Date.now() + ARMY_REPORT_CONFIG.checkIntervalMs;
    state.tutorialStep = progress.tutorialComplete ? 5 : 0;
    state.dailyDate = typeof progress.dailyDate === "string" ? progress.dailyDate : getDayKey();
    state.dailyProgress = { ...state.dailyProgress, ...(progress.dailyProgress || {}) };
    state.dailyClaimed = { ...(progress.dailyClaimed || {}) };
    state.dailyLoginClaimed = progress.dailyLoginClaimed === true;
    state.mainQuestIndex = readInteger("mainQuestIndex", 0, 0, MAIN_QUESTS.length);
    if (progress.mainQuestStats && typeof progress.mainQuestStats === "object") {
      Object.keys(state.mainQuestStats).forEach((key) => {
        const value = progress.mainQuestStats[key];
        if (Number.isSafeInteger(value)) state.mainQuestStats[key] = Math.max(0, value);
      });
    }
    state.equipmentInventory = Array.isArray(progress.equipmentInventory) ? progress.equipmentInventory : [];
    state.equipmentNextId = Number.isSafeInteger(progress.equipmentNextId) ? progress.equipmentNextId : 1;
    state.warriorEquipment = { ...state.warriorEquipment, ...(progress.warriorEquipment || {}) };
    state.warriorQuality = { ...state.warriorQuality, ...(progress.warriorQuality || {}) };
    if (WARRIORS.some((entry) => entry.type === progress.selectedWarriorType)) state.selectedWarriorType = progress.selectedWarriorType;
    state.warriorPermanentStats = { ...state.warriorPermanentStats, ...(progress.warriorPermanentStats || {}) };
    state.equipmentDropMisses = Number.isSafeInteger(progress.equipmentDropMisses)
      ? Math.max(0, progress.equipmentDropMisses) : 0;
    state.forgeEnhanceStone = readInteger("forgeEnhanceStone", state.forgeEnhanceStone, 0, Number.MAX_SAFE_INTEGER);
    state.forgeStarStone = readInteger("forgeStarStone", state.forgeStarStone, 0, Number.MAX_SAFE_INTEGER);
    if (progress.forge && typeof progress.forge === "object") {
      ["sword", "fan", "rock"].forEach((type) => {
        const source = progress.forge[type];
        if (!source || typeof source !== "object") return;
        const bag = state.forge[type];
        EQUIPMENT_SLOTS.forEach(({ id }) => {
          const row = source[id];
          if (!row || typeof row !== "object") return;
          bag[id] = {
            enh: Math.max(0, Math.floor(Number(row.enh) || 0)),
            star: Math.max(0, Math.min(FORGE_CONFIG.starMax, Math.floor(Number(row.star) || 0))),
          };
        });
      });
    }
  } catch (error) {
    console.warn("Unable to restore progress; starting with defaults.", error);
  }
}
let homeSwipeStartX = null;

function makeEmptyBoard() {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null);
}

function indexToPos(index) {
  return { c: index % BOARD_SIZE, r: Math.floor(index / BOARD_SIZE) };
}

function posToIndex(c, r) {
  return r * BOARD_SIZE + c;
}

function rand(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function refreshChallengeState() {
  const today = getDayKey();
  if (state.challengeAttemptsDate === today) return;
  state.challengeAttemptsDate = today;
  state.challengeAttempts = {};
  saveProgress();
}

function isChallengeMode() {
  return Boolean(state.challengeMode && !isBeastRaid());
}

function challengeAttemptCount(level = state.selectedLevel) {
  refreshChallengeState();
  return Number(state.challengeAttempts[String(level)]) || 0;
}

function challengeAttemptsRemaining(level = state.selectedLevel) {
  return Math.max(0, CHALLENGE_MODE_CONFIG.dailyAttemptLimit - challengeAttemptCount(level));
}

function isChallengeUnlocked(level = state.selectedLevel) {
  const mask = Number.isSafeInteger(state.stageChests[String(level)])
    ? state.stageChests[String(level)] : 0;
  return state.highestUnlockedLevel >= level && (mask & (1 << 2)) !== 0;
}

function challengeRoundsForLevel(level = state.level) {
  return getRoundsForLevel(level) + randBetween(CHALLENGE_MODE_CONFIG.extraWavesMin, CHALLENGE_MODE_CONFIG.extraWavesMax);
}

function stageRewardMultiplier() {
  return isChallengeMode() ? state.challengeRewardMultiplier : 1;
}

function stageChestMeta(challenge = isChallengeMode()) {
  return challenge
    ? STAGE_CHEST_META.map((meta) => ({ ...meta, amount: meta.amount * 3 }))
    : STAGE_CHEST_META;
}

function getForgeProgressionTier(level = state.highestUnlockedLevel) {
  const currentLevel = Math.max(1, Math.floor(Number(level) || 1));
  return FORGE_ECONOMY.progressionTiers.find((tier) => currentLevel <= tier.maxLevel)
    || FORGE_ECONOMY.progressionTiers[FORGE_ECONOMY.progressionTiers.length - 1];
}

function getDailyTaskReward(id) {
  const tier = getForgeProgressionTier();
  // 白名单表：未登记的任务返回全 0 —— 原来的兜底 return 会把新增任务误当成 kill 的奖励
  const table = {
    play: { gold: 80, yuanbao: 0, enhance: tier.dailyEnhance[0], star: 0 },
    clear: { gold: 120, yuanbao: 0, enhance: tier.dailyEnhance[1], star: 0 },
    kill: { gold: 0, yuanbao: 10, enhance: 0, star: tier.dailyStar },
    // 军报：事件驱动（随机触发、一天至多遇到一两次），给元宝，和主线任务区分开
    beast: { gold: 150, yuanbao: 20, enhance: 0, star: 0 },
    // 强化/升星：返「一半」材料（至少 1），引导玩家体验养成，但不足以成为刷材料出口
    enhance: { gold: 80, yuanbao: 0, enhance: Math.max(1, Math.floor(tier.dailyEnhance[0] / 2)), star: 0 },
    star: { gold: 80, yuanbao: 0, enhance: 0, star: Math.max(1, Math.ceil(tier.dailyStar / 2)) },
  };
  return table[id] || { gold: 0, yuanbao: 0, enhance: 0, star: 0 };
}

function formatDailyTaskReward(id) {
  const reward = getDailyTaskReward(id);
  const parts = [];
  if (reward.gold > 0) parts.push(`金币 +${reward.gold}`);
  if (reward.yuanbao > 0) parts.push(`元宝 +${reward.yuanbao}`);
  if (reward.enhance > 0) parts.push(`强化石 +${reward.enhance}`);
  if (reward.star > 0) parts.push(`升星石 +${reward.star}`);
  return parts.join(" · ");
}

function refreshDailyState() {
  const today = getDayKey();
  if (state.dailyDate === today) return;
  state.dailyDate = today;
  state.dailyProgress = makeDailyProgress();
  state.dailyClaimed = {};
  state.dailyLoginClaimed = false;
  saveProgress();
}

function updateDailyProgress(id, amount = 1) {
  refreshDailyState();
  const task = DAILY_TASKS.find((entry) => entry.id === id);
  if (!task || state.dailyClaimed[id]) return;
  state.dailyProgress[id] = Math.min(task.target, (state.dailyProgress[id] || 0) + amount);
  saveProgress();
}

function getDailyClaimableCount() {
  refreshDailyState();
  return DAILY_TASKS.filter((task) => !state.dailyClaimed[task.id]
    && state.dailyProgress[task.id] >= task.target).length;
}

function claimDailyLogin() {
  refreshDailyState();
  if (state.dailyLoginClaimed) return;
  state.dailyLoginClaimed = true;
  state.gold += 50;
  saveProgress();
}

function claimDailyTask(id) {
  refreshDailyState();
  const task = DAILY_TASKS.find((entry) => entry.id === id);
  if (!task || state.dailyClaimed[id] || state.dailyProgress[id] < task.target) return;
  state.dailyClaimed[id] = true;
  const reward = getDailyTaskReward(id);
  state.gold += reward.gold;
  state.yuanbao += reward.yuanbao;
  state.forgeEnhanceStone += reward.enhance;
  state.forgeStarStone += reward.star;
  saveProgress();
}

function totalEquippedCount() {
  return Object.values(state.warriorEquipment).reduce(
    (total, slots) => total + Object.values(slots || {}).filter(Boolean).length,
    0,
  );
}

function currentMainQuest() {
  return MAIN_QUESTS[state.mainQuestIndex] || null;
}

function getMainQuestProgress(task = currentMainQuest()) {
  if (!task) return 0;
  if (task.type === "level") return Math.min(task.target, Math.max(0, state.highestUnlockedLevel - 1));
  if (task.type === "equip") return Math.min(task.target, totalEquippedCount());
  return Math.min(task.target, state.mainQuestStats[task.type] || 0);
}

function updateMainQuestStat(type, amount = 1) {
  if (!Object.prototype.hasOwnProperty.call(state.mainQuestStats, type)) return;
  state.mainQuestStats[type] = Math.max(0, (state.mainQuestStats[type] || 0) + amount);
}

function mainQuestRewardMarkup(reward = {}) {
  const entries = [
    ["gold", "icon-coin.png", "金币"],
    ["yuanbao", "home/premium.png", "元宝"],
    ["enhance", "ui/forge/stone-enhance.png", "强化石"],
    ["star", "ui/forge/stone-star.png", "升星石"],
  ].filter(([key]) => reward[key] > 0);
  return entries.map(([key, icon, label]) => `<span title="${label}"><img src="${ASSET}${icon}" alt="${label}" />${reward[key]}</span>`).join("");
}

function claimMainQuest() {
  const task = currentMainQuest();
  if (!task || getMainQuestProgress(task) < task.target) return false;
  const reward = task.reward || {};
  state.gold += reward.gold || 0;
  state.yuanbao += reward.yuanbao || 0;
  state.forgeEnhanceStone += reward.enhance || 0;
  state.forgeStarStone += reward.star || 0;
  state.mainQuestIndex = Math.min(MAIN_QUESTS.length, state.mainQuestIndex + 1);
  saveProgress();
  renderHomeHud();
  return true;
}

function jumpToMainQuest(task = currentMainQuest()) {
  if (!task) return;
  if (task.action === "battle") {
    state.selectedLevel = Math.min(state.highestUnlockedLevel, Math.max(1, task.target));
    renderHomeHud();
    startLevelFromHome();
    return;
  }
  if (task.action === "equipment") {
    showEquipmentGrowth(showHome);
    return;
  }
  if (task.action === "enhance" || task.action === "star") {
    forgeUi.tab = task.action;
    showForge(showHome);
  }
}

function renderHomeQuickTask() {
  const task = currentMainQuest();
  if (!task) {
    homeQuickTask.classList.remove("claimable");
    homeQuickTask.classList.add("complete");
    homeQuickTask.disabled = true;
    homeQuickTaskIndex.textContent = `${MAIN_QUESTS.length}/${MAIN_QUESTS.length}`;
    homeQuickTaskTitle.textContent = "主线任务已完成";
    homeQuickTaskFill.style.width = "100%";
    homeQuickTaskProgress.textContent = "完成";
    homeQuickTaskReward.innerHTML = "<span>更多任务后续开放</span>";
    homeQuickTaskAction.textContent = "已完成";
    return;
  }
  const progress = getMainQuestProgress(task);
  const completed = progress >= task.target;
  homeQuickTask.disabled = false;
  homeQuickTask.classList.remove("complete");
  homeQuickTask.classList.toggle("claimable", completed);
  homeQuickTaskIndex.textContent = `${state.mainQuestIndex + 1}/${MAIN_QUESTS.length}`;
  homeQuickTaskTitle.textContent = task.title;
  homeQuickTaskFill.style.width = `${Math.round(progress / task.target * 100)}%`;
  homeQuickTaskProgress.textContent = `${progress}/${task.target}`;
  homeQuickTaskReward.innerHTML = mainQuestRewardMarkup(task.reward);
  homeQuickTaskAction.textContent = completed ? "领取" : "前往";
  homeQuickTask.setAttribute("aria-label", `${task.title}，进度 ${progress}/${task.target}，${completed ? "可领取奖励" : "点击前往"}`);
}

// 每日任务「前往」：进行中的任务可一键跳到对应功能界面（仅文案表，未登记的 id 不渲染按钮）
const DAILY_TASK_JUMP_LABEL = {
  play: "前往出击",
  clear: "前往出击",
  kill: "前往出击",
  beast: "前往军报",
  enhance: "前往强化",
  star: "前往升星",
};

function jumpToDailyTask(id) {
  const label = DAILY_TASK_JUMP_LABEL[id];
  if (!label) return;
  hideModal();
  if (id === "play" || id === "clear" || id === "kill") {
    // 出击类任务：回主页并开战（局内已有战局则直接「继续守城」，体力不足时走既有补给弹窗）
    showHome();
    startLevelFromHome();
    return;
  }
  if (id === "beast") {
    // 军报未初始化属于异常态，回主页兜底，避免点了按钮什么都不发生
    if (!state.armyReport) {
      showHome();
      return;
    }
    showArmyReport();
    return;
  }
  if (id === "enhance" || id === "star") {
    if (FORGE_UNLOCKED_TABS.indexOf(id) >= 0) forgeUi.tab = id;
    showForge(showHome);
  }
}

function showDailyTasks() {
  refreshDailyState();
  showModal("每日任务", "完成任务领取奖励，每天 00:00 自动刷新。", [
    { label: state.dailyLoginClaimed ? "登录奖励已领取" : "领取登录奖励 · 金币 +50", disabled: state.dailyLoginClaimed, onClick: () => {
      claimDailyLogin();
      renderHomeHud();
      showDailyTasks();
    } },
    { label: "领取已完成", onClick: () => {
      DAILY_TASKS.forEach((task) => claimDailyTask(task.id));
      renderHomeHud();
      showDailyTasks();
    } },
  ], { backAction: showHome });
  /* 列表型面板：滚动权交给任务列表，底部按钮常驻，避免整张卡片被拖着滚 */
  modalCard.classList.add("daily-modal");
  const list = document.createElement("div");
  list.className = "daily-task-list";
  DAILY_TASKS.forEach((task) => {
    const progress = Math.min(task.target, state.dailyProgress[task.id] || 0);
    const claimed = Boolean(state.dailyClaimed[task.id]);
    const completed = progress >= task.target;
    const row = document.createElement("div");
    row.className = `daily-task-row${completed ? " done" : ""}${claimed ? " claimed" : ""}`;
    row.innerHTML = `<div><strong>${task.title}</strong><small>${progress}/${task.target} · ${formatDailyTaskReward(task.id)}</small></div><b>${claimed ? "已领取" : completed ? "可领取" : "进行中"}</b>`;
    // 只有「进行中」的任务给前往入口；已完成 / 已领取走底部领奖按钮
    if (!claimed && !completed && DAILY_TASK_JUMP_LABEL[task.id]) {
      const jump = document.createElement("button");
      jump.type = "button";
      jump.className = "daily-task-jump";
      jump.dataset.dailyJump = task.id;
      jump.setAttribute("aria-label", `${DAILY_TASK_JUMP_LABEL[task.id]}：${task.title}`);
      jump.innerHTML = `${DAILY_TASK_JUMP_LABEL[task.id]}<i>\u203a</i>`;
      jump.addEventListener("click", () => jumpToDailyTask(task.id));
      row.appendChild(jump);
    }
    list.appendChild(row);
  });
  modalDetail.appendChild(list);
}

function finishRewardedAd(completed) {
  const ad = state.adPlayback;
  if (!ad) return;
  clearInterval(ad.timer);
  state.adPlayback = null;
  hideModal();
  state.phase = ad.previousPhase;
  if (completed && ad.elapsed >= ad.duration) ad.onComplete();
  render();
  if (currentView === "battle" && state.phase === "combat") runLoop();
}

const AdService = {
  showRewarded({ placement, onComplete, previousPhase = state.phase, duration = REWARDED_AD_DURATION_MS }) {
    if (state.adPlayback) return false;
    const ad = { placement, onComplete, previousPhase, duration, elapsed: 0, timer: null };
    state.adPlayback = ad;
    if (currentView === "battle") {
      state.phase = "hint-ad";
      stopLoop();
    }
    showModal("激励广告（试玩）", `${placement} · 看完广告后领取奖励。`, [
      { label: `广告播放中 · ${Math.ceil(duration / 1000)}秒`, disabled: true, onClick: () => finishRewardedAd(true) },
      { label: "关闭广告", secondary: true, onClick: () => finishRewardedAd(false) },
    ]);
    const rewardButton = modalActions.querySelector("button");
    let lastTime = performance.now();
    ad.timer = setInterval(() => {
      if (state.adPlayback !== ad) return;
      const now = performance.now();
      ad.elapsed = Math.min(duration, ad.elapsed + Math.min(250, now - lastTime));
      lastTime = now;
      const remaining = Math.ceil((duration - ad.elapsed) / 1000);
      rewardButton.textContent = remaining > 0 ? `广告播放中 · ${remaining}秒` : "领取奖励";
      rewardButton.disabled = remaining > 0;
      if (!remaining) clearInterval(ad.timer);
    }, 100);
    return true;
  },
};

function renderTutorialCoach() {
  const messages = {
    2: "拖动或点选上下左右相邻的棋子换位，尝试让 3 个同类棋子连成一线。",
    3: "继续消除，自动连锁完成后，棋子会从棋盘下方补满。",
    4: "操作完成后点击“出怪”，观察武将攻击并守住防线。",
  };
  tutorialCoach.textContent = messages[state.tutorialStep] || "";
  tutorialCoach.classList.toggle("hidden", !state.tutorialActive || !messages[state.tutorialStep]);
}

function advanceTutorial(step) {
  if (!state.tutorialActive || state.tutorialStep >= 5) return;
  state.tutorialStep = Math.max(state.tutorialStep, step);
  renderTutorialCoach();
}

function startTutorial() {
  if (state.tutorialStep >= 5 || currentView !== "home") return;
  showModal("新手训练", "先完成一次简单守城，熟悉交换消除、自动补位和武将攻击。", [
    { label: "开始教学", onClick: () => {
      state.tutorialActive = true;
      state.tutorialStep = 2;
      startLevelFromHome();
      renderTutorialCoach();
    } },
    { label: "跳过", secondary: true, onClick: () => {
      state.tutorialStep = 5;
      state.tutorialActive = false;
      saveProgress();
    } },
  ]);
}

function getRoundsForLevel(level) {
  return Math.min(7, Math.max(3, Math.max(1, level)));
}

function getWaveProfile(level, round) {
  const ch = getChapter(level);
  // 章节名册按“易→难”排列，波次越靠后越难；超出名册长度时取最难的怪
  return ch.roster[Math.min(ch.roster.length - 1, Math.max(0, round - 1))] || "normal";
}

function shuffled(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function weightedType() {
  const pool = [
    "rock", "rock", "rock",
    "sword", "sword", "sword",
    "fan", "fan",
    "gourd",
    "coin",
    "chest",
    "trap",
    "mine",
  ];
  return rand(pool);
}

function newPiece(type = weightedType(), tier = 1, effects = {}) {
  return { id: state.nextPieceId++, type, tier, ...effects };
}

function seedBoard() {
  state.board = makeEmptyBoard();
  const preferredTypes = new Map([
    [0, "sword"], [1, "sword"],
    [6, "fan"], [12, "fan"],
    [8, "rock"], [9, "rock"],
    [16, "gourd"], [17, "gourd"],
    [25, "coin"], [31, "coin"],
    [22, "chest"], [28, "trap"], [34, "mine"],
  ]);
  const typePool = Object.keys(TYPES).flatMap((type) => (
    type === "rock" || type === "sword" ? [type, type, type] : [type, type]
  ));
  state.board.forEach((piece, index) => {
    const candidates = [
      preferredTypes.get(index),
      ...shuffled(typePool),
    ].filter((type, candidateIndex, values) => type && values.indexOf(type) === candidateIndex);
    const safeType = candidates.find((type) => {
      state.board[index] = newPiece(type);
      const safe = findLineMatch(index).length < 3;
      if (!safe) state.board[index] = null;
      return safe;
    });
    if (!safeType) {
      throw new Error(`Unable to seed a safe piece at index ${index}`);
    }
  });
}

function renderLegend() {
  legend.innerHTML = Object.entries(TYPES).map(([key, type]) => `
    <div class="legend-item">
      <img src="${ASSET}${type.icon}" alt="${type.name}" />
      <div>
        <b>${type.name}</b>
        <span>${type.desc}</span>
      </div>
    </div>
  `).join("");
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.classList.toggle("resolving", state.resolving);
  boardEl.setAttribute("aria-busy", String(state.resolving));
  state.board.forEach((piece, index) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.index = String(index);
    cell.setAttribute("role", "gridcell");
    cell.addEventListener("click", () => handleCellClick(index));
    cell.addEventListener("dragover", (event) => event.preventDefault());
    cell.addEventListener("drop", (event) => {
      event.preventDefault();
      const from = Number(event.dataTransfer.getData("text/plain"));
      tryMove(from, index);
    });

    if (state.selected === index) cell.classList.add("selected");

    if (piece) {
      const type = TYPES[piece.type];
      const level = piece.tier || 1;
      cell.classList.add(`quality-tier-${Math.min(6, Math.max(1, level))}`);
      cell.setAttribute("aria-label", `${type.name} ${level} 级，第 ${Math.floor(index / BOARD_SIZE) + 1} 行第 ${index % BOARD_SIZE + 1} 列`);
      const warrior = getWarriorAppearance(piece.type);
      const item = document.createElement("div");
      item.className = `piece tier-${level}${warrior ? " warrior-piece" : ""}`;
      item.dataset.type = piece.type;
      item.dataset.level = String(level);
      if (warrior) {
        item.dataset.quality = String(warrior.quality);
        const [left, top, right, bottom] = warrior.modelBounds[warrior.modelQuality - 1];
        const scale = 0.94 * 320 / Math.max(right - left, bottom - top);
        item.style.setProperty("--model-size", `${scale * 100}%`);
        item.style.setProperty("--model-left", `${50 - (left + right) / 2 / 320 * scale * 100}%`);
        item.style.setProperty("--model-top", `${50 - (top + bottom) / 2 / 320 * scale * 100}%`);
      }
      if (piece.entering) {
        item.classList.add("supplying");
        const { r } = indexToPos(index);
        item.style.setProperty("--supply-distance", `${(BOARD_SIZE - r) * 112}%`);
        item.style.setProperty("--supply-delay", `${(BOARD_SIZE - 1 - r) * 35}ms`);
      }
      item.draggable = state.phase === "setup" && !state.resolving;
      item.addEventListener("dragstart", (event) => {
        if (state.phase !== "setup" || state.resolving) return event.preventDefault();
        event.dataTransfer.setData("text/plain", String(index));
        state.selected = index;
      });
      item.innerHTML = `
        <img src="${ASSET}${warrior ? warrior.idleImage : type.icon}" alt="${type.name}"${warrior ? ` data-action="idle" data-model-quality="${warrior.modelQuality}"` : ""} />
      `;
      cell.appendChild(item);
      if (piece.rangeFlash) {
        delete piece.rangeFlash;
        requestAnimationFrame(() => {
          if (state.board[index] === piece) rangeFlashAt(index, piece.type, level);
        });
      }
      const levelBadge = document.createElement("span");
      levelBadge.className = "level-badge";
      levelBadge.textContent = String(level);
      levelBadge.setAttribute("aria-label", `${type.name} ${level} 级`);
      cell.appendChild(levelBadge);
    }
    boardEl.appendChild(cell);
  });
  renderMergeHint();
  if (state.shuffleAnimationPending) {
    state.shuffleAnimationPending = false;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      boardEl.animate([{ opacity: 0.45, transform: "scale(.97)" }, { opacity: 1, transform: "scale(1)" }], { duration: 260 });
    }
  }
}

function getHeroBreakthroughCost() {
  return HERO_BREAKTHROUGH_COST + state.heroBreakthrough * 100;
}

function qualityInfo(quality) {
  return EQUIPMENT_QUALITY[Math.max(0, Math.min(EQUIPMENT_QUALITY.length - 1, quality - 1))];
}

function getWarriorAppearance(type, quality = state.warriorQuality[type] || 1) {
  const warrior = WARRIORS.find((entry) => entry.type === type);
  if (!warrior) return null;
  const modelQuality = Math.max(1, Math.min(6, Math.floor(Number(quality)) || 1));
  const path = `warriors/quality/${warrior.modelRole}/${modelQuality}`;
  return { ...warrior, quality, modelQuality, idleImage: `${path}/idle.webp`, attackImage: `${path}/attack.webp`, previewImage: `${path}/preview.webp` };
}

function preloadWarriorAppearance(type) {
  const appearance = getWarriorAppearance(type);
  if (!appearance) return;
  [appearance.idleImage, appearance.attackImage, appearance.previewImage].forEach((path) => {
    if (warriorImageCache.has(path)) return;
    const image = new Image();
    image.src = `${ASSET}${path}`;
    warriorImageCache.set(path, image);
  });
}

function slotInfo(slot) {
  return EQUIPMENT_SLOTS.find((entry) => entry.id === slot) || EQUIPMENT_SLOTS[0];
}

function equipmentName(equipment) {
  const quality = qualityInfo(equipment.quality);
  return `${quality.prefix}${slotInfo(equipment.slot).name}`;
}

function formatStatValue(value, stat) {
  return `${Math.round(value)}${stat === "speed" ? "%" : ""}`;
}

function equipmentValueText(item) {
  return formatStatValue(item.value, slotInfo(item.slot).stat);
}

function chooseEquipmentQuality() {
  const table = [...EQUIPMENT_DROP_TABLES].reverse().find(({ minLevel }) => state.level >= minLevel)
    || EQUIPMENT_DROP_TABLES[0];
  const roll = Math.random();
  let cursor = 0;
  return table.weights.findIndex((weight) => {
    cursor += weight;
    return roll < cursor;
  }) + 1;
}

function createEquipment(slot, quality) {
  const info = slotInfo(slot);
  const qualityData = qualityInfo(quality);
  const base = EQUIPMENT_BASE_VALUES[slot] || 1;
  return {
    id: state.equipmentNextId++,
    slot,
    quality,
    value: Math.round(base * qualityData.coefficient),
  };
}

function warriorEquipmentFor(type) {
  if (!state.warriorEquipment[type]) state.warriorEquipment[type] = {};
  return state.warriorEquipment[type];
}

/* 武将属性的唯一出口：局内战斗、局外面板、战力计算全部读这里，
   保证「装备基础值 + 强化 + 升星」这套养成在局内局外完全一致，不会出现「战力涨了实战没动」。
   性能：attackMonsters 每帧都要取，故按「影响属性的状态签名」做缓存。 */
let warriorBonusCache = new Map();

function warriorBonusSignature(type) {
  const permanent = state.warriorPermanentStats?.[type] || {};
  const bag = (state.forge && state.forge[type]) || {};
  const worn = warriorEquipmentFor(type);
  let signature = `${forgeRoleLevel()}#${permanent.attack || 0},${permanent.crit || 0},${permanent.hit || 0},${permanent.speed || 0}`;
  EQUIPMENT_SLOTS.forEach(({ id }) => {
    const item = worn[id];
    const row = bag[id];
    signature += `|${id}:${item ? `${item.id}.${item.value}.${item.quality}` : "-"}:${row && typeof row === "object" ? `${row.enh || 0}.${row.star || 0}` : "0.0"}`;
  });
  return signature;
}

function getWarriorBonuses(type) {
  const signature = warriorBonusSignature(type);
  const cached = warriorBonusCache.get(type);
  if (cached && cached.signature === signature) return cached.bonuses;
  const bonuses = { attack: 0, crit: 0, hit: 0, speed: 0 };
  const permanent = state.warriorPermanentStats?.[type] || {};
  Object.keys(bonuses).forEach((key) => { bonuses[key] += permanent[key] || 0; });
  EQUIPMENT_SLOTS.forEach(({ id, stat }) => { bonuses[stat] += forgeSlotStatValue(type, id); });
  const master = warriorMasterPercent(type);
  Object.keys(bonuses).forEach((key) => {
    bonuses[key] = Math.round(bonuses[key] * (1 + (master[key] || 0) / 100));
  });
  warriorBonusCache.set(type, { signature, bonuses });
  return bonuses;
}

function getWarriorCombatStats(type) {
  const bonuses = getWarriorBonuses(type);
  return { ...bonuses, hit: bonuses.hit + COMBAT_RATING_CONFIG.baseHit, crit: bonuses.crit + COMBAT_RATING_CONFIG.baseCrit };
}

function getHitChance(hitValue, dodgeValue) {
  const hit = Math.max(0, hitValue || 0);
  const dodge = Math.max(0, dodgeValue || 0);
  return hit >= dodge ? 1 : hit / dodge;
}

function getCriticalChance(critValue, resilienceValue) {
  const difference = Math.max(0, (critValue || 0) - (resilienceValue || 0));
  return Math.max(0, Math.min(1, (difference * COMBAT_RATING_CONFIG.criticalCoefficient + COMBAT_RATING_CONFIG.criticalFlatPercent) / 100));
}

function resolveWarriorAttack(stats, monster, baseDamage, random = Math.random) {
  const hitChance = getHitChance(stats.hit, monster.dodge);
  if (hitChance <= 0 || (hitChance < 1 && random() >= hitChance)) return { hit: false, critical: false, damage: 0 };
  const criticalChance = getCriticalChance(stats.crit, monster.resilience);
  const critical = criticalChance >= 1 || (criticalChance > 0 && random() < criticalChance);
  return { hit: true, critical, damage: baseDamage * (critical ? COMBAT_RATING_CONFIG.criticalDamageMultiplier : 1) };
}

function getEquipmentSetStatus(type) {
  const quality = state.warriorQuality[type] || 1;
  const equipment = warriorEquipmentFor(type);
  const equipped = EQUIPMENT_SLOTS.map(({ id }) => equipment[id]).filter(Boolean);
  return {
    quality,
    complete: equipped.length === EQUIPMENT_SLOTS.length && equipped.every((item) => item.quality === quality),
    count: equipped.length,
  };
}

function equipEquipment(equipmentId, type = state.selectedWarriorType) {
  if (!canManageHero()) return false;
  const index = state.equipmentInventory.findIndex((item) => item.id === equipmentId);
  if (index < 0) return false;
  const equipment = state.equipmentInventory[index];
  const quality = state.warriorQuality[type] || 1;
  if (equipment.quality !== quality) return false;
  const worn = warriorEquipmentFor(type);
  if (worn[equipment.slot]) state.equipmentInventory.push(worn[equipment.slot]);
  worn[equipment.slot] = equipment;
  state.equipmentInventory.splice(index, 1);
  updateMainQuestStat("equip");
  saveProgress();
  return true;
}

function getAutoEquipCandidates(type = state.selectedWarriorType) {
  const quality = state.warriorQuality[type] || 1;
  const worn = warriorEquipmentFor(type);
  return EQUIPMENT_SLOTS.filter(({ id }) => !worn[id])
    .map(({ id }) => state.equipmentInventory.find((item) => item.slot === id && item.quality === quality))
    .filter(Boolean);
}

function autoEquipEquipment(type = state.selectedWarriorType) {
  if (!canManageHero()) return 0;
  const candidates = getAutoEquipCandidates(type);
  return candidates.filter((item) => equipEquipment(item.id, type)).length;
}

function unequipEquipment(slot, type = state.selectedWarriorType) {
  if (!canManageHero()) return false;
  const equipment = warriorEquipmentFor(type)[slot];
  if (!equipment) return false;
  state.equipmentInventory.push(equipment);
  delete warriorEquipmentFor(type)[slot];
  saveProgress();
  return true;
}

function breakthroughWarrior(type) {
  if (!canManageHero()) return false;
  const status = getEquipmentSetStatus(type);
  if (!status.complete || status.quality >= MAX_WARRIOR_QUALITY) return false;
  const cost = EQUIPMENT_BREAKTHROUGH_COSTS[status.quality - 1] || 150;
  if (state.yuanbao < cost) return false;
  const permanent = state.warriorPermanentStats[type] || (state.warriorPermanentStats[type] = { attack: 0, crit: 0, hit: 0, speed: 0 });
  const equipment = warriorEquipmentFor(type);
  EQUIPMENT_SLOTS.forEach(({ id, stat }) => {
    permanent[stat] = (permanent[stat] || 0) + (equipment[id].value || 0);
  });
  state.yuanbao -= cost;
  state.warriorEquipment[type] = {};
  state.warriorQuality[type] = status.quality + 1;
  updateMainQuestStat("breakthrough");
  preloadWarriorAppearance(type);
  state.lastEquipmentDrop = null;
  saveProgress();
  return true;
}

function warriorBreakthroughPreview(type, quality) {
  const isMaxQuality = quality >= MAX_WARRIOR_QUALITY;
  const nextQuality = isMaxQuality ? quality : quality + 1;
  const currentQuality = qualityInfo(quality);
  const nextQualityData = qualityInfo(nextQuality);
  const nextAppearance = getWarriorAppearance(type, nextQuality);
  const nextSkill = isMaxQuality ? null : getNextWarriorBreakthroughSkill(type, quality);
  const retained = { attack: 0, crit: 0, hit: 0, speed: 0 };
  const worn = warriorEquipmentFor(type);
  EQUIPMENT_SLOTS.forEach(({ id, stat }) => {
    const item = worn[id];
    if (item) retained[stat] += item.value || 0;
  });
  const retainedText = [
    retained.attack ? "攻击 +" + Math.round(retained.attack) : "",
    retained.crit ? "暴击 +" + Math.round(retained.crit) : "",
    retained.hit ? "命中 +" + Math.round(retained.hit) : "",
    retained.speed ? "攻速 +" + Math.round(retained.speed) + "%" : "",
  ].filter(Boolean).join(" · ") || "穿齐装备后显示";
  const skillText = nextSkill ? `${nextSkill.name}：${nextSkill.description}` : "当前版本已解锁全部突破技能";
  return { nextQuality, currentQuality, nextQualityData, nextAppearance, retained, retainedText, skillText, isMaxQuality };
}

function grantEquipmentDrop() {
  if (state.equipmentDropGranted) return null;
  state.equipmentDropGranted = true;
  if (isChallengeMode()) {
    const count = Math.random() < CHALLENGE_MODE_CONFIG.equipmentDoubleChance ? 2 : 1;
    const ceiling = getMainlineEquipmentQualityCeiling(state.level);
    const items = Array.from({ length: count }, () => {
      const bonus = randBetween(CHALLENGE_MODE_CONFIG.equipmentQualityBonusMin, CHALLENGE_MODE_CONFIG.equipmentQualityBonusMax);
      const quality = Math.min(EQUIPMENT_QUALITY.length, ceiling + bonus);
      return createEquipment(rand(EQUIPMENT_SLOTS).id, quality);
    });
    state.equipmentInventory.push(...items);
    state.lastChallengeEquipmentDrops = items;
    state.lastEquipmentDrop = items[0] || null;
    saveProgress();
    return state.lastEquipmentDrop;
  }
  const pityDrop = state.equipmentDropMisses >= EQUIPMENT_DROP_PITY_MISSES;
  const onboardingGuaranteed = state.level === 1 && state.highestUnlockedLevel === 1
    && state.equipmentInventory.length + totalEquippedCount() === 0;
  if (!onboardingGuaranteed && !pityDrop && Math.random() >= EQUIPMENT_DROP_CHANCE) {
    state.equipmentDropMisses += 1;
    state.lastEquipmentDrop = null;
    saveProgress();
    return null;
  }
  state.equipmentDropMisses = 0;
  const slot = rand(EQUIPMENT_SLOTS).id;
  const quality = onboardingGuaranteed ? 1 : chooseEquipmentQuality();
  const equipment = createEquipment(slot, quality);
  state.equipmentInventory.push(equipment);
  state.lastEquipmentDrop = equipment;
  saveProgress();
  return equipment;
}

function grantSettlementAdEquipmentDrop() {
  if (state.settlementAdEquipmentDropGranted) return state.lastSettlementAdEquipmentDrop;
  state.settlementAdEquipmentDropGranted = true;
  if (Math.random() >= SETTLEMENT_AD_EQUIPMENT_CHANCE) {
    state.lastSettlementAdEquipmentDrop = null;
    return null;
  }
  const equipment = createEquipment(rand(EQUIPMENT_SLOTS).id, chooseEquipmentQuality());
  state.equipmentInventory.push(equipment);
  state.lastSettlementAdEquipmentDrop = equipment;
  saveProgress();
  return equipment;
}

function equipmentSalePrice(item) {
  return Math.round(10 * qualityInfo(item.quality).coefficient);
}

function getOwnedBagItems(ids) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return null;
  const inventory = new Map(state.equipmentInventory.map((item) => [item.id, item]));
  const wornIds = new Set(Object.values(state.warriorEquipment).flatMap((slots) => Object.values(slots)).filter(Boolean).map((item) => item.id));
  const items = ids.map((id) => inventory.get(id));
  return items.every((item) => item && !wornIds.has(item.id)) ? items : null;
}

function sellEquipment(ids) {
  if (!canManageHero()) return { ok: false, message: "战局进行中，暂不能出售装备" };
  const items = getOwnedBagItems(ids);
  if (!items) return { ok: false, message: "装备已发生变化，请重新选择" };
  const gold = items.reduce((total, item) => total + equipmentSalePrice(item), 0);
  const soldIds = new Set(ids);
  state.equipmentInventory = state.equipmentInventory.filter((item) => !soldIds.has(item.id));
  state.gold += gold;
  saveProgress();
  return { ok: true, gold, count: items.length };
}

function getSynthesisQuote(ids) {
  const materials = getOwnedBagItems(ids);
  if (!materials || materials.length !== 5) return { ok: false, message: "请选择 5 件同品质装备" };
  const quality = materials[0].quality;
  if (quality >= EQUIPMENT_QUALITY.length || materials.some((item) => item.quality !== quality)) {
    return { ok: false, message: "需要同品质材料，金色装备不可继续合成" };
  }
  return { ok: true, quality, cost: EQUIPMENT_SYNTHESIS_COSTS[quality - 1], rate: EQUIPMENT_SYNTHESIS_RATES[quality - 1] };
}

function synthesizeEquipment(ids) {
  if (!canManageHero()) return { ok: false, message: "战局进行中，暂不能合成装备" };
  const quote = getSynthesisQuote(ids);
  if (!quote.ok) return quote;
  if (state.gold < quote.cost) return { ok: false, message: "金币不足" };
  const consumedIds = new Set(ids);
  const success = Math.random() < quote.rate;
  const equipment = success ? createEquipment(rand(EQUIPMENT_SLOTS).id, quote.quality + 1) : null;
  const bonusGold = equipment && EQUIPMENT_SYNTHESIS_BONUS.enabled && Math.random() < EQUIPMENT_SYNTHESIS_BONUS.chance
    ? equipmentSalePrice(equipment) * EQUIPMENT_SYNTHESIS_BONUS.salePriceMultiplier : 0;
  state.gold += bonusGold - quote.cost;
  state.equipmentInventory = state.equipmentInventory.filter((item) => !consumedIds.has(item.id));
  if (equipment) state.equipmentInventory.push(equipment);
  saveProgress();
  return { ok: true, success, equipment, bonusGold, cost: quote.cost };
}

function canManageHero() {
  return !state.resolving && (state.phase === "settle"
    || (currentView === "home" && !state.levelStaminaSpent && state.phase === "setup"));
}

function needsHeroBreakthrough() {
  return state.heroLevel >= (state.heroBreakthrough + 1) * 10
    && state.heroBreakthrough < Math.floor((HERO_MAX_LEVEL - 1) / 10);
}

function formatCurrency(amount) {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}亿`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万`;
  return String(amount);
}

function getUnlockedHeroSkills() {
  return HERO_SKILLS.filter((skill) => skill.level <= state.heroLevel);
}

function getHeroSkillQueue() {
  const unlocked = getUnlockedHeroSkills();
  const skillsById = new Map(unlocked.map((skill) => [skill.id, skill]));
  const queued = Array.isArray(state.heroSkillQueue)
    ? state.heroSkillQueue.map((id) => skillsById.get(id)).filter(Boolean) : [];
  if (queued.length !== unlocked.length) return unlocked;
  return queued;
}

function getCurrentHeroSkill() {
  const skills = getHeroSkillQueue();
  return skills[state.heroSkillIndex % skills.length] || HERO_SKILLS[0];
}

function getHeroSkillStatus() {
  const skill = getCurrentHeroSkill();
  const cooldown = state.heroSkillCooldowns[skill.id] || 0;
  const ready = currentView === "battle"
    && state.phase === "combat"
    && !state.cardQueued
    && !state.hintAd
    && !state.adPlayback
    && cooldown <= 0;
  let label = "释放";
  let message = "可释放";
  if (currentView !== "battle" || state.phase === "setup") {
    label = "待战";
    message = "出怪后可释放";
  } else if (state.phase === "settle") {
    label = "结束";
    message = "本局已结束";
  } else if (state.phase !== "combat" || state.cardQueued || state.hintAd || state.adPlayback) {
    label = "暂停";
    message = "战斗暂停中";
  } else if (cooldown > 0) {
    label = `${Math.ceil(cooldown)}s`;
    message = "冷却中";
  }
  if (cooldown > 0) message += `，冷却剩余 ${Math.ceil(cooldown)} 秒`;
  return { skill, cooldown, ready, label, message };
}

function getFullLevelReward() {
  return LEVEL_GOLD_REWARD.base + state.level * LEVEL_GOLD_REWARD.step;
}

function getFullForgeMaterialReward() {
  const tier = getForgeProgressionTier(state.level);
  return { enhance: tier.levelEnhance, star: tier.levelStar, tier: tier.name };
}

function getFailureForgeMaterialReward() {
  const fullReward = getFullForgeMaterialReward();
  const factor = state.round * 3 / (state.maxRounds * 5);
  return {
    enhance: Math.floor(fullReward.enhance * factor * stageRewardMultiplier()),
    star: Math.floor(fullReward.star * factor * stageRewardMultiplier()),
    tier: fullReward.tier,
  };
}

function getFailureReward() {
  return Math.floor(getFullLevelReward() * state.round * 3 / (state.maxRounds * 5) * stageRewardMultiplier());
}

function refreshStamina() {
  const now = Date.now();
  if (state.staminaRefillDate !== getDayKey()) {
    state.staminaRefillDate = getDayKey();
    state.staminaPurchaseUsed = false;
    state.staminaAdUsed = false;
  }
  if (state.shopAdDate !== getDayKey()) {
    state.shopAdDate = getDayKey();
    state.shopAdUsed = 0;
  }
  // 自然恢复只补到基础上限；超过60的体力只能来自购买或广告。
  if (state.stamina >= MAX_STAMINA) {
    state.staminaLastRegenAt = now;
    return;
  }
  const recovered = Math.floor((now - state.staminaLastRegenAt) / STAMINA_REGEN_INTERVAL);
  if (recovered <= 0) return;
  state.stamina = Math.min(MAX_STAMINA, state.stamina + recovered);
  state.staminaLastRegenAt = state.stamina >= MAX_STAMINA
    ? now
    : state.staminaLastRegenAt + recovered * STAMINA_REGEN_INTERVAL;
}

function renderHud() {
  refreshStamina();
  stepsText.textContent = state.steps;
  goldText.textContent = formatCurrency(state.gold);
  yuanbaoText.textContent = formatCurrency(state.yuanbao);
  staminaText.textContent = `${state.stamina}/${state.maxStamina}`;
  levelText.textContent = isBeastRaid() ? "异兽入侵" : `${isChallengeMode() ? "挑战 " : ""}关卡 ${state.level}`;
  phaseText.textContent = state.phase === "setup"
    ? "操作期"
    : state.phase === "card" ? "选卡暂停" : state.phase === "hint-ad" ? "广告暂停" : "出怪期";
  roundText.textContent = `${isBossWave() ? "BOSS · " : ""}第 ${state.round}/${state.maxRounds} 波`;
  cardProgressText.textContent = `卡牌 ${state.cardsOffered}/6`;
  const hpPercent = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100));
  defenseHpText.textContent = `${state.hp} / ${state.maxHp}`;
  defenseHpFill.style.width = `${hpPercent}%`;
  defenseHpTrack.setAttribute("aria-valuemax", String(state.maxHp));
  defenseHpTrack.setAttribute("aria-valuenow", String(state.hp));
  defenseHpTrack.classList.toggle("critical", hpPercent <= 25);
  const needsStamina = state.round === 1 && !state.levelStaminaSpent;
  const waveStaminaCost = isChallengeMode() ? CHALLENGE_MODE_CONFIG.staminaCost : STAMINA_COST_PER_LEVEL;
  startWaveBtn.disabled = state.phase !== "setup"
    || state.resolving
    || (needsStamina && state.stamina < waveStaminaCost);
  startWaveBtn.textContent = "出怪";
  adStepsBtn.disabled = state.phase !== "setup" || state.resolving || state.steps >= 11;
  const hintsRemaining = Math.max(0, MAX_MERGE_HINTS - state.mergeHintsUsed);
  mergeHintBtn.disabled = !canRequestMergeHint();
  mergeHintCount.textContent = `${hintsRemaining}/${MAX_MERGE_HINTS}`;
  mergeHintBtn.classList.toggle("hint-active", state.hintIndices.length > 0);
  mergeHintBtn.setAttribute("aria-label", `观看广告提示可合成棋子，本局剩余 ${hintsRemaining} 次`);
  mergeHintBtn.title = hintsRemaining > 0
    ? `观看广告提示可消除棋子，本局剩余 ${hintsRemaining} 次`
    : "本局广告提示次数已用完";
  const shufflesRemaining = Math.max(0, MAX_BOARD_SHUFFLES - state.boardShufflesUsed);
  boardShuffleBtn.disabled = !canRequestBoardShuffle();
  boardShuffleCount.textContent = `${shufflesRemaining}/${MAX_BOARD_SHUFFLES}`;
  boardShuffleBtn.setAttribute("aria-label", `观看广告洗牌，本局剩余 ${shufflesRemaining} 次`);
  boardShuffleBtn.title = shufflesRemaining > 0
    ? `观看完整广告，随机调整棋子位置，本局剩余 ${shufflesRemaining} 次`
    : "本局广告洗牌次数已用完";
  staminaBtn.disabled = state.phase !== "setup" || state.resolving;
  battleHomeBtn.disabled = Boolean(state.hintAd || state.adPlayback);
  resetBtn.disabled = Boolean(state.hintAd || state.adPlayback);
  speedBtn.disabled = Boolean(state.hintAd || state.adPlayback);
  const skillStatus = getHeroSkillStatus();
  const { skill: currentSkill, cooldown: currentCooldown, ready: skillReady } = skillStatus;
  const skillProgress = Math.max(0, Math.min(1, 1 - currentCooldown / currentSkill.cooldown));
  heroSkillBtn.disabled = !skillReady;
  heroSkillBtn.classList.toggle("ready", skillReady);
  heroSkillBtn.style.setProperty("--skill-progress", `${skillProgress * 100}%`);
  heroSkillTimer.textContent = skillStatus.label;
  heroSkillBtn.title = `${currentSkill.name}：${skillStatus.message}。${currentSkill.description}`;
  heroSkillBtn.setAttribute("aria-label", currentSkill.name);
  if (heroSkillIcon.getAttribute("src") !== `${ASSET}${currentSkill.icon}`) {
    heroSkillIcon.src = `${ASSET}${currentSkill.icon}`;
    heroSkillIcon.alt = currentSkill.name;
  }
  heroSkillName.textContent = currentSkill.name;
  if (heroSkillStrip.dataset.level !== String(state.heroLevel)
    || heroSkillStrip.dataset.queue !== state.heroSkillQueue.join(",")) {
    heroSkillStrip.replaceChildren();
    getHeroSkillQueue().forEach((skill) => {
      const preview = document.createElement("span");
      preview.className = "skill-preview";
      preview.dataset.skill = skill.id;
      preview.title = `${skill.name} · CD ${skill.cooldown}秒`;
      preview.innerHTML = `<img src="${ASSET}${skill.icon}" alt="${skill.name}" /><small></small>`;
      heroSkillStrip.appendChild(preview);
    });
    heroSkillStrip.dataset.level = String(state.heroLevel);
    heroSkillStrip.dataset.queue = state.heroSkillQueue.join(",");
  }
  heroSkillStrip.querySelectorAll(".skill-preview").forEach((preview) => {
    const remaining = state.heroSkillCooldowns[preview.dataset.skill];
    preview.classList.toggle("current", preview.dataset.skill === currentSkill.id);
    preview.querySelector("small").textContent = remaining > 0 ? Math.ceil(remaining) : "";
  });
  speedBtn.textContent = `${state.speed}x`;
  laneLayer.classList.toggle("active", state.phase === "combat");
  renderHomeHud();
}

function renderHomeHud() {
  refreshDailyState();
  refreshChallengeState();
  const levelInProgress = state.levelStaminaSpent && state.phase !== "settle";
  const selectedLevel = levelInProgress ? state.level : state.selectedLevel;
  const selectedLocked = selectedLevel > state.highestUnlockedLevel;
  const challengeLocked = !isChallengeUnlocked(selectedLevel);
  const challengeRemaining = challengeAttemptsRemaining(selectedLevel);
  const mode = levelInProgress ? isChallengeMode() : state.challengeMode;
  homeGoldText.textContent = formatCurrency(state.gold);
  homeGoldText.title = `${state.gold} 金币`;
  homeStaminaText.textContent = `${state.stamina}/${state.maxStamina}`;
  homeGrowthText.textContent = state.heroLevel;
  updateHomeExp();
  if (homePowerText) {
    const powerNow = totalCombatPower();
    homePowerText.textContent = formatCurrency(powerNow);
    homePowerText.title = `战力 ${formatPower(powerNow)}`;
    if (hudPowerShown !== null && powerNow > hudPowerShown) homePowerFloat(powerNow - hudPowerShown);
    hudPowerShown = powerNow;
  }
  homeYuanbaoText.textContent = formatCurrency(state.yuanbao);
  homeYuanbaoText.title = `${state.yuanbao} 元宝`;
  homeLevelText.textContent = selectedLevel;
  homeStageName.textContent = getChapter(selectedLevel).name;
  setSceneBg(getSceneKey(selectedLevel));
  const enemyActions = isBossLevel(selectedLevel)
    ? getBossActions(selectedLevel)
    : getMonsterActionsForType(selectedLevel, "normal");
  const enemySource = `${ASSET}${enemyActions.stand}`;
  if (homeEnemy.getAttribute("src") !== enemySource) homeEnemy.src = enemySource;
  homeStageCast.querySelectorAll("[data-warrior-type]").forEach((image) => {
    const appearance = getWarriorAppearance(image.dataset.warriorType);
    if (!appearance) return;
    const source = `${ASSET}${appearance.previewImage}`;
    if (image.getAttribute("src") !== source) image.src = source;
    image.dataset.modelQuality = String(appearance.modelQuality);
  });
  const chestStore = mode ? state.challengeChests : state.stageChests;
  const chestMask = Number.isSafeInteger(chestStore[String(selectedLevel)])
    ? chestStore[String(selectedLevel)] : 0;
  const chestMeta = stageChestMeta(mode);
  homeRewardRow.querySelectorAll("[data-reward]").forEach((reward) => {
    const found = STAGE_CHEST_META.findIndex((meta) => meta.key === reward.dataset.reward);
    const index = found >= 0 ? found : 0;
    const meta = chestMeta[index];
    const achieved = (chestMask & (1 << index)) !== 0;
    reward.classList.toggle("achieved", achieved);
    reward.classList.toggle("locked", !achieved);
    reward.querySelector("img").src = achieved ? HOME_CHEST_OPEN : HOME_CHEST_LOCKED;
    reward.querySelector("span").textContent = meta.label;
    const conditionEl = reward.querySelector("small");
    if (conditionEl) conditionEl.textContent = "（" + meta.condition + "）";
    reward.setAttribute("aria-label", achieved
      ? `${meta.label}（${meta.condition}）已达成，${meta.amount} 元宝已领取`
      : `${meta.label}（${meta.condition}）未达成，达成可得 ${meta.amount} 元宝`);
  });
  homeNormalModeBtn.classList.toggle("active", !mode);
  homeChallengeModeBtn.classList.toggle("active", mode);
  homeChallengeModeBtn.disabled = selectedLocked || (!challengeLocked && challengeRemaining <= 0 && !levelInProgress);
  if (levelInProgress) {
    homeRecordText.textContent = "战局进行中";
  } else if (mode && selectedLocked) {
    homeRecordText.textContent = `普通第 ${selectedLevel} 关尚未通关`;
  } else if (mode && challengeLocked) {
    homeRecordText.textContent = `普通第 ${selectedLevel} 关需满血通关`;
  } else if (mode && challengeRemaining <= 0) {
    homeRecordText.textContent = "今日挑战次数已用完";
  } else if (selectedLocked) {
    homeRecordText.textContent = "完成前一关后解锁";
  } else if (selectedLevel < state.highestUnlockedLevel) {
    homeRecordText.textContent = "已通关，可重复挑战";
  } else {
    homeRecordText.textContent = "当前挑战关卡";
  }
  const staminaCost = mode ? CHALLENGE_MODE_CONFIG.staminaCost : STAMINA_COST_PER_LEVEL;
  homeStartBtn.disabled = selectedLocked || (mode && challengeLocked) || (mode && !levelInProgress && challengeRemaining <= 0)
    || (!levelInProgress && state.stamina < staminaCost);
  homeStartBtn.querySelector("span").textContent = levelInProgress
    ? "继续守城"
    : mode ? "挑战守城" : selectedLocked ? "尚未解锁" : "开始守城";
  homeStartBtn.querySelector("small").lastChild.textContent = levelInProgress
    ? "返回当前战局"
    : mode && selectedLocked ? `先解锁普通第 ${selectedLevel} 关`
      : mode && challengeLocked ? "先满血通关普通关卡"
        : mode ? `消耗 ${staminaCost} · 今日剩余 ${challengeRemaining}/${CHALLENGE_MODE_CONFIG.dailyAttemptLimit}`
          : selectedLocked ? `先通关第 ${selectedLevel - 1} 关` : `消耗 ${staminaCost}`;
  homePrevLevelBtn.disabled = levelInProgress || selectedLevel <= 1;
  homeNextLevelBtn.disabled = levelInProgress || selectedLevel >= state.highestUnlockedLevel + 1;
  renderHomeQuickTask();
  const mainQuest = currentMainQuest();
  const mainQuestClaimable = mainQuest && getMainQuestProgress(mainQuest) >= mainQuest.target;
  dailyTaskDot.classList.toggle("hidden", state.dailyLoginClaimed && getDailyClaimableCount() === 0 && !mainQuestClaimable);
  renderArmyReportState();
  saveProgress();
}

function selectHomeLevel(direction) {
  const levelInProgress = state.levelStaminaSpent && state.phase !== "settle";
  if (levelInProgress) return;
  const nextLevel = Math.max(1, Math.min(state.highestUnlockedLevel + 1, state.selectedLevel + direction));
  if (nextLevel === state.selectedLevel) return;
  state.selectedLevel = nextLevel;
  homeStageCast.classList.remove("switching-left", "switching-right");
  void homeStageCast.offsetWidth;
  homeStageCast.classList.add(direction > 0 ? "switching-left" : "switching-right");
  renderHomeHud();
}

function selectHomeMode(challenge) {
  if (state.levelStaminaSpent && state.phase !== "settle") return;
  if (challenge && !isChallengeUnlocked(state.selectedLevel)) {
    showModal("挑战模式未开启", `需要普通第 ${state.selectedLevel} 关以 100% 防线血量通关，开启后才能挑战本关。`, [
      { label: "知道了", secondary: true, onClick: () => {} },
    ]);
    return;
  }
  state.challengeMode = Boolean(challenge);
  renderHomeHud();
}

function showHome() {
  finishMergeHintAd(false, false);
  stopLoop();
  hideModal();
  currentView = "home";
  gameScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
  renderHomeHud();
}

function showBattle() {
  currentView = "battle";
  homeScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  render();
  renderTutorialCoach();
  if (state.phase === "combat") runLoop();
}

function startLevelFromHome() {
  refreshStamina();
  refreshChallengeState();
  if (state.phase === "settle") resetGame();
  const levelInProgress = state.levelStaminaSpent && state.phase !== "settle";
  if (!levelInProgress && state.selectedLevel > state.highestUnlockedLevel) return;
  if (!levelInProgress && state.challengeMode) {
    if (!isChallengeUnlocked(state.selectedLevel)) {
      selectHomeMode(true);
      return;
    }
    if (challengeAttemptsRemaining(state.selectedLevel) <= 0) {
      showModal("今日挑战次数已用完", `本关挑战模式每日最多挑战 ${CHALLENGE_MODE_CONFIG.dailyAttemptLimit} 次，明日刷新。`, [
        { label: "知道了", secondary: true, onClick: () => {} },
      ]);
      return;
    }
  }
  if (!levelInProgress) {
    const staminaCost = state.challengeMode ? CHALLENGE_MODE_CONFIG.staminaCost : STAMINA_COST_PER_LEVEL;
    if (state.stamina < staminaCost) {
      showModal("体力不足", `进入${state.challengeMode ? "挑战模式" : "本关"}需要 ${staminaCost} 点体力。`, [
        { label: "补充体力", onClick: showStaminaRefill },
        { label: "稍后再来", secondary: true, onClick: () => {} },
      ]);
      return;
    }
    state.stamina -= staminaCost;
    if (state.challengeMode) {
      const key = String(state.selectedLevel);
      state.challengeAttempts[key] = challengeAttemptCount(state.selectedLevel) + 1;
    }
    state.level = state.selectedLevel;
    resetGame(false);
    state.levelStaminaSpent = true;
  }
  showBattle();
}

function showHomeFeature(feature) {
  if (feature === "每日任务") {
    showDailyTasks();
    return;
  }
  if (feature === "边塞军报") {
    showArmyReport();
    return;
  }
  if (feature === "武将名册") {
    showGrowthModal(showHome);
    return;
  }
  if (feature === "装备打造") {
    showForge(showHome);
    return;
  }
  if (feature === "角色成长") {
    showHeroGrowthModal(showHome);
    return;
  }
  if (feature === "行军包裹") {
    showEquipmentBag(showHome);
    return;
  }
  if (feature === "边塞商店") {
    showShop();
    return;
  }
  const details = {
    "武将名册": `已集结 3 名武将，主角当前等级 ${state.heroLevel}。`,
    "角色成长": `主角等级 ${state.heroLevel}，每次升级提升 1 点防线血量。`,
    "行军包裹": `当前持有 ${state.equipmentInventory.length} 件装备，可在包裹中进行 5 合 1 合成。`,
    "每日任务": "完成每日任务领取奖励。",
    "边塞军报": "荒骨峡谷出现敌军踪迹，请少主尽快整备防线。",
    "挑战难度": "挑战难度暂未开放。",
  };
  showModal(feature, details[feature] || "该功能将在后续版本开放。", [], { backAction: showHome });
  if (feature === "武将名册") {
    const preview = document.createElement("div");
    preview.className = "roster-preview";
    WARRIORS.forEach((warrior) => {
      const portrait = document.createElement("img");
      const appearance = getWarriorAppearance(warrior.type);
      portrait.src = `${ASSET}${appearance.previewImage}`;
      portrait.dataset.modelQuality = String(appearance.modelQuality);
      portrait.alt = warrior.name;
      preview.appendChild(portrait);
    });
    modalDetail.appendChild(preview);
  }
}

function showHeroSkillView(onBack = showHome) {
  const unlockedCount = getUnlockedHeroSkills().length;
  showModal(
    "主角技能",
    `当前等级 Lv.${state.heroLevel} · 已解锁 ${unlockedCount}/${HERO_SKILLS.length} 个技能 · 进入新战斗时随机生成释放顺序`,
    [],
    { backAction: onBack },
  );
  modalCard.classList.add("growth-modal", "hero-skill-view-modal");
  const summary = document.createElement("div");
  summary.className = "hero-skill-view-summary";
  summary.innerHTML = `<span>技能由主角等级解锁</span><b>战斗中点击头像手动释放</b>`;
  modalDetail.appendChild(summary);
  const skills = document.createElement("div");
  skills.className = "growth-skill-list";
  HERO_SKILLS.forEach((skill) => {
    const unlocked = skill.level <= state.heroLevel;
    const row = document.createElement("div");
    row.className = `growth-skill-row${unlocked ? " unlocked" : " locked"}`;
    row.innerHTML = `<img src="${ASSET}${skill.icon}" alt="" />
      <div><strong>${skill.name}</strong><span>${skill.description}</span></div>
      <small>CD ${skill.cooldown}s<br>${unlocked ? "已解锁" : `${skill.level}级解锁`}</small>`;
    skills.appendChild(row);
  });
  modalDetail.appendChild(skills);
}

function renderMonsters() {
  const rect = boardEl.getBoundingClientRect();
  const cell = rect.width / BOARD_SIZE || 56;
  const boardTop = boardEl.offsetTop;
  const activeIds = new Set();
  state.monsters.forEach((monster) => {
    activeIds.add(String(monster.id));
    let el = monsterLayer.querySelector(`[data-monster-id="${monster.id}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "monster";
      el.dataset.monsterId = String(monster.id);
      el.innerHTML = `
        <img alt="" />
        <div class="hp"><span></span></div>
      `;
      const x = monster.c * cell + cell * 0.11;
      const y = monsterOffsetY(monster.y, cell, boardTop) + cell * 0.11;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.dataset.renderX = String(monster.c);
      el.dataset.renderY = String(monster.y);
      monsterLayer.appendChild(el);
    }
    el.classList.toggle("rooted", monster.rootRemaining > 0);
    el.classList.toggle("boss", monster.isBoss);
    const actionName = monster.rootRemaining > 0
      ? "stand"
      : monster.actionRemaining > 0 ? monster.action : "stand";
    el.classList.toggle("monster-walking", actionName === "walk");
    el.classList.toggle("monster-attacking", actionName === "attack");
    ["normal", "runner", "brute", "elite"].forEach((variant) => el.classList.toggle(`monster-${variant}`, monster.variant === variant));
    el.style.setProperty("--monster-move-duration", `${MONSTER_MOVE_INTERVAL * 1000 / state.speed}ms`);
    const image = el.querySelector("img");
    const imageSrc = `${ASSET}${monster.actions?.[actionName] || monster.icon}`;
    if (!image.dataset.fallbackBound) {
      image.dataset.fallbackBound = "true";
      image.addEventListener("error", () => {
        const fallbackSrc = `${ASSET}${monster.isBoss ? "monsters/boss-1.gif" : "monsters/round-1-monster.png"}`;
        if (image.getAttribute("src") !== fallbackSrc) image.src = fallbackSrc;
      });
    }
    if (image.getAttribute("src") !== imageSrc) image.src = imageSrc;
    const x = monster.c * cell + cell * 0.11;
    const y = monsterOffsetY(monster.y, cell, boardTop) + cell * 0.11;
    if (el.dataset.renderX !== String(monster.c) || el.dataset.renderY !== String(monster.y) || el.dataset.renderTop !== String(boardTop)) {
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.dataset.renderX = String(monster.c);
      el.dataset.renderY = String(monster.y);
      el.dataset.renderTop = String(boardTop);
    }
    const hpPct = Math.max(0, Math.min(100, (monster.hp / monster.maxHp) * 100));
    el.querySelector(".hp span").style.width = `${hpPct}%`;
    let status = el.querySelector(".monster-status");
    if (monster.rootRemaining > 0) {
      if (!status) {
        status = document.createElement("div");
        status.className = "monster-status";
        el.appendChild(status);
      }
      status.textContent = `禁锢 ${monster.rootRemaining.toFixed(1)}s`;
    } else if (status) {
      status.remove();
    }
    let bossLabel = el.querySelector(".monster-boss-label");
    if (monster.isBoss) {
      if (!bossLabel) {
        bossLabel = document.createElement("div");
        bossLabel.className = "monster-boss-label";
        el.appendChild(bossLabel);
      }
      bossLabel.textContent = "BOSS";
    } else if (bossLabel) {
      bossLabel.remove();
    }
  });
  Array.from(monsterLayer.children).forEach((el) => {
    if (!activeIds.has(el.dataset.monsterId)) el.remove();
  });
}

function renderLanes() {
  laneLayer.innerHTML = "";
  for (let i = 0; i < 6; i += 1) {
    const lane = document.createElement("div");
    lane.className = "lane";
    laneLayer.appendChild(lane);
  }
}

function prepareBossWarning() {
  state.bossLane = Math.floor(Math.random() * BOARD_SIZE);
}

function renderBossWarning() {
  const bossAhead = isBeastRaid() || isChallengeMode()
    ? isBossWave(state.round)
    : isBossLevel(state.level) && state.round === state.maxRounds;
  const showWarning = currentView === "battle"
    && state.phase === "setup"
    && bossAhead
    && Number.isInteger(state.bossLane);
  bossWarning.classList.toggle("visible", showWarning);
  if (showWarning) bossWarning.style.setProperty("--boss-lane", String(state.bossLane));
}

function render() {
  renderHud();
  renderBoard();
  renderMonsters();
  renderLegend();
  renderBossWarning();
}

function handleCellClick(index) {
  if (state.phase !== "setup" || state.resolving) return;
  if (state.selected === null) {
    if (state.board[index]) {
      state.selected = index;
      renderBoard();
    }
    return;
  }
  if (state.selected === index) {
    state.selected = null;
    renderBoard();
    return;
  }
  tryMove(state.selected, index);
}

function areAdjacentCells(from, to) {
  const cellCount = BOARD_SIZE * BOARD_SIZE;
  if (!Number.isInteger(from) || !Number.isInteger(to)
    || from < 0 || to < 0 || from >= cellCount || to >= cellCount) return false;
  const columnDistance = Math.abs(from % BOARD_SIZE - to % BOARD_SIZE);
  const rowDistance = Math.abs(Math.floor(from / BOARD_SIZE) - Math.floor(to / BOARD_SIZE));
  return columnDistance + rowDistance === 1;
}

async function tryMove(from, to) {
  if (state.phase !== "setup" || state.resolving || !areAdjacentCells(from, to)) {
    state.selected = null;
    renderBoard();
    return;
  }
  const dragged = state.board[from];
  if (!dragged) return;
  clearMergeHint();
  const target = state.board[to];

  if (!target) {
    state.board[to] = dragged;
    state.board[from] = null;
    state.selected = null;
    state.steps = Math.max(0, state.steps - 1);
    advanceTutorial(3);
    await resolveBoardAfterMove(to);
    return;
  }

  state.board[from] = target;
  state.board[to] = dragged;
  state.selected = null;
  state.steps = Math.max(0, state.steps - 1);
  advanceTutorial(3);

  await resolveBoardAfterMove(to);
}

function collectLine(index, dc, dr, board = state.board) {
  const anchor = board[index];
  if (!anchor) return [];
  const { c, r } = indexToPos(index);
  const line = [index];

  [-1, 1].forEach((direction) => {
    let nextC = c + dc * direction;
    let nextR = r + dr * direction;
    while (nextC >= 0 && nextC < BOARD_SIZE && nextR >= 0 && nextR < BOARD_SIZE) {
      const nextIndex = posToIndex(nextC, nextR);
      const piece = board[nextIndex];
      if (!piece || piece.type !== anchor.type || (piece.tier || 1) !== (anchor.tier || 1)) break;
      line.push(nextIndex);
      nextC += dc * direction;
      nextR += dr * direction;
    }
  });
  return line.length >= 3 ? line : [];
}

function findLineMatch(index, board = state.board) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  return directions
    .flatMap(([dc, dr]) => collectLine(index, dc, dr, board))
    .filter((value, itemIndex, values) => values.indexOf(value) === itemIndex);
}

function collectAllMatches(preferredTarget = null, board = state.board) {
  const groups = [];
  board.forEach((piece, index) => {
    if (!piece) return;
    const cluster = findLineMatch(index, board);
    if (cluster.length < 3) return;
    const overlapping = groups.filter((group) => (
      group.type === piece.type
      && group.tier === (piece.tier || 1)
      && group.cluster.some((cellIndex) => cluster.includes(cellIndex))
    ));
    if (!overlapping.length) {
      groups.push({ type: piece.type, tier: piece.tier || 1, cluster, targetIndex: index });
      return;
    }
    const mergedCluster = [...new Set([
      ...cluster,
      ...overlapping.flatMap((group) => group.cluster),
    ])];
    const targetIndex = overlapping[0].targetIndex;
    overlapping.forEach((group) => groups.splice(groups.indexOf(group), 1));
    groups.push({ type: piece.type, tier: piece.tier || 1, cluster: mergedCluster, targetIndex });
  });
  if (preferredTarget !== null) {
    groups.forEach((group) => {
      if (group.cluster.includes(preferredTarget)) group.targetIndex = preferredTarget;
    });
  }
  return groups;
}

function clearMergeHint() {
  state.hintIndices = [];
  state.hintPair = [];
  renderMergeHint();
}

function renderMergeHint() {
  boardEl.querySelectorAll(".cell").forEach((cell) => {
    const index = Number(cell.dataset.index);
    cell.classList.toggle("hinted", state.hintIndices.includes(index));
    cell.classList.toggle("hint-source", state.hintPair[0] === index);
    cell.classList.toggle("hint-target", state.hintPair[1] === index);
  });
}

function canRequestMergeHint() {
  return currentView === "battle" && state.levelStaminaSpent
    && state.phase === "setup"
    && !state.resolving && !state.hintAd && !state.adPlayback && !state.hintIndices.length
    && state.mergeHintsUsed < MAX_MERGE_HINTS;
}

function findHintMoves(board = state.board) {
  const existingMatches = collectAllMatches(null, board);
  if (existingMatches.length) {
    existingMatches.sort((first, second) => second.cluster.length - first.cluster.length);
    return { indices: existingMatches[0].cluster, pair: [] };
  }

  let best = null;
  for (let from = 0; from < board.length; from += 1) {
    const source = board[from];
    if (!source) continue;
    for (let to = 0; to < board.length; to += 1) {
      const target = board[to];
      if (!areAdjacentCells(from, to) || (target && source.type === target.type
        && (source.tier || 1) === (target.tier || 1))) continue;
      const swapped = [...board];
      [swapped[from], swapped[to]] = [swapped[to], swapped[from]];
      const cluster = findLineMatch(to, swapped);
      if (cluster.length < 3) continue;
      const fromPos = indexToPos(from);
      const toPos = indexToPos(to);
      const distance = Math.abs(fromPos.c - toPos.c) + Math.abs(fromPos.r - toPos.r);
      if (best && (cluster.length < best.matchLength
        || (cluster.length === best.matchLength && distance >= best.distance))) continue;
      best = {
        indices: [...new Set([from, to, ...cluster])],
        pair: [from, to],
        matchLength: cluster.length,
        distance,
      };
    }
  }
  return best;
}

function canRequestBoardShuffle() {
  return currentView === "battle" && state.levelStaminaSpent && state.phase === "setup"
    && !state.resolving && !state.hintAd && !state.adPlayback
    && state.boardShufflesUsed < MAX_BOARD_SHUFFLES;
}

function createShuffledBoard(board) {
  if (board.length !== BOARD_SIZE * BOARD_SIZE || board.some((piece) => !piece)) return null;
  const pieceKey = (piece) => `${piece.type}:${piece.tier || 1}`;
  const groups = new Map();
  board.forEach((piece) => {
    const key = pieceKey(piece);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(piece);
  });
  const matchGroups = [...groups.values()].filter((group) => group.length >= 3 && group.length < board.length);
  if (!matchGroups.length) return null;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let candidate = [...board];
    for (let index = candidate.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [candidate[index], candidate[other]] = [candidate[other], candidate[index]];
    }
    if (attempt >= 100) {
      const matching = matchGroups[attempt % matchGroups.length].slice(0, 3);
      const different = candidate.find((piece) => pieceKey(piece) !== pieceKey(matching[0]));
      const reserved = new Map([[0, matching[0]], [1, matching[1]], [BOARD_SIZE + 2, matching[2]], [2, different]]);
      const reservedPieces = new Set(reserved.values());
      const remaining = candidate.filter((piece) => !reservedPieces.has(piece));
      let cursor = 0;
      candidate = candidate.map((piece, index) => reserved.get(index) || remaining[cursor++]);
    }
    if (!candidate.some((piece, index) => pieceKey(piece) !== pieceKey(board[index]))) continue;
    const hint = findHintMoves(candidate);
    if (hint?.pair.length === 2) return candidate;
  }
  return null;
}

function showBoardShuffleAd() {
  if (!canRequestBoardShuffle() || !modal.classList.contains("hidden")) return false;
  const original = [...state.board];
  const candidate = createShuffledBoard(original);
  if (!candidate) {
    showModal("暂无可用洗牌布局", "保留现有种类与等级时，暂未找到可消除的新布局。本次不播放广告、不消耗次数。", [], { backAction: () => {} });
    return false;
  }
  const resolutionId = state.resolutionId;
  return AdService.showRewarded({
    placement: `棋盘洗牌 · 本局剩余 ${MAX_BOARD_SHUFFLES - state.boardShufflesUsed} 次`,
    onComplete: () => {
      if (!canRequestBoardShuffle() || state.resolutionId !== resolutionId
        || state.board.length !== original.length || state.board.some((piece, index) => piece !== original[index])) return;
      clearMergeHint();
      state.board = candidate;
      state.selected = null;
      state.boardShufflesUsed += 1;
      state.shuffleAnimationPending = true;
      tipText.textContent = "洗牌完成，棋子种类与等级保持不变。";
    },
  });
}

function eliminateMatches(matches, { chain = 1 } = {}) {
  clearMergeHint();
  const results = matches.map(({ type, cluster, targetIndex }) => ({
    type,
    cluster,
    targetIndex,
    highestTier: Math.max(...cluster.map((index) => state.board[index].tier || 1)),
  }));
  updateDailyProgress("clear", results.reduce((total, result) => total + result.cluster.length, 0));

  results.forEach(({ cluster }) => {
    cluster.forEach((index) => {
      state.board[index] = null;
    });
  });

  state.selected = null;
  const messages = [];
  let refundedSteps = 0;
  results.forEach(({ type, cluster, targetIndex, highestTier }) => {
    const count = cluster.length;
    const nextTier = Math.min(MAX_PIECE_TIER, highestTier + 1);
    const effects = {};

    if (type === "gourd") {
      const heal = count >= 5 ? 2 : 1;
      state.hp = Math.min(state.maxHp, state.hp + heal);
      messages.push(`葫芦 ${count} 连消除，防线回复 ${heal} 点`);
    } else if (type === "coin") {
      const gain = [0, 0, 0, 50, 120, 280, 680][Math.min(6, count)];
      state.gold += gain;
      messages.push(`铜钱 ${count} 连消除，获得 ${gain} 金币`);
    } else if (type === "chest") {
      const gain = Math.max(1, count - 2);
      refundedSteps += gain;
      messages.push(`宝箱 ${count} 连消除，返还 ${gain} 步`);
    } else if (type === "trap") {
      effects.rootDuration = (count - 2) * 0.5;
      messages.push(`陷阱 ${count} 连消除，新陷阱禁锢 ${effects.rootDuration.toFixed(1)} 秒`);
    } else if (type === "mine") {
      effects.mineDamage = (count - 2) * 60;
      messages.push(`地雷 ${count} 连消除，新地雷伤害 ${effects.mineDamage}`);
    } else {
      messages.push(`${TYPES[type].name} ${count} 连消除，生成 ${nextTier} 级棋子`);
    }
    const generatedPiece = newPiece(type, nextTier, effects);
    if (WARRIORS.some(({ type: warriorType }) => warriorType === type)) {
      generatedPiece.rangeFlash = true;
    }
    state.board[targetIndex] = generatedPiece;
    mergeBurstAt(targetIndex, count, type);
  });
  const regularCounts = results
    .filter(({ type }) => type !== "chest")
    .map(({ cluster }) => cluster.length);
  if (regularCounts.length) {
    const regularCount = Math.max(...regularCounts);
    const refundChance = Math.min(1, Math.max(0, (regularCount - 3) * 0.2));
    if (refundChance > 0) {
      const refunded = Math.random() < refundChance;
      if (refunded) refundedSteps += 1;
      messages.push(refunded ? "触发普通消除返步 +1" : `未触发 ${Math.round(refundChance * 100)}% 普通返步`);
    }
  }
  state.steps += refundedSteps;
  const chainText = chain > 1 ? `第 ${chain} 连锁：` : "";
  tipText.textContent = `${chainText}${messages.join("；")}。`;
  return { refundedSteps };
}

function refillBoardFromBottom() {
  const suppliedPieces = [];
  state.board.forEach((piece, index) => {
    if (piece) return;
    const suppliedPiece = { ...newPiece(), entering: true };
    if (WARRIORS.some(({ type: warriorType }) => warriorType === suppliedPiece.type)) {
      suppliedPiece.rangeFlash = true;
    }
    state.board[index] = suppliedPiece;
    suppliedPieces.push(suppliedPiece);
  });
  if (!suppliedPieces.length) return;
  setTimeout(() => {
    suppliedPieces.forEach((piece) => {
      delete piece.entering;
    });
  }, 750);
}

function finishBoardSupplyAnimations() {
  state.board.forEach((piece) => {
    if (piece) delete piece.entering;
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveBoardAfterMove(preferredTarget = null) {
  state.resolving = true;
  state.selected = null;
  const resolutionId = ++state.resolutionId;
  let chain = 0;
  render();

  while (state.phase === "setup" && resolutionId === state.resolutionId) {
    const matches = collectAllMatches(chain === 0 ? preferredTarget : null);
    if (!matches.length) break;
    chain += 1;
    eliminateMatches(matches, { chain });
    render();
    await wait(300);
    if (resolutionId !== state.resolutionId) return;
    refillBoardFromBottom();
    render();
    await wait(600);
    finishBoardSupplyAnimations();
  }

  if (resolutionId !== state.resolutionId) return;
  state.resolving = false;
  render();
  if (!chain) {
    tipText.textContent = "棋盘已稳定，本次换位未形成消除。";
  } else {
    advanceTutorial(4);
    tipText.textContent = `自动检测完成，共触发 ${chain} 轮消除。`;
  }
  if (state.steps <= 0) startWave();
}

function getFxPosition(index) {
  const rect = boardEl.getBoundingClientRect();
  const parentRect = fxLayer.getBoundingClientRect();
  const cell = rect.width / BOARD_SIZE || 56;
  const { c, r } = indexToPos(index);
  return {
    x: rect.left - parentRect.left + c * cell + cell / 2,
    y: rect.top - parentRect.top + r * cell + cell / 2,
  };
}

function rangeFlashAt(index, type, tier) {
  if (!WARRIORS.some(({ type: warriorType }) => warriorType === type)) return;
  const boardRect = boardEl.getBoundingClientRect();
  const parentRect = fxLayer.getBoundingClientRect();
  const cell = boardRect.width / BOARD_SIZE || 56;
  const { c, r } = indexToPos(index);
  const boardLeft = boardRect.left - parentRect.left;
  const boardTop = boardRect.top - parentRect.top;
  const flash = document.createElement("div");
  const range = ATTACK_RANGE_BY_TIER[tier] || ATTACK_RANGE_BY_TIER[1];

  flash.className = `range-flash range-${type}`;
  flash.style.setProperty("--range-color", TYPES[type]?.color || "#ffe49b");

  if (type === "rock") {
    const radius = AREA_RADIUS_BY_TIER[tier] || AREA_RADIUS_BY_TIER[1];
    const diameter = Math.max(cell, radius * 2 * cell);
    flash.style.left = `${boardLeft + c * cell + (cell - diameter) / 2}px`;
    flash.style.top = `${boardTop + r * cell + (cell - diameter) / 2}px`;
    flash.style.width = `${diameter}px`;
    flash.style.height = `${diameter}px`;
  } else if (type === "sword") {
    const rawTop = boardTop + (r - range) * cell;
    const top = Math.max(0, rawTop);
    const height = Math.min(parentRect.height - top, (range * 2 + 1) * cell + rawTop - top);
    flash.style.left = `${boardLeft + c * cell}px`;
    flash.style.top = `${top}px`;
    flash.style.width = `${cell}px`;
    flash.style.height = `${Math.max(cell, height)}px`;
  } else {
    const left = Math.max(boardLeft, boardLeft + (c - range) * cell);
    const right = Math.min(boardLeft + boardRect.width, boardLeft + (c + range + 1) * cell);
    flash.style.left = `${left}px`;
    flash.style.top = `${boardTop + r * cell}px`;
    flash.style.width = `${Math.max(cell, right - left)}px`;
    flash.style.height = `${cell}px`;
  }

  fxLayer.appendChild(flash);
  setTimeout(() => flash.remove(), 320);
}

function getMonsterFxPosition(monster) {
  const parentRect = fxLayer.getBoundingClientRect();
  const monsterEl = monsterLayer.querySelector(`[data-monster-id="${monster.id}"]`);
  const headOffset = monster.isBoss ? 22 : 8;
  if (monsterEl) {
    const rect = monsterEl.getBoundingClientRect();
    return {
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top - headOffset,
      width: parentRect.width,
    };
  }
  const boardRect = boardEl.getBoundingClientRect();
  const cell = boardRect.width / BOARD_SIZE || 56;
  return {
    x: boardRect.left - parentRect.left + monster.c * cell + cell / 2,
    y: monsterOffsetY(monster.y, cell, boardRect.top - parentRect.top) + cell * 0.11 - headOffset,
    width: parentRect.width,
  };
}

function burstAt(index, text) {
  const { x, y } = getFxPosition(index);
  const fx = document.createElement("div");
  fx.className = "hit-fx";
  fx.textContent = text;
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 700);
}

function mergeBurstAt(index, count, type) {
  const { x, y } = getFxPosition(index);
  const fx = document.createElement("div");
  fx.className = "merge-fx";
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  fx.style.setProperty("--merge-color", TYPES[type]?.color || "#ffe49b");
  fx.innerHTML = `
    <span class="merge-ring"></span>
    <span class="merge-core"></span>
    <span class="merge-ray ray-1"></span>
    <span class="merge-ray ray-2"></span>
    <span class="merge-ray ray-3"></span>
    <span class="merge-ray ray-4"></span>
    <span class="merge-particle particle-1"></span>
    <span class="merge-particle particle-2"></span>
    <span class="merge-particle particle-3"></span>
    <span class="merge-particle particle-4"></span>
    <strong class="merge-count">×${count}</strong>
  `;
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 720);
}

function damageBurstAtMonster(monster, text, { critical = false, emphasized = false, miss = false } = {}) {
  const { x, y, width } = getMonsterFxPosition(monster);
  const fx = document.createElement("div");
  fx.className = `damage-fx${!miss && (critical || emphasized) ? " heavy-hit" : ""}${!miss && critical ? " critical" : ""}${miss ? " miss" : ""}`;
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  const popupIndex = monster.damagePopupIndex || 0;
  monster.damagePopupIndex = (popupIndex + 1) % 3;
  fx.style.setProperty("--damage-drift", `${(popupIndex - 1) * 12}px`);
  if (!miss) fx.innerHTML = `
    <span class="damage-ring"></span>
    <span class="damage-spark spark-1"></span>
    <span class="damage-spark spark-2"></span>
    <span class="damage-spark spark-3"></span>
  `;
  const number = document.createElement("strong");
  number.className = "damage-number";
  const contentWidth = miss ? 54 : (critical ? 57 : 0) + String(text).length * (critical || emphasized ? 24 : 19);
  const fit = Math.min(1, Math.max(1, width - 32) / (contentWidth * 1.44));
  const halfWidth = contentWidth * fit * 0.72 + 12;
  const textX = Math.max(halfWidth, Math.min(width - halfWidth, x));
  number.style.setProperty("--damage-offset", `${textX - x}px`);
  number.style.setProperty("--damage-fit", String(fit));
  number.setAttribute("aria-label", miss ? "闪避" : `${critical ? "暴击 " : ""}${text}`);
  const bitmapNumber = [...String(text)].every((character) => DAMAGE_GLYPHS[character]);
  if (miss || critical || bitmapNumber) number.classList.add("bitmap-number");
  if (miss || critical) {
    const label = document.createElement("img");
    label.className = "damage-label";
    label.src = `${ASSET}${COMBAT_POPUP_LABELS[miss ? "miss" : "critical"]}`;
    label.alt = "";
    label.width = 54;
    label.height = 28;
    number.appendChild(label);
  }
  if (!miss && bitmapNumber) {
    [...String(text)].forEach((character) => {
      const glyph = document.createElement("img");
      glyph.className = "damage-glyph";
      glyph.src = `${ASSET}${DAMAGE_GLYPHS[character]}`;
      glyph.alt = "";
      glyph.width = 30;
      glyph.height = 34;
      number.appendChild(glyph);
    });
  } else if (!miss) {
    number.appendChild(document.createTextNode(String(text)));
  }
  fx.appendChild(number);
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 950);
}

function cardBurst() {
  const fx = document.createElement("div");
  fx.className = "card-screen-fx";
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 620);
}

function releaseHeroSkill() {
  const { skill, ready } = getHeroSkillStatus();
  if (!ready) return;
  state.heroSkillCooldowns[skill.id] = skill.cooldown;
  state.heroSkillIndex = (state.heroSkillIndex + 1) % getHeroSkillQueue().length;
  applyHeroSkillEffect(skill);
  const fx = document.createElement("div");
  fx.className = `card-screen-fx hero-skill-fx skill-fx-${skill.id}`;
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 620);
  removeDefeatedMonsters();
  tipText.textContent = `主角释放「${skill.name}」。`;
  renderHud();
  renderMonsters();
}

function applyHeroSkillEffect(skill) {
  const e = skill.effect || {};
  if (e.damagePct) {
    state.monsters.forEach((monster) => {
      if (monster.hp <= 0) return;
      const dmg = Math.max(e.damageMin || 0, monster.maxHp * e.damagePct) * state.damageMultiplier;
      monster.hp -= dmg;
      damageBurstAtMonster(monster, `-${Math.round(dmg)}`, { emphasized: true });
    });
  }
  if (e.root) {
    state.monsters.forEach((monster) => { monster.rootRemaining = Math.max(monster.rootRemaining || 0, e.root); });
  }
  if (e.heal) {
    const need = state.maxHp - state.hp;
    const heal = e.heal === "full" ? need : Math.min(e.heal, need);
    if (heal > 0) { state.hp += heal; burstAt(33, `+${Math.round(heal)}`); }
  }
  if (e.rally) state.heroRallyRemaining = Math.max(state.heroRallyRemaining, e.rally);
  if (e.damageBuff) state.heroDamageRemaining = Math.max(state.heroDamageRemaining || 0, e.damageBuff);
  if (e.speedBuff) state.heroSpeedRemaining = Math.max(state.heroSpeedRemaining || 0, e.speedBuff);
}

function triggerWarriorAttack(index) {
  const warrior = boardEl.querySelector(`.cell[data-index="${index}"] .warrior-piece`);
  if (!warrior) return;
  const animation = getWarriorAppearance(warrior.dataset.type);
  const image = warrior.querySelector("img");
  if (!animation || !image) return;
  image.dataset.modelQuality = String(animation.modelQuality);

  if (image.dataset.action !== "attack") {
    image.src = `${ASSET}${animation.attackImage}`;
    image.dataset.action = "attack";
  }
  clearTimeout(warrior.attackAnimationTimeout);
  warrior.classList.remove("attacking");
  void warrior.offsetWidth;
  warrior.classList.add("attacking");
  warrior.attackAnimationTimeout = setTimeout(() => {
    if (!warrior.isConnected) return;
    warrior.classList.remove("attacking");
    const currentAppearance = getWarriorAppearance(warrior.dataset.type);
    image.src = `${ASSET}${currentAppearance.idleImage}`;
    image.dataset.modelQuality = String(currentAppearance.modelQuality);
    image.dataset.action = "idle";
  }, 460);
}

function attackEffectAt(index, type) {
  const { x, y } = getFxPosition(index);
  const fx = document.createElement("div");
  fx.className = `attack-fx attack-${type}`;
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  fx.innerHTML = `
    <span class="attack-flash"></span>
    <span class="attack-wave"></span>
    <span class="attack-streak streak-1"></span>
    <span class="attack-streak streak-2"></span>
    <span class="attack-streak streak-3"></span>
  `;
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 560);
}

function startWave() {
  if (state.phase !== "setup" || state.resolving) return;
  const needsStamina = state.round === 1 && !state.levelStaminaSpent && !isBeastRaid();
  const staminaCost = isChallengeMode() ? CHALLENGE_MODE_CONFIG.staminaCost : STAMINA_COST_PER_LEVEL;
  if (needsStamina) {
    if (state.stamina < staminaCost) {
      showModal("体力不足", `本关需要 ${staminaCost} 点体力，补充体力后再继续守城。`, [
        { label: "知道了", secondary: true, onClick: () => {} },
      ]);
      return;
    }
    state.stamina -= staminaCost;
    state.levelStaminaSpent = true;
  }
  state.resolutionId += 1;
  state.phase = "combat";
  state.steps = 0;
  state.selected = null;
  state.monsters = [];
  state.spawned = 0;
  state.spawnTimer = 0;
  state.moveTimer = 0;
  state.cardQueued = false;
  state.cardCooldown = 0;
  state.board.forEach((piece) => {
    if (piece) {
      piece.attackCooldown = 0;
      piece.skillRootCooldown = 0;
    }
  });
  const waveLevel = getRunLevel();
  const beastRun = isBeastRaid();
  // 关卡强度：总怪数由关卡决定，再按波次形状分摊；血量同理按整关均值归一化。
  // 关卡 1 逐波仍为 9/11/13 只 · 86/100/114 血，与旧公式完全一致（前期手感零变化）。
  const monsterTotal = LEVEL_SCALING.monsterTotalBase
    * Math.pow(waveLevel, LEVEL_SCALING.monsterTotalPower);
  // 军报固定 10 波，若按自身波数分摊会让每波怪数低于主线；故统一按主线同关波数分摊，
  // 军报再乘 monsterTotalMultiplier → 军报每波怪数恒 ≥ 主线，总怪数因 10 波而更多。
  const challengeRun = isChallengeMode();
  const perWaveBase = monsterTotal * (challengeRun ? CHALLENGE_MODE_CONFIG.monsterTotalMultiplier : 1)
    / (beastRun ? getRoundsForLevel(waveLevel) : state.maxRounds);
  const waveCountShape = 0.85 + 0.3 * (state.round - 1) / Math.max(1, state.maxRounds - 1);
  const count = Math.max(2, Math.round(perWaveBase * waveCountShape
    * (beastRun ? ARMY_REPORT_CONFIG.monsterTotalMultiplier : 1)));
  const waveHpShape = (36 + state.round * 7) / (36 + 7 * (state.maxRounds + 1) / 2);
  const hp = Math.round(
    getLevelHpScale(waveLevel) * waveHpShape
    * (beastRun ? ARMY_REPORT_CONFIG.difficultyMultiplier : challengeRun ? CHALLENGE_MODE_CONFIG.difficultyMultiplier : 1),
  );
  state.waveConfig = {
    count,
    hp,
    interval: 0.72,
    killed: 0,
    fullReward: getFullLevelReward(),
    profile: getWaveProfile(waveLevel, state.round),
    lanePattern: state.round % 3 === 0 ? "pressure" : state.round % 2 === 0 ? "split" : "spread",
  };
  tipText.textContent = "出怪期开始。武将等级越高，攻击力、攻击速度与有效范围越强。";
  render();
  runLoop();
}

function runLoop() {
  if (state.loopId) clearInterval(state.loopId);
  state.loopId = setInterval(() => tick(0.1 * state.speed), 100);
}

function stopLoop() {
  if (state.loopId) clearInterval(state.loopId);
  state.loopId = null;
}

function tick(dt) {
  if (state.phase !== "combat") return;
  state.cardCooldown = Math.max(0, state.cardCooldown - dt);
  state.heroRallyRemaining = Math.max(0, state.heroRallyRemaining - dt);
  state.heroDamageRemaining = Math.max(0, (state.heroDamageRemaining || 0) - dt);
  state.heroSpeedRemaining = Math.max(0, (state.heroSpeedRemaining || 0) - dt);
  HERO_SKILLS.forEach((skill) => {
    state.heroSkillCooldowns[skill.id] = Math.max(0, (state.heroSkillCooldowns[skill.id] || 0) - dt);
  });
  state.monsters.forEach((monster) => {
    monster.rootRemaining = Math.max(0, (monster.rootRemaining || 0) - dt);
    monster.enrageRemaining = Math.max(0, (monster.enrageRemaining || 0) - dt);
    monster.actionRemaining = Math.max(0, (monster.actionRemaining || 0) - dt);
  });
  state.monsters = state.monsters.filter((monster) => !monster.leaking || monster.actionRemaining > 0);
  state.spawnTimer += dt;
  state.moveTimer += dt;

  if (state.spawned < state.waveConfig.count && state.spawnTimer >= state.waveConfig.interval) {
    state.spawnTimer = 0;
    spawnMonster();
  }
  attackMonsters(dt);
  // Boss 狂暴技能：周期性加速全场怪物；不隔空扣血，完美守城只会因真实漏怪而失去。
  state.monsters.forEach((monster) => {
    if (!monster.isBoss) return;
    monster.bossSkillTimer -= dt;
    if (monster.bossSkillTimer <= 0) {
      monster.bossSkillTimer = BOSS_CONFIG.skillInterval;
      state.monsters.forEach((m) => { m.enrageRemaining = BOSS_CONFIG.enrageDuration; });
      if (BOSS_CONFIG.defenseHit > 0) state.hp = Math.max(0, state.hp - BOSS_CONFIG.defenseHit);
      damageBurstAtMonster(monster, "狂暴!", { emphasized: true });
    }
  });
  if (state.moveTimer >= MONSTER_MOVE_INTERVAL) {
    state.moveTimer = 0;
    if (moveMonsters()) renderBoard();
  }
  renderHud();
  renderMonsters();
  queueCardIfReady();
  if (state.cardQueued) {
    openCardChoice();
    return;
  }
  checkCombatEnd();
}

function spawnMonster() {
  const bossWave = isBossWave(state.round);
  const bossCount = isChallengeMode() ? CHALLENGE_MODE_CONFIG.bossesPerBossWave : 1;
  const isBoss = bossWave && state.spawned >= state.waveConfig.count - bossCount;
  const profileName = isBoss ? "brute" : state.waveConfig.profile;
  const profile = MONSTER_PROFILES[profileName];
  const previous = state.monsters[state.monsters.length - 1];
  let c = Math.floor(Math.random() * BOARD_SIZE);
  if (isBoss && Number.isInteger(state.bossLane) && !isChallengeMode()) c = state.bossLane;
  else if (!bossWave && state.waveConfig.lanePattern === "pressure" && previous) c = previous.c;
  else if (!bossWave && state.waveConfig.lanePattern === "split" && previous) c = (previous.c + 2 + (state.spawned % 2)) % BOARD_SIZE;
  const maxHp = Math.round((isBoss ? state.waveConfig.hp * BOSS_CONFIG.hpMultiplier : state.waveConfig.hp) * profile.hp);
  const monsterLevel = getRunLevel();
  const actions = isBoss ? getBossActions(monsterLevel) : getMonsterActionsForType(monsterLevel, profileName);
  state.monsters.push({
    id: state.nextMonsterId++,
    c,
    y: -MONSTER_SPAWN_Y,
    hp: maxHp,
    maxHp,
    stop: 0,
    rootRemaining: 0,
    triggeredDevices: [],
    isBoss,
    variant: profileName,
    moveSpeed: profile.move,
    dodge: isBoss ? BOSS_COMBAT_RATINGS.dodge : profile.dodge,
    resilience: isBoss ? BOSS_COMBAT_RATINGS.resilience : profile.resilience,
    icon: actions.stand,
    actions,
    action: "stand",
    actionRemaining: 0,
    leaking: false,
    reward: isBoss ? BOSS_CONFIG.reward : profile.reward,
    bossSkillTimer: isBoss ? BOSS_CONFIG.skillInterval : 0,
  });
  state.spawned += 1;
}

function removeDefeatedMonsters() {
  const before = state.monsters.length;
  state.monsters = state.monsters.filter((monster) => {
    if (monster.hp > 0) return true;
    state.gold += monster.reward;
    return false;
  });
  const defeated = before - state.monsters.length;
  if (!defeated) return 0;
  if (state.waveConfig) state.waveConfig.killed += defeated;
  state.totalKills += defeated;
  state.killsSinceCard += defeated;
  updateDailyProgress("kill", defeated);
  queueCardIfReady();
  return defeated;
}

function queueCardIfReady() {
  if (state.phase === "combat"
    && state.cardCooldown <= 0
    && state.cardsOffered < CARD_KILL_STEPS.length
    && state.killsSinceCard >= state.nextCardKillTarget) {
    state.cardQueued = true;
  }
}

function attackMonsters(dt) {
  const units = state.board
    .map((piece, index) => piece ? { piece, index, ...indexToPos(index) } : null)
    .filter(Boolean)
    .filter(({ piece }) => TYPES[piece.type].kind === "unit");

  units.forEach((unit) => {
    const piece = unit.piece;
    piece.attackCooldown = Math.max(0, (piece.attackCooldown || 0) - dt);
    piece.skillRootCooldown = Math.max(0, (piece.skillRootCooldown || 0) - dt);
    if (piece.attackCooldown > 0) return;

    const type = TYPES[piece.type];
    const level = piece.tier || 1;
    const equipmentBonuses = getWarriorCombatStats(piece.type);
    const skillProfile = getWarriorSkillProfile(piece.type);
    const dps = (type.dps * Math.pow(1.8, level - 1) + equipmentBonuses.attack)
      * state.damageMultiplier
      * (state.heroRallyRemaining > 0 ? 1.5 : 1)
      * (state.heroDamageRemaining > 0 ? 1.4 : 1);
    const attackRange = ATTACK_RANGE_BY_TIER[level];
    const wideMode = state.attackMode === "wide";
    const targets = state.monsters.filter((monster) => {
      if (monster.hp <= 0) return false;
      const row = Math.round(monster.y);
      const axisDistance = piece.type === "sword"
        ? Math.abs(monster.y - unit.r)
        : Math.abs(monster.c - unit.c);
      if (piece.type === "rock") {
        return Math.hypot(monster.c - unit.c, monster.y - unit.r) <= AREA_RADIUS_BY_TIER[level] + (wideMode ? 0.5 : 0);
      }
      if (piece.type === "sword") {
        return (monster.c === unit.c || (wideMode && Math.abs(monster.c - unit.c) <= 1)) && axisDistance <= attackRange;
      }
      return (row === unit.r || (wideMode && Math.abs(row - unit.r) <= 1)) && axisDistance <= attackRange;
    });
    const attackResults = targets.filter((monster) => monster.hp > 0).map((monster) => {
      const executionBonus = state.executionReady && monster.hp > monster.maxHp * 0.5 ? 1.35 : 1;
      const result = resolveWarriorAttack(
        equipmentBonuses,
        monster,
        dps * skillProfile.damageMultiplier * executionBonus,
      );
      return { monster, result };
    });
    const hitCount = attackResults.filter(({ result }) => result.hit).length;
    const multiTargetBonus = hitCount >= 2 ? skillProfile.multiTargetDamageMultiplier : 1;
    const rootTriggered = hitCount >= 2 && skillProfile.multiTargetRoot > 0 && piece.skillRootCooldown <= 0;
    attackResults.forEach(({ monster, result }) => {
      if (!result.hit) {
        damageBurstAtMonster(monster, "闪避", { miss: true });
        return;
      }
      const finalDamage = result.damage * multiTargetBonus;
      monster.hp -= finalDamage;
      if (rootTriggered) monster.rootRemaining = Math.max(monster.rootRemaining || 0, skillProfile.multiTargetRoot);
      damageBurstAtMonster(monster, `-${Math.round(finalDamage)}`, { critical: result.critical, emphasized: finalDamage >= 24 });
    });
    if (rootTriggered) piece.skillRootCooldown = skillProfile.rootCooldown;
    if (attackResults.length) {
      piece.attackCooldown = ATTACK_INTERVAL_BY_TIER[level]
        / ((state.attackSpeedMultiplier * skillProfile.speedMultiplier * (1 + equipmentBonuses.speed / 100))
          * (state.heroRallyRemaining > 0 ? 1.35 : 1)
          * (state.heroSpeedRemaining > 0 ? 1.4 : 1));
      triggerWarriorAttack(unit.index);
      attackEffectAt(unit.index, piece.type);
    }
  });

  removeDefeatedMonsters();
}

function moveMonsters() {
  let boardChanged = false;
  state.monsters.forEach((monster) => {
    if (!monster.triggeredDevices) monster.triggeredDevices = [];
    if (monster.leaking || monster.rootRemaining > 0 || monster.hp <= 0) {
      monster.action = "stand";
      monster.actionRemaining = 0;
      return;
    }
    const row = Math.round(monster.y);
    if (row >= 0 && row < BOARD_SIZE) {
      const deviceIndex = posToIndex(monster.c, row);
      const device = state.board[deviceIndex];
      if (device && !monster.triggeredDevices.includes(device.id)) {
        if (device.type === "trap") {
          const duration = device.rootDuration || Math.max(0, (device.tier - 1) * 0.5);
          if (duration > 0) {
            monster.triggeredDevices.push(device.id);
            monster.rootRemaining = duration;
            burstAt(deviceIndex, `禁锢 ${duration.toFixed(1)}s`);
            return;
          }
        }
        if (device.type === "mine") {
          const damage = device.mineDamage || Math.max(0, (device.tier - 1) * 60);
          if (damage > 0) {
            monster.triggeredDevices.push(device.id);
            monster.hp -= damage;
            clearMergeHint();
            state.board[deviceIndex] = null;
            boardChanged = true;
            damageBurstAtMonster(monster, `-${damage}`, { emphasized: true });
            if (monster.hp <= 0) return;
          }
        }
      }
    }

    const controllingRock = state.board
      .map((piece, index) => piece && piece.type === "rock" ? { ...piece, ...indexToPos(index) } : null)
      .filter(Boolean)
      .find((rock) => {
        const radius = AREA_RADIUS_BY_TIER[rock.tier || 1];
        return Math.hypot(monster.c - rock.c, monster.y - rock.r) <= radius;
      });
    if (controllingRock) {
      const rockLevel = controllingRock.tier || 1;
      monster.stop += 1;
      if (monster.stop <= rockLevel) return;
      monster.stop = 0;
    }
    monster.y += (monster.moveSpeed || 1) * (monster.enrageRemaining > 0 ? BOSS_CONFIG.enrageSpeed : 1);
    monster.action = "walk";
    monster.actionRemaining = MONSTER_MOVE_INTERVAL / state.speed + 0.12;
  });

  removeDefeatedMonsters();

  // The last playable row is 5; leak only after the monster crosses the board edge at 6.
  const leaked = state.monsters.filter((monster) => monster.y >= BOARD_SIZE && !monster.leaking);
  if (leaked.length) {
    state.hp = Math.max(0, state.hp - leaked.length);
    leaked.forEach((monster) => {
      monster.leaking = true;
      monster.action = "attack";
      monster.actionRemaining = 0.45;
    });
    tipText.textContent = `漏怪 ${leaked.length} 个，防线受损。`;
  }
  if (boardChanged) refillBoardFromBottom();
  return boardChanged;
}

function payLevelReward(amount) {
  const rewardDelta = Math.max(0, amount - state.paidReward);
  state.paidReward = Math.max(state.paidReward, amount);
  state.rewardGranted = state.paidReward;
  state.gold += rewardDelta;
  return rewardDelta;
}

function getFullYuanbaoReward() {
  // v2：元宝不再随通关发放（LEVEL_YUANBAO_REWARD.enabled=false），改为只由每关三宝箱产出
  if (!LEVEL_YUANBAO_REWARD.enabled) return 0;
  return LEVEL_YUANBAO_REWARD.base + state.level * LEVEL_YUANBAO_REWARD.step;
}

function getFailureYuanbaoReward() {
  return Math.floor(getFullYuanbaoReward() * state.round * 3 / (state.maxRounds * 5));
}

function payYuanbaoReward(amount) {
  const rewardDelta = Math.max(0, amount - state.paidYuanbao);
  state.paidYuanbao = Math.max(state.paidYuanbao, amount);
  state.yuanbao += rewardDelta;
  return rewardDelta;
}

function payForgeMaterialReward(reward) {
  const enhanceDelta = Math.max(0, reward.enhance - state.paidForgeEnhanceStone);
  const starDelta = Math.max(0, reward.star - state.paidForgeStarStone);
  state.paidForgeEnhanceStone = Math.max(state.paidForgeEnhanceStone, reward.enhance);
  state.paidForgeStarStone = Math.max(state.paidForgeStarStone, reward.star);
  state.forgeEnhanceStone += enhanceDelta;
  state.forgeStarStone += starDelta;
  return { enhance: enhanceDelta, star: starDelta };
}

function getStageChestEarned() {
  const ratio = state.maxHp > 0 ? state.hp / state.maxHp : 1;
  // ① 成功通关（防线大于0%，通关即达成）；② 成功防御（防线严格大于 50%）；③ 完美守城（防线等于 100%）
  return stageChestMeta().map((meta) => (meta.inclusive ? ratio >= meta.threshold : ratio > meta.threshold));
}

/* 关卡宝箱领取（2026-09-18 定案）：达成后不自动发放，
   玩家在结算面板点击宝箱领取；没点的在离开结算前由 flushVictoryChests() 补发，绝不漏发。 */
let victoryChestKey = "";
let victoryChestPending = [];
let victoryChestChallenge = false;

function chestMaskOf(key, challenge = isChallengeMode()) {
  const store = challenge ? state.challengeChests : state.stageChests;
  const value = store[String(key)];
  return Number.isSafeInteger(value) ? value : 0;
}

function claimStageChest(index, key, challenge = victoryChestChallenge) {
  const meta = stageChestMeta(challenge)[index];
  if (!meta) return 0;
  const target = String(key === undefined || key === null || key === "" ? state.level : key);
  const store = challenge ? state.challengeChests : state.stageChests;
  const claimed = chestMaskOf(target, challenge);
  const bit = 1 << index;
  if (claimed & bit) return 0;
  store[target] = claimed | bit;
  state.yuanbao += meta.amount;
  saveProgress();
  if (typeof renderHud === "function") renderHud();
  return meta.amount;
}

function grantStageChests(options = {}) {
  const key = String(state.level);
  const challenge = isChallengeMode();
  const metaList = stageChestMeta(challenge);
  const earned = getStageChestEarned();
  const claimed = chestMaskOf(key, challenge);
  let mask = claimed;
  let gained = 0;
  const newly = [false, false, false];
  const pending = [];
  earned.forEach((achieved, index) => {
    if (!achieved) return;
    const bit = 1 << index;
    if (mask & bit) return;
    if (options.defer) {
      pending.push(index);
      return;
    }
    mask |= bit;
    gained += metaList[index].amount;
    newly[index] = true;
  });
  if (mask !== claimed && gained > 0) {
    (challenge ? state.challengeChests : state.stageChests)[key] = mask;
    state.yuanbao += gained;
    saveProgress();
  }
  return { earned, newly, gained, claimed: mask, pending };
}

function flushVictoryChests() {
  if (!victoryChestPending.length) return 0;
  const key = victoryChestKey || String(state.level);
  let total = 0;
  victoryChestPending.slice().forEach((index) => {
    total += claimStageChest(index, key, victoryChestChallenge);
  });
  victoryChestPending = [];
  if (total > 0 && typeof tipText !== "undefined" && tipText) {
    tipText.textContent = `未点击领取的宝箱已自动发放 ${total} 元宝。`;
  }
  return total;
}

function stageChestRowHtml(claimedMask, newly, pendingList = []) {
  const metaList = stageChestMeta(victoryChestChallenge);
  const pending = new Set(pendingList || []);
  const chests = metaList.map((meta, index) => {
    const has = (claimedMask & (1 << index)) !== 0;
    const canClaim = pending.has(index);
    const fresh = newly[index] ? " fresh" : "";
    const cls = `victory-chest${has ? " claimed" : ""}${canClaim ? " claimable" : ""}${fresh}`;
    const hint = canClaim ? "点击领取" : has ? "已领取" : meta.condition;
    const opener = canClaim ? ` data-claim-index="${index}"` : "";
    return `<div class="${cls}" data-chest="${meta.key}"${opener} title="${meta.label}（${meta.condition}）">
        <img src="${ASSET}${has || canClaim ? "home/reward-chest.png" : "home/reward-chest-locked.png"}" alt="" />
        <span>${meta.label}</span>
        <small>${hint}</small>
      </div>`;
  }).join("");
  return `<div class="victory-chests">${chests}</div>`;
}

function breakthroughHero() {
  const requiredLevel = (state.heroBreakthrough + 1) * 10;
  if (!canManageHero() || state.heroLevel < requiredLevel
    || state.heroBreakthrough >= Math.floor((HERO_MAX_LEVEL - 1) / 10)) return false;
  const cost = getHeroBreakthroughCost();
  if (state.yuanbao < cost) return false;
  state.yuanbao -= cost;
  state.heroBreakthrough += 1;
  tipText.textContent = `主角突破成功，可继续提升至 ${Math.min(HERO_MAX_LEVEL, (state.heroBreakthrough + 1) * 10)} 级。`;
  renderHud();
  return true;
}

function checkCombatEnd() {
  if (state.hp <= 0) {
    stopLoop();
    state.phase = "settle";
    render();
    if (isBeastRaid()) showBeastDefeat();
    else showDefeat();
    return;
  }
  if (state.spawned >= state.waveConfig.count && state.monsters.length === 0) {
    stopLoop();
    if (state.round >= state.maxRounds) {
      state.phase = "settle";
      render();
      if (isBeastRaid()) showBeastVictory();
      else showVictory();
    } else {
      state.round += 1;
      state.phase = "setup";
      state.steps = 8;
      if (isBossWave(state.round)) prepareBossWarning();
      addWaveSupply();
      tipText.textContent = "守住了。新一波开始，继续消除并调整阵线。";
      render();
    }
  }
}

function addWaveSupply() {
  refillBoardFromBottom();
}

function renderModalArtwork(title) {
  const artwork = {
    "补充体力": "home/stamina.png",
    "体力不足": "home/stamina.png",
    "边塞商店": "home/nav-shop.png",
    "武将名册": "home/nav-hero.png",
    "角色成长": "home/nav-growth.png",
    "主角技能": "hero.png",
    "局外养成": "home/nav-growth.png",
    "装备打造": "home/nav-growth.png",
    "强化大师": "home/nav-growth.png",
    "升星大师": "home/nav-growth.png",
    "行军包裹": "home/nav-bag.png",
    "每日任务": "home/quest.png",
    "边塞军报": "home/notice.png",
    "异兽击退": "home/reward-chest.png",
    "异兽入侵失败": "home/nav-battle.png",
    "挑战难度": "home/nav-battle.png",
    "胜利结算": "home/reward-chest.png",
    "防线失守": "home/nav-battle.png",
    "本关失败": "home/nav-battle.png",
    "命运三选一": "ui/theme/buff-thunder.png",
    "激励广告（试玩）": "ui/theme/buff-crossfire.png",
    "暂无可合成组合": "ui/theme/buff-crossfire.png",
  };
  modalArt.src = `${ASSET}${artwork[title] || "hero.png"}`;
  modalDetail.replaceChildren();
  let stats = [];
  if (title === "补充体力") stats = [[`${state.stamina}/${state.maxStamina}`, "当前体力"], ["+60", "单次补充"]];
  if (title === "局外养成" || title === "角色成长") stats = [[`Lv.${state.heroLevel}`, "主角等级"], [state.gold, "金币"], [state.yuanbao, "元宝"]];
  const yuanbaoStat = state.paidYuanbao > 0 ? [[`+${state.paidYuanbao}`, "通关元宝"]] : [];
  if (title === "胜利结算") stats = [[`+${state.paidReward}`, "通关金币"], ...yuanbaoStat, [`+${state.paidForgeEnhanceStone} / +${state.paidForgeStarStone}`, "强化石 / 升星石"]];
  if (title === "防线失守" || title === "本关失败") stats = [[`+${state.paidReward}`, "本局金币"], ...yuanbaoStat, [`+${state.paidForgeEnhanceStone} / +${state.paidForgeStarStone}`, "强化石 / 升星石"]];
  stats.forEach(([value, label]) => {
    const item = document.createElement("div");
    const amount = document.createElement("b");
    const caption = document.createElement("span");
    amount.textContent = value;
    caption.textContent = label;
    item.append(amount, caption);
    modalDetail.appendChild(item);
  });
}

function isModalBackAction(action) {
  return Boolean(action && /^(返回(?:主界面|结算)?|关闭(?:广告)?|取消)$/.test(String(action.label || "")));
}

function showModal(title, body, actions = [], options = {}) {
  modalCard.classList.remove("card-draft", "growth-modal", "equipment-modal", "bag-modal", "bag-compact", "forge-modal", "shop-modal", "victory-modal", "army-report-modal", "daily-modal");
  renderModalArtwork(title);
  modalTitle.textContent = title;
  /* 面板可把 #modalBody 挪作他用（如武将界面顶栏的资源胶囊），每次开弹窗先复位 */
  modalBody.className = "";
  modalBody.textContent = body;
  modalDetail.innerHTML = "";
  modalActions.className = "modal-actions";
  modalActions.innerHTML = "";
  const backAction = options.backAction
    ? { onClick: options.backAction }
    : actions.find((action) => action.back) || actions.find(isModalBackAction);
  modalBackButton.hidden = !backAction;
  modalBackButton.onclick = backAction ? () => {
    hideModal();
    if (typeof backAction.onClick === "function") backAction.onClick();
  } : null;
  actions.filter((action) => action !== backAction).forEach((action) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = action.label;
    btn.disabled = Boolean(action.disabled);
    if (action.secondary) btn.classList.add("secondary");
    btn.addEventListener("click", () => {
      hideModal();
      action.onClick();
    });
    modalActions.appendChild(btn);
  });
  modal.classList.remove("hidden");
}

function hideModal() {
  modal.classList.add("hidden");
  modalBackButton.hidden = true;
  modalBackButton.onclick = null;
  armyReportModalOpen = false;
}

function refillStamina(source) {
  refreshStamina();
  if (state.stamina >= STAMINA_OVERFLOW_LIMIT) return;
  if (source === "yuanbao") {
    if (state.staminaPurchaseUsed || state.yuanbao < STAMINA_PURCHASE_COST) return;
    state.yuanbao -= STAMINA_PURCHASE_COST;
    state.staminaPurchaseUsed = true;
    state.stamina = Math.min(STAMINA_OVERFLOW_LIMIT, state.stamina + STAMINA_REFILL_AMOUNT);
    tipText.textContent = `已用 ${STAMINA_PURCHASE_COST} 元宝补充 ${STAMINA_REFILL_AMOUNT} 点体力，今日广告补充仍可使用。`;
  } else {
    if (state.staminaAdUsed) return;
    state.staminaAdUsed = true;
    state.stamina = Math.min(STAMINA_OVERFLOW_LIMIT, state.stamina + STAMINA_REFILL_AMOUNT);
    tipText.textContent = `激励广告完成，补充 ${STAMINA_REFILL_AMOUNT} 点体力。`;
  }
  renderHud();
}

function showStaminaRefill() {
  refreshStamina();
  const atLimit = state.stamina >= STAMINA_OVERFLOW_LIMIT;
  showModal(
    "补充体力",
    `当前体力 ${state.stamina}/${state.maxStamina}，每关消耗 ${STAMINA_COST_PER_LEVEL} 点。自然恢复每 18 分钟 +1，最高恢复到 ${MAX_STAMINA}；元宝购买或广告补充可累计至 ${STAMINA_OVERFLOW_LIMIT}。`,
    [
      {
        label: state.staminaPurchaseUsed ? "今日元宝补充已用" : `元宝补充 ${STAMINA_REFILL_AMOUNT} 点体力（${STAMINA_PURCHASE_COST}元宝）`,
        disabled: state.staminaPurchaseUsed || state.yuanbao < STAMINA_PURCHASE_COST || atLimit,
        onClick: () => refillStamina("yuanbao"),
      },
      {
        label: state.staminaAdUsed ? "今日广告补充已用" : `观看广告 +${STAMINA_REFILL_AMOUNT} 体力`,
        disabled: state.staminaAdUsed || atLimit,
        onClick: () => AdService.showRewarded({
          placement: "体力补充",
          previousPhase: state.phase,
          onComplete: () => refillStamina("ad"),
        }),
      },
      { label: "关闭", secondary: true, onClick: () => {} },
    ],
  );
}

function finishMergeHintAd(completed, resumeCombat = true) {
  const ad = state.hintAd;
  if (!ad) return;
  clearInterval(ad.timer);
  state.hintAd = null;
  state.phase = ad.previousPhase;
  hideModal();
  ad.animations.forEach((animation) => animation.play());
  if (completed && ad.elapsed >= HINT_AD_DURATION_MS
    && ad.resolutionId === state.resolutionId && state.mergeHintsUsed < MAX_MERGE_HINTS) {
    const hint = findHintMoves();
    if (hint) {
      state.mergeHintsUsed += 1;
      state.hintIndices = hint.indices;
      state.hintPair = hint.pair;
    }
  }
  renderMergeHint();
  renderHud();
  if (resumeCombat && currentView === "battle" && state.phase === "combat") runLoop();
}

function showMergeHintAd() {
  if (!canRequestMergeHint() || !modal.classList.contains("hidden")) return;
  if (!findHintMoves()) {
    showModal("暂无可合成组合", "本次未消耗提示次数。", [], { backAction: () => {} });
    return;
  }
  AdService.showRewarded({
    placement: `棋盘提示 · 本局剩余 ${MAX_MERGE_HINTS - state.mergeHintsUsed} 次`,
    previousPhase: state.phase,
    duration: HINT_AD_DURATION_MS,
    onComplete: () => {
      const hint = findHintMoves();
      if (hint && state.mergeHintsUsed < MAX_MERGE_HINTS) {
        state.mergeHintsUsed += 1;
        state.hintIndices = hint.indices;
        state.hintPair = hint.pair;
      }
      renderMergeHint();
    },
  });
}

function applyCard(card) {
  if (card.id === "frost") {
    state.monsters.forEach((monster) => {
      monster.rootRemaining = Math.max(monster.rootRemaining || 0, 3);
    });
    cardBurst();
    return;
  }
  if (card.id === "thunder") {
    state.monsters.forEach((monster) => {
      const damage = Math.max(35, monster.maxHp * 0.35);
      monster.hp -= damage;
      damageBurstAtMonster(monster, `-${Math.round(damage)}`, { emphasized: true });
    });
    cardBurst();
    removeDefeatedMonsters();
    return;
  }
  if (card.id === "war-cry") {
    state.damageMultiplier *= 1.25;
    return;
  }
  if (card.id === "rapid-fire") {
    state.attackSpeedMultiplier *= 1.22;
    return;
  }
  if (card.id === "crossfire") {
    state.attackMode = "wide";
    return;
  }
  if (card.id === "execution") {
    state.executionReady = true;
  }
}

function chooseCard(card) {
  applyCard(card);
  state.cardsOffered += 1;
  state.killsSinceCard = 0;
  state.cardCooldown = 1.5;
  state.nextCardKillTarget = state.cardsOffered < CARD_KILL_STEPS.length
    ? CARD_KILL_STEPS[state.cardsOffered]
    : Infinity;
  state.cardQueued = false;
  state.phase = "combat";
  hideModal();
  tipText.textContent = state.cardsOffered < CARD_KILL_STEPS.length
    ? `已获得「${card.title}」。继续守城，下一张卡牌还需击杀 ${state.nextCardKillTarget} 个怪物。`
    : `已获得「${card.title}」。本局卡牌已全部获得。`;
  render();
  runLoop();
}

function openCardChoice() {
  if (state.cardsOffered >= CARD_KILL_STEPS.length) return;
  state.cardQueued = false;
  state.phase = "card";
  stopLoop();
  render();
  modalBackButton.hidden = true;
  modalBackButton.onclick = null;
  modalCard.classList.remove("growth-modal", "equipment-modal", "bag-modal", "bag-compact");
  modalCard.classList.add("card-draft");
  renderModalArtwork("命运三选一");
  const choices = shuffled(CARD_DEFINITIONS).slice(0, 3);
  modalTitle.textContent = "命运三选一";
  modalBody.textContent = `击杀 ${state.totalKills} 个怪物，选择一张卡牌加入本局。`;
  modalActions.className = "modal-actions card-options";
  modalActions.innerHTML = "";
  choices.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-choice";
    button.dataset.cardStyle = String(index + 1);
    button.setAttribute("aria-label", `${card.title}：${card.description}`);
    button.innerHTML = `
      <span class="card-mark"><img src="./public/assets/ui/theme/buff-${card.id}.png" alt="" /></span>
      <span class="card-copy">
        <strong>${card.title}</strong>
        <small>${card.tag}</small>
        <em>${card.description}</em>
      </span>
      <span class="card-arrow" aria-hidden="true">›</span>
    `;
    button.addEventListener("click", () => chooseCard(card));
    modalActions.appendChild(button);
  });
  modal.classList.remove("hidden");
}

function showDefeat() {
  updateDailyProgress("play");
  payLevelReward(getFailureReward());
  payYuanbaoReward(getFailureYuanbaoReward());
  payForgeMaterialReward(getFailureForgeMaterialReward());
  renderHud();
  const ybText = state.paidYuanbao > 0 ? `${state.paidYuanbao} 元宝、` : "";
  const rewardText = `本关累计奖励 ${state.paidReward} 金币、${ybText}强化石 ${state.paidForgeEnhanceStone}、升星石 ${state.paidForgeStarStone}（全额奖励 × 到达波次比例 × 60%）。`;
  if (!state.revived) {
    showModal("防线失守", `${rewardText} 模拟激励广告复活：回满防线 HP，并重新挑战当前波。`, [
      { label: "看广告复活", onClick: () => AdService.showRewarded({ placement: "失败复活", onComplete: revive }) },
      { label: "局外养成", secondary: true, onClick: () => showGrowthModal(showDefeat) },
      { label: "重开本关", secondary: true, onClick: resetGame },
      { label: "返回主界面", secondary: true, onClick: returnToHomeAfterDefeat },
    ]);
  } else {
    showModal("本关失败", `${rewardText} 本局复活机会已经用完，可以重开再试。`, [
      { label: "局外养成", secondary: true, onClick: () => showGrowthModal(showDefeat) },
      { label: "重开本关", onClick: resetGame },
      { label: "返回主界面", secondary: true, onClick: returnToHomeAfterDefeat },
    ]);
  }
}

function returnToHomeAfterDefeat() {
  resetGame();
  showHome();
}

function revive() {
  state.revived = true;
  state.hp = state.maxHp;
  state.steps = 8;
  state.phase = "setup";
  state.monsters = [];
  state.spawned = 0;
  tipText.textContent = "复活成功。先完成几次消除，再出怪。";
  addWaveSupply();
  render();
}

function showVictory() {
  updateDailyProgress("play");
  const equipmentDrop = grantEquipmentDrop() || state.lastEquipmentDrop;
  const adEquipmentDrop = state.doubled ? grantSettlementAdEquipmentDrop() : null;
  state.highestUnlockedLevel = Math.max(state.highestUnlockedLevel, state.level + 1);
  const rewardMultiplier = state.doubled ? 2 : 1;
  const challengeMultiplier = stageRewardMultiplier();
  payLevelReward(getFullLevelReward() * challengeMultiplier * rewardMultiplier);
  payYuanbaoReward(getFullYuanbaoReward() * rewardMultiplier);
  const forgeReward = getFullForgeMaterialReward();
  payForgeMaterialReward({
    enhance: forgeReward.enhance * challengeMultiplier * rewardMultiplier,
    star: forgeReward.star * challengeMultiplier * rewardMultiplier,
  });
  const chestResult = grantStageChests({ defer: true });
  let expGain = state.levelExpAwarded ? state.levelExpGain : 0;
  let leveled = state.levelExpAwarded ? state.levelExpLeveled : 0;
  if (!state.levelExpAwarded) {
    expGain = heroExpPerStage();
    leveled = awardHeroExp(expGain);
    state.levelExpAwarded = true;
    state.levelExpGain = expGain;
    state.levelExpLeveled = leveled;
  }
  if (state.doubled && !state.settlementAdHeroExpGranted) {
    const bonusExp = state.levelExpGain || heroExpPerStage();
    const bonusLevels = awardHeroExp(bonusExp);
    state.settlementAdHeroExpGranted = true;
    state.levelExpGain += bonusExp;
    state.levelExpLeveled += bonusLevels;
    expGain = state.levelExpGain;
    leveled = state.levelExpLeveled;
  }
  renderHud();
  const dropParts = [];
  const challengeDrops = isChallengeMode() ? (state.lastChallengeEquipmentDrops || []) : [];
  if (challengeDrops.length) {
    const names = challengeDrops.map((item) => `${qualityInfo(item.quality).name}·${equipmentName(item)}`).join("、");
    dropParts.push(`挑战必得装备 ${names}`);
  } else if (equipmentDrop) {
    dropParts.push(`关卡掉落 ${qualityInfo(equipmentDrop.quality).name}·${equipmentName(equipmentDrop)}`);
  }
  if (adEquipmentDrop) dropParts.push(`广告额外获得 ${qualityInfo(adEquipmentDrop.quality).name}·${equipmentName(adEquipmentDrop)}`);
  const dropText = dropParts.length
    ? `${dropParts.join("；")}。`
    : `本关未掉落装备（基础掉落率 ${Math.round(EQUIPMENT_DROP_CHANCE * 100)}%，连续 ${EQUIPMENT_DROP_PITY_MISSES} 次未掉落后保底；广告额外抽取率 ${Math.round(SETTLEMENT_AD_EQUIPMENT_CHANCE * 100)}%）。`;
  let expLine;
  if (state.heroLevel >= HERO_MAX_LEVEL) expLine = `主角已满级（Lv.${HERO_MAX_LEVEL}），本关不再获得经验。`;
  else if (leveled > 0) expLine = `获得经验 ${formatPower(expGain)}，主角升至 ${state.heroLevel} 级（防线血量上限 ${state.maxHp}）！`;
  else expLine = `获得经验 ${formatPower(expGain)}。`;
  const pendingChests = chestResult.pending.length;
  const chestLine = pendingChests > 0
    ? `${isChallengeMode() ? "挑战" : "普通"}关卡宝箱解锁 ${pendingChests} 个，点击宝箱即可领取元宝。`
    : `本关三个宝箱的元宝奖励此前已领取。`;
  const ybLine = state.paidYuanbao > 0 ? `${state.paidYuanbao} 元宝、` : "";
  const body = `本关结算 ${state.paidReward} 金币、${ybLine}强化石 ${state.paidForgeEnhanceStone}、升星石 ${state.paidForgeStarStone}。${chestLine}${expLine}${dropText}`;
  showModal("胜利结算", body, [
    {
      label: state.doubled ? "已双倍，下一关" : "看广告双倍结算 + 额外装备",
      onClick: () => {
        if (!state.doubled) {
          AdService.showRewarded({
            placement: "结算双倍",
            onComplete: () => {
              state.doubled = true;
              showVictory();
            },
          });
        } else {
          flushVictoryChests();
          if (isChallengeMode()) {
            resetGame();
            showHome();
          } else {
            nextLevel();
          }
        }
      },
    },
    { label: "局外养成", secondary: true, onClick: () => { flushVictoryChests(); showGrowthModal(showVictory); } },
    { label: "下一关", secondary: true, onClick: () => { flushVictoryChests(); nextLevel(); } },
    { label: "返回主界面", secondary: true, onClick: () => { flushVictoryChests(); completeLevelToHome(); } },
  ]);
  modalCard.classList.add("victory-modal");
  victoryChestKey = String(state.level);
  victoryChestPending = chestResult.pending.slice();
  victoryChestChallenge = isChallengeMode();
  modalDetail.innerHTML = stageChestRowHtml(chestResult.claimed, chestResult.newly, chestResult.pending);
  modalDetail.onclick = (event) => {
    const node = event.target && event.target.closest ? event.target.closest("[data-claim-index]") : null;
    if (!node) return;
    const index = Number(node.dataset.claimIndex);
    if (!victoryChestPending.includes(index)) return;
    const gain = claimStageChest(index, victoryChestKey);
    if (!gain) return;
    victoryChestPending = victoryChestPending.filter((item) => item !== index);
    node.classList.remove("claimable", "fresh");
    node.classList.add("claimed");
    node.removeAttribute("data-claim-index");
    const hint = node.querySelector("small");
    if (hint) hint.textContent = "已领取";
    const icon = node.querySelector("img");
    if (icon) icon.src = `${ASSET}home/reward-chest.png`;
    if (typeof tipText !== "undefined" && tipText) {
      tipText.textContent = `领取「${stageChestMeta(victoryChestChallenge)[index].label}」宝箱，获得 ${gain} 元宝。`;
    }
  };
}

/* ========== 武将成长面板（2026-09-22 按超哥 UI 示意图重做）==========
   自上而下：三段式顶栏（返回 / 标题 / 元宝·金币）→ 武将页签 → 模型与六槽位
   → 属性汇总 → 突破（独立按钮）→ 可穿戴装备（一键穿戴 + 包裹格子）。
   突破原本与「一键穿戴」共用同一个按钮，本版拆成两个独立入口；
   「打开包裹」按钮按示意图移除（包裹仍可从主页进入）。 */
function showEquipmentGrowth(onBack = showHome) {
  const type = state.selectedWarriorType;
  const warrior = getWarriorAppearance(type);
  const quality = state.warriorQuality[type] || 1;
  const qualityData = qualityInfo(quality);
  const status = getEquipmentSetStatus(type);
  const cost = EQUIPMENT_BREAKTHROUGH_COSTS[quality - 1] || 150;
  const previewData = warriorBreakthroughPreview(type, quality);
  const isMaxQuality = quality >= MAX_WARRIOR_QUALITY;
  const yuanbaoLack = state.yuanbao < cost;
  const canBreak = canManageHero() && status.complete && !isMaxQuality && !yuanbaoLack;

  showModal("武将成长", "", [], { backAction: onBack });
  modalCard.classList.add("equipment-modal");

  /* 顶栏右侧资源胶囊借 #modalBody 这一格渲染，与居中的标题叠在同一 grid 单元，
     形成「返回 / 标题 / 元宝·金币」三段式顶栏（样式见 theme.css 的 equipment-wallet）。 */
  modalBody.className = "equipment-wallet";
  modalBody.innerHTML = `<span class="equipment-wallet-item"><img src="${ASSET}home/premium.png" alt="元宝" /><b>${formatCurrency(state.yuanbao)}</b></span><span class="equipment-wallet-item"><img src="${ASSET}icon-coin.png" alt="金币" /><b>${formatCurrency(state.gold)}</b></span>`;

  const gainCells = [
    { key: "attack", label: "攻击" },
    { key: "crit", label: "暴击" },
    { key: "hit", label: "命中" },
    { key: "speed", label: "攻速" },
  ].map(({ key, label }) => {
    const value = Math.round(previewData.retained[key] || 0);
    return `<span class="bt-gain${value > 0 ? " up" : ""}"><i>${label}</i><b>${value > 0 ? "+" + formatStatValue(value, key) : "—"}</b></span>`;
  }).join("");

  /* 突破区里的条件只放短标签：长句会把「需要」列撑宽，反过来挤扁左侧属性提升列。
     详细说明交给下方的 .equipment-equip-status 一行。 */
  const breakCondition = isMaxQuality
    ? "无需消耗"
    : !status.complete
      ? `缺 ${EQUIPMENT_SLOTS.length - status.count} 件`
      : yuanbaoLack
        ? "元宝不足"
        : "可突破";

  const panel = document.createElement("div");
  panel.className = "equipment-panel";
  panel.innerHTML = `<div class="equipment-tabs">${WARRIORS.map((entry) => `<button type="button" data-warrior-tab="${entry.type}" class="${entry.type === type ? "active" : ""}">${entry.name}</button>`).join("")}</div>
    <div class="equipment-stage">
      <div class="equipment-slots equipment-slots-left"></div>
      <div class="equipment-model" style="--quality-color:${qualityData.color}"><div class="equipment-model-ring"><img src="${ASSET}${warrior.previewImage}" alt="${warrior.name}" data-action="idle" data-model-quality="${warrior.modelQuality}" /></div><strong>${warrior.name}</strong><small>${qualityData.name} · ${status.count}/6 部位</small><small>战力 ${formatPower(warriorPower(type))}</small></div>
      <div class="equipment-slots equipment-slots-right"></div>
    </div>
    <div class="equipment-stats"><span><b data-stat="attack">0</b><small>攻击力</small></span><span><b data-stat="crit">0</b><small>暴击值</small></span><span><b data-stat="hit">0</b><small>命中值</small></span><span><b data-stat="speed">0%</b><small>攻速</small></span></div>
    <section class="equipment-breakthrough">
      <div class="bt-head"><strong>突破</strong><span>${isMaxQuality ? `${qualityData.name} · 当前最高品质` : `${qualityData.name} → ${previewData.nextQualityData.name}`}</span></div>
      <div class="bt-body">
        <span class="bt-model"><img src="${ASSET}${previewData.nextAppearance.previewImage}" alt="${isMaxQuality ? "当前形态" : "突破后形态"}" /><i>${isMaxQuality ? "当前" : "突破后"}</i></span>
        <span class="bt-arrow" aria-hidden="true">→</span>
        <div class="bt-gains">${gainCells}</div>
        <div class="bt-cost"><span class="bt-cost-line"><i>需要</i><img src="${ASSET}home/premium.png" alt="元宝" /><b class="bt-cost-value${!isMaxQuality && yuanbaoLack ? " lack" : ""}">${formatCurrency(cost)}</b></span><span class="bt-condition">${breakCondition}</span></div>
        <button type="button" class="bt-button"${canBreak ? "" : " disabled"}>${isMaxQuality ? "已满" : "突破"}</button>
      </div>
      <p class="bt-skill">突破技能：${previewData.skillText}</p>
    </section>
    <div class="equipment-compatible">
      <div class="equipment-compatible-header"><strong>可穿戴装备</strong><button class="equipment-auto-equip" type="button" title="为当前武将补齐同品质的空装备位"><img src="${ASSET}${EQUIPMENT_ICONS.armor}" alt="" />一键穿戴</button></div>
      <div class="equipment-equip-status" role="status" aria-live="polite"></div>
      <div class="equipment-compatible-list" role="region" aria-label="可穿戴装备" tabindex="0"></div>
    </div>`;

  const renderSlot = (slot) => {
    const info = slotInfo(slot);
    const item = warriorEquipmentFor(type)[slot];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `equipment-slot${item ? " filled" : ""}`;
    button.style.setProperty("--quality-color", item ? qualityInfo(item.quality).color : "#a7bab1");
    const slotQuality = item ? qualityInfo(item.quality) : null;
    button.innerHTML = `<img class="equipment-slot-base" src="${ASSET}ui/character/equipment-slot.png" alt="" />${item
      ? `<span class="equipment-quality-frame"><img src="${ASSET}${slotQuality.asset}" alt="" /><img class="equipment-icon" src="${ASSET}${EQUIPMENT_ICONS[slot]}" alt="" /></span><b>${info.name}</b><small>${formatStatValue(item.value, info.stat)}</small>`
      : `<span class="equipment-slot-label">${info.name}</span>`}`;
    button.title = item ? `${equipmentName(item)} · ${info.name} · 点击卸下` : `${info.name}：空槽位`;
    button.setAttribute("aria-label", button.title);
    if (item) button.addEventListener("click", () => { unequipEquipment(slot, type); showEquipmentGrowth(onBack); });
    return button;
  };
  /* 左右分列按 EQUIPMENT_SLOT_COLUMNS：左 武器/头盔/衣服，右 护腕/靴子/饰品 */
  EQUIPMENT_SLOT_COLUMNS.left.forEach((slot) => panel.querySelector(".equipment-slots-left").appendChild(renderSlot(slot)));
  EQUIPMENT_SLOT_COLUMNS.right.forEach((slot) => panel.querySelector(".equipment-slots-right").appendChild(renderSlot(slot)));

  const bonuses = getWarriorCombatStats(type);
  Object.keys(bonuses).forEach((stat) => { const element = panel.querySelector(`[data-stat="${stat}"]`); if (element) element.textContent = formatStatValue(bonuses[stat], stat); });

  const compatible = state.equipmentInventory.filter((item) => item.quality === quality);
  const compatibleList = panel.querySelector(".equipment-compatible-list");
  compatible.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.style.setProperty("--quality-color", qualityData.color);
    button.innerHTML = `<span class="equipment-quality-frame"><img src="${ASSET}${qualityData.asset}" alt="" /><img class="equipment-icon" src="${ASSET}${EQUIPMENT_ICONS[item.slot]}" alt="" /></span><b>${slotInfo(item.slot).name}</b><small>${equipmentValueText(item)}</small>`;
    button.title = `${equipmentName(item)} · 点击穿戴`;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", () => { equipEquipment(item.id, type); showEquipmentGrowth(onBack); });
    compatibleList.appendChild(button);
  });
  if (!compatible.length) compatibleList.innerHTML = '<small class="equipment-empty">暂无同品质装备，可在关卡结算或包裹合成中获取</small>';

  const autoEquipButton = panel.querySelector(".equipment-auto-equip");
  autoEquipButton.disabled = !canManageHero() || status.complete || getAutoEquipCandidates(type).length === 0;
  if (status.complete) {
    autoEquipButton.classList.add("done");
    autoEquipButton.innerHTML = `<img src="${ASSET}${EQUIPMENT_ICONS.armor}" alt="" />已穿齐`;
  }
  autoEquipButton.addEventListener("click", () => {
    if (autoEquipButton.disabled) return;
    const equippedCount = autoEquipEquipment(type);
    showEquipmentGrowth(onBack);
    if (!getEquipmentSetStatus(type).complete) {
      const statusNode = modalDetail.querySelector(".equipment-equip-status");
      if (statusNode) statusNode.textContent = equippedCount ? `已穿戴 ${equippedCount} 件装备` : "暂无可穿戴装备";
    }
  });

  const conditionEl = panel.querySelector(".equipment-equip-status");
  if (conditionEl) {
    conditionEl.textContent = isMaxQuality
      ? "已达当前版本最高品质"
      : !status.complete
        ? `同品质装备 ${status.count}/6，穿齐后可突破`
        : yuanbaoLack
          ? `突破需要 ${cost} 元宝，当前还差 ${formatCurrency(cost - state.yuanbao)}`
          : `可突破：消耗 ${cost} 元宝，全身属性永久保留`;
  }

  const btButton = panel.querySelector(".bt-button");
  if (btButton) btButton.addEventListener("click", () => {
    if (btButton.disabled) return;
    const nextName = qualityInfo(Math.min(MAX_WARRIOR_QUALITY, quality + 1)).name;
    const success = breakthroughWarrior(type);
    showEquipmentGrowth(onBack);
    if (success) {
      renderHud();
      const hint = modalDetail.querySelector(".equipment-equip-status");
      if (hint) hint.textContent = `已突破至${nextName}，全身 6 件装备属性已永久保留`;
    }
  });

  panel.querySelectorAll("[data-warrior-tab]").forEach((button) => button.addEventListener("click", () => {
    state.selectedWarriorType = button.dataset.warriorTab;
    showEquipmentGrowth(onBack);
  }));

  modalDetail.appendChild(panel);
}

function showBagShell(title, onBack, compact = false) {
  showModal(title, "", [], { backAction: onBack });
  modalCard.classList.add("bag-modal");
  if (compact) modalCard.classList.add("bag-compact");
  modalDetail.innerHTML = `<div class="bag-navigation"><span>装备 ${state.equipmentInventory.length} 件</span><span class="bag-wallet"><img src="${ASSET}icon-coin.png" alt="金币" /><strong>${formatCurrency(state.gold)}</strong></span></div><div class="bag-content"></div><div class="bag-notice" role="status" aria-live="polite"></div>`;
  return { content: modalDetail.querySelector(".bag-content"), notice: modalDetail.querySelector(".bag-notice") };
}

function addBagAction(label, onClick, color = "green") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `bag-action bag-action-${color}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  modalActions.appendChild(button);
  return button;
}

function bagItemArtwork(item) {
  return `<img class="bag-quality" src="${ASSET}${qualityInfo(item.quality).asset}" alt="" /><img class="bag-item-icon" src="${ASSET}${EQUIPMENT_ICONS[item.slot]}" alt="" />`;
}

function createBagItem(item, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bag-item";
  button.dataset.equipmentId = item.id;
  button.title = `${equipmentName(item)} · ${qualityInfo(item.quality).name} · ${slotInfo(item.slot).label} +${equipmentValueText(item)}`;
  button.setAttribute("aria-label", button.title);
  button.innerHTML = `${bagItemArtwork(item)}<img class="bag-check" src="${ASSET}ui/bag/selected.png" alt="" />`;
  button.addEventListener("click", () => onClick(item));
  return button;
}

function appendBagFilters(parent, filters, onChange) {
  const row = document.createElement("div");
  row.className = "bag-filters";
  row.innerHTML = `<select aria-label="品质筛选"><option value="0">全部品质</option>${EQUIPMENT_QUALITY.map((quality) => `<option value="${quality.id}">${quality.name} · ${quality.prefix}</option>`).join("")}</select><select aria-label="部位筛选"><option value="all">全部部位</option>${EQUIPMENT_SLOTS.map((slot) => `<option value="${slot.id}">${slot.name}</option>`).join("")}</select>`;
  const [qualitySelect, slotSelect] = row.querySelectorAll("select");
  qualitySelect.value = String(filters.quality);
  slotSelect.value = filters.slot;
  qualitySelect.addEventListener("change", () => { filters.quality = Number(qualitySelect.value); onChange(); });
  slotSelect.addEventListener("change", () => { filters.slot = slotSelect.value; onChange(); });
  parent.appendChild(row);
}

function filteredBagItems(filters) {
  return state.equipmentInventory.filter((item) => (!filters.quality || item.quality === filters.quality)
    && (filters.slot === "all" || item.slot === filters.slot))
    .sort((left, right) => right.quality - left.quality
      || EQUIPMENT_SLOTS.findIndex((slot) => slot.id === left.slot) - EQUIPMENT_SLOTS.findIndex((slot) => slot.id === right.slot)
      || left.id - right.id);
}

function fillBagGrid(grid, items, onClick) {
  grid.replaceChildren();
  items.forEach((item) => grid.appendChild(createBagItem(item, onClick)));
  const slotCount = Math.max(25, Math.ceil(items.length / 5) * 5);
  for (let index = items.length; index < slotCount; index += 1) {
    const empty = document.createElement("div");
    empty.className = "bag-empty-slot";
    empty.setAttribute("aria-hidden", "true");
    grid.appendChild(empty);
  }
}

function showEquipmentBag(onBack = showHome, filters = { quality: 0, slot: "all" }, message = "") {
  const { content, notice } = showBagShell("行军包裹", onBack);
  const returnToBag = (status = "") => showEquipmentBag(onBack, filters, status);
  appendBagFilters(content, filters, () => returnToBag());
  const grid = document.createElement("div");
  grid.className = "bag-grid";
  content.appendChild(grid);
  fillBagGrid(grid, filteredBagItems(filters), (item) => showEquipmentSale(item, () => returnToBag(), returnToBag));
  notice.textContent = message || (!state.equipmentInventory.length ? "暂无装备" : !grid.querySelector("button") ? "当前筛选下暂无装备" : "");
  const recycle = addBagAction("批量回收", () => showEquipmentSelector("recycle", [], (ids, back) => showEquipmentSaleConfirm(ids, back, returnToBag), () => returnToBag()), "blue");
  recycle.disabled = !canManageHero() || !state.equipmentInventory.length;
  addBagAction("装备合成", () => showEquipmentSynthesis(() => returnToBag()));
}

function showEquipmentSelector(mode, initialIds, onDone, onBack) {
  const isSynthesis = mode === "synthesis";
  const chosen = new Set(initialIds.filter((id) => state.equipmentInventory.some((item) => item.id === id)));
  const filters = { quality: 0, slot: "all" };
  const { content, notice } = showBagShell(isSynthesis ? "选择合成材料" : "批量回收", onBack);
  appendBagFilters(content, filters, () => renderGrid());
  const toolsRow = document.createElement("div");
  toolsRow.className = "bag-selection-tools";
  const summary = document.createElement("strong");
  toolsRow.appendChild(summary);
  let selectAll;
  if (!isSynthesis) {
    const label = document.createElement("label");
    label.innerHTML = '<input type="checkbox" />全选当前筛选';
    selectAll = label.querySelector("input");
    selectAll.addEventListener("change", () => {
      filteredBagItems(filters).forEach((item) => selectAll.checked ? chosen.add(item.id) : chosen.delete(item.id));
      updateSelection();
    });
    toolsRow.appendChild(label);
  }
  content.appendChild(toolsRow);
  const grid = document.createElement("div");
  grid.className = "bag-grid";
  content.appendChild(grid);
  const confirm = addBagAction(isSynthesis ? "放入材料" : "回收所选", () => {
    const ids = [...chosen];
    onDone(ids, () => showEquipmentSelector(mode, ids, onDone, onBack));
  }, isSynthesis ? "green" : "gold");
  const clear = addBagAction("取消选择", () => { chosen.clear(); updateSelection(); }, "blue");
  function updateSelection() {
    const inventory = new Map(state.equipmentInventory.map((item) => [item.id, item]));
    const first = state.equipmentInventory.find((item) => chosen.has(item.id));
    grid.querySelectorAll("button").forEach((button) => {
      const item = inventory.get(Number(button.dataset.equipmentId));
      const selected = chosen.has(item.id);
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = !canManageHero() || (isSynthesis && !selected
        && (chosen.size >= 5 || item.quality === 7 || (first && first.quality !== item.quality)));
    });
    summary.textContent = isSynthesis ? `材料 ${chosen.size}/5${first ? ` · ${qualityInfo(first.quality).name}` : ""}` : `已选 ${chosen.size} 件`;
    notice.textContent = isSynthesis ? "同品质 5 合 1，金色不可合成" : `出售合计 ${state.equipmentInventory.filter((item) => chosen.has(item.id)).reduce((total, item) => total + equipmentSalePrice(item), 0)} 金币`;
    confirm.disabled = !canManageHero() || !chosen.size;
    clear.disabled = !chosen.size;
    if (selectAll) {
      const visible = filteredBagItems(filters);
      const selectedCount = visible.filter((item) => chosen.has(item.id)).length;
      selectAll.checked = visible.length > 0 && selectedCount === visible.length;
      selectAll.indeterminate = selectedCount > 0 && selectedCount < visible.length;
      selectAll.disabled = !canManageHero() || !visible.length;
    }
  }
  function renderGrid() {
    fillBagGrid(grid, filteredBagItems(filters), (item) => {
      if (chosen.has(item.id)) chosen.delete(item.id);
      else chosen.add(item.id);
      updateSelection();
    });
    updateSelection();
  }
  renderGrid();
}

function showEquipmentSale(item, onBack, onComplete) {
  const matching = state.equipmentInventory.filter((entry) => entry.quality === item.quality && entry.slot === item.slot && entry.value === item.value);
  if (!matching.length) { onBack(); return; }
  const { content } = showBagShell("出售装备", onBack, true);
  const price = equipmentSalePrice(item);
  content.innerHTML = `<div class="bag-item-detail"><div class="bag-item-display">${bagItemArtwork(item)}</div><h3>${equipmentName(item)}</h3><span>${qualityInfo(item.quality).name}品质 · ${slotInfo(item.slot).label} +${equipmentValueText(item)}</span><small>持有 ${matching.length} 件 · 单价 ${price} 金币</small></div><div class="bag-quantity"><button type="button" aria-label="减少出售数量" title="减少"><img src="${ASSET}ui/bag/minus.png" alt="" /></button><label><span>出售数量</span><input type="number" min="1" max="${matching.length}" step="1" value="1" aria-label="出售数量" /></label><button type="button" aria-label="增加出售数量" title="增加"><img src="${ASSET}ui/stamina-plus.png" alt="" /></button></div><div class="bag-sale-total"></div>`;
  const input = content.querySelector("input");
  const [minus, plus] = content.querySelectorAll(".bag-quantity button");
  let quantity = 1;
  function updateQuantity() {
    quantity = Math.max(1, Math.min(matching.length, Math.floor(Number(input.value)) || 1));
    input.value = quantity;
    minus.disabled = quantity <= 1;
    plus.disabled = quantity >= matching.length;
    content.querySelector(".bag-sale-total").textContent = `可获得 ${quantity * price} 金币`;
  }
  input.addEventListener("input", updateQuantity);
  minus.addEventListener("click", () => { input.value = quantity - 1; updateQuantity(); });
  plus.addEventListener("click", () => { input.value = quantity + 1; updateQuantity(); });
  const sell = addBagAction("出售", () => showEquipmentSaleConfirm(matching.slice(0, quantity).map((entry) => entry.id), () => showEquipmentSale(item, onBack, onComplete), onComplete), "gold");
  sell.disabled = !canManageHero();
  updateQuantity();
}

function showEquipmentSaleConfirm(ids, onBack, onComplete) {
  const items = getOwnedBagItems(ids);
  if (!items) { onBack(); return; }
  const { content, notice } = showBagShell("确认出售", onBack, true);
  const total = items.reduce((sum, item) => sum + equipmentSalePrice(item), 0);
  const highestQuality = Math.max(...items.map((item) => item.quality));
  content.innerHTML = `<div class="bag-confirm-summary"><img src="${ASSET}icon-coin.png" alt="" /><h3>${total} <small>金币</small></h3><p>出售 ${items.length} 件装备</p><small>最高品质：${qualityInfo(highestQuality).name}</small></div><div class="bag-sale-preview">${items.slice(0, 5).map((item) => `<div class="bag-item-display">${bagItemArtwork(item)}</div>`).join("")}</div><p class="bag-risk">出售后装备将被消耗，无法撤回</p>`;
  const confirm = addBagAction("确认出售", () => {
    confirm.disabled = true;
    const result = sellEquipment(ids);
    if (!result.ok) { notice.textContent = result.message; return; }
    renderHud();
    onComplete(`已出售 ${result.count} 件装备，获得 ${result.gold} 金币`);
  }, "gold");
  confirm.disabled = !canManageHero();
  addBagAction("取消", onBack, "blue");
}

function showEquipmentSynthesis(onBack, selectedIds = [], message = "") {
  const ids = selectedIds.filter((id) => state.equipmentInventory.some((item) => item.id === id));
  const materials = ids.map((id) => state.equipmentInventory.find((item) => item.id === id));
  const quality = materials[0]?.quality;
  const { content, notice } = showBagShell("装备合成", onBack);
  content.classList.add("bag-synthesis-content");
  const arena = document.createElement("div");
  arena.className = "synthesis-arena";
  arena.innerHTML = `<div class="synthesis-output"><div class="bag-item-display">${quality ? `<img class="bag-quality" src="${ASSET}ui/bag/quality-${quality + 1}.png" alt="" />` : ""}<span>?</span></div><strong>${quality ? `${qualityInfo(quality + 1).name}装备` : "合成结果"}</strong><small>随机部位</small></div>`;
  for (let index = 0; index < 5; index += 1) {
    const item = materials[index];
    const angle = (index * 72 - 90) * Math.PI / 180;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `synthesis-input${item ? " filled" : ""}`;
    button.style.setProperty("--slot-x", `${50 + Math.cos(angle) * 37}%`);
    button.style.setProperty("--slot-y", `${47 + Math.sin(angle) * 34}%`);
    button.setAttribute("aria-label", item ? `移除材料 ${equipmentName(item)}` : `添加第 ${index + 1} 件材料`);
    button.title = button.getAttribute("aria-label");
    button.innerHTML = item ? `${bagItemArtwork(item)}<img class="synthesis-remove" src="${ASSET}ui/bag/minus.png" alt="" />`
      : `<img class="synthesis-plus" src="${ASSET}ui/stamina-plus.png" alt="" />`;
    button.addEventListener("click", () => item
      ? showEquipmentSynthesis(onBack, ids.filter((id) => id !== item.id))
      : showEquipmentSelector("synthesis", ids, (chosen) => showEquipmentSynthesis(onBack, chosen), () => showEquipmentSynthesis(onBack, ids)));
    const arrow = document.createElement("img");
    arrow.className = "synthesis-arrow";
    arrow.src = `${ASSET}ui/bag/arrow.png`;
    arrow.alt = "";
    arrow.style.left = `${50 + Math.cos(angle) * 22}%`;
    arrow.style.top = `${47 + Math.sin(angle) * 20}%`;
    arrow.style.transform = `translate(-50%, -50%) rotate(${index * 72 + 90}deg)`;
    arena.append(arrow, button);
  }
  content.appendChild(arena);
  const meta = document.createElement("div");
  meta.className = "synthesis-meta";
  meta.innerHTML = `<div><span>材料</span><strong>${ids.length} / 5</strong></div><div><span>成功率</span><strong>${quality ? `${Math.round(EQUIPMENT_SYNTHESIS_RATES[quality - 1] * 100)}%` : "--"}</strong></div><div><span>金币消耗</span><strong>${quality ? EQUIPMENT_SYNTHESIS_COSTS[quality - 1] : "--"}</strong></div>`;
  content.appendChild(meta);
  const risk = document.createElement("p");
  risk.className = "bag-risk";
  risk.textContent = "同品质 5 合 1，失败也会消耗材料和金币";
  content.appendChild(risk);
  notice.textContent = message || (quality && state.gold < EQUIPMENT_SYNTHESIS_COSTS[quality - 1] ? "金币不足" : "");
  const quickAdd = addBagAction(ids.length ? "全部移除" : "快速添加", () => {
    if (ids.length) { showEquipmentSynthesis(onBack); return; }
    const available = EQUIPMENT_QUALITY.find((entry) => entry.id < 7 && state.equipmentInventory.filter((item) => item.quality === entry.id).length >= 5);
    const chosen = available ? state.equipmentInventory.filter((item) => item.quality === available.id).slice(0, 5).map((item) => item.id) : [];
    showEquipmentSynthesis(onBack, chosen, available ? "" : "暂无 5 件同品质装备，可手动选择材料");
  }, "blue");
  quickAdd.disabled = !canManageHero();
  if (ids.length > 0 && ids.length < 5) {
    const complete = addBagAction("补齐材料", () => {
      const extra = state.equipmentInventory.filter((item) => item.quality === quality && !ids.includes(item.id)).slice(0, 5 - ids.length).map((item) => item.id);
      showEquipmentSynthesis(onBack, [...ids, ...extra], ids.length + extra.length < 5 ? "同品质装备不足 5 件" : "");
    }, "gold");
    complete.disabled = !canManageHero();
  }
  const start = addBagAction("开始合成", () => {
    start.disabled = true;
    const result = synthesizeEquipment(ids);
    if (!result.ok) { notice.textContent = result.message; return; }
    renderHud();
    showEquipmentSynthesisResult(result, () => showEquipmentSynthesis(onBack), onBack);
  });
  const quote = getSynthesisQuote(ids);
  start.disabled = !canManageHero() || !quote.ok || state.gold < quote.cost;
}

function showEquipmentSynthesisResult(result, onContinue, onBack) {
  const { content } = showBagShell(result.success ? "合成成功" : "合成失败", onBack, true);
  const item = result.equipment;
  content.classList.add("bag-result");
  content.innerHTML = item
    ? `<div class="synthesis-reward"><div class="bag-item-display">${bagItemArtwork(item)}</div></div><h3>${equipmentName(item)}</h3><span>${qualityInfo(item.quality).name}品质 · ${slotInfo(item.slot).label} +${equipmentValueText(item)}</span><p>装备已放入包裹</p>`
    : `<div class="synthesis-reward failed"><img src="${ASSET}ui/bag/slot-result.png" alt="" /></div><h3>未获得新装备</h3><p>5 件材料与 ${result.cost} 金币已消耗</p>`;
  if (result.bonusGold > 0) content.insertAdjacentHTML("beforeend", `<div class="synthesis-bonus"><img src="${ASSET}ui/bag/bonus-title.png" alt="意外获得" /><span><img src="${ASSET}icon-coin.png" alt="" />额外获得 ${result.bonusGold} 金币</span></div>`);
  addBagAction("继续合成", onContinue);
  addBagAction("返回包裹", onBack, "blue");
}

/* ==================== 装备打造：强化 / 升星 ==================== */
const forgeUi = { tab: "enhance", slot: "weapon", autoTarget: 0, busy: false, notice: "" };
let forgeTimer = null;

function forgeBag() {
  if (!state.forge || typeof state.forge !== "object") state.forge = { sword: {}, fan: {}, rock: {} };
  ["sword", "fan", "rock"].forEach((type) => {
    if (!state.forge[type] || typeof state.forge[type] !== "object") state.forge[type] = {};
  });
  return state.forge;
}

function forgeRoleLevel() {
  return Math.max(1, state.heroLevel || 1, state.highestUnlockedLevel || 1);
}
function heroNeedExp(level) {
  const idx = Math.min(Math.max(1, level | 0), HERO_EXP_TABLE.length) - 1;
  return HERO_EXP_TABLE[idx] || 0;
}
function heroExpPerStage() {
  return STAMINA_COST_PER_LEVEL * HERO_EXP_PER_STAMINA * state.heroLevel;
}
function awardHeroExp(amount) {
  if (!amount || amount <= 0 || state.heroLevel >= HERO_MAX_LEVEL) return 0;
  state.heroExp = (state.heroExp || 0) + amount;
  let leveled = 0;
  const levelCap = Math.min(HERO_MAX_LEVEL, (state.heroBreakthrough + 1) * 10);
  while (state.heroLevel < levelCap && state.heroExp >= heroNeedExp(state.heroLevel)) {
    state.heroExp -= heroNeedExp(state.heroLevel);
    state.heroLevel += 1;
    state.maxHp = 4 + state.heroLevel - 1;
    leveled += 1;
  }
  if (state.heroLevel >= HERO_MAX_LEVEL) state.heroExp = 0;
  return leveled;
}
function heroExpProgress() {
  if (state.heroLevel >= HERO_MAX_LEVEL) return { cur: 0, need: 0, pct: 100, max: true };
  const need = heroNeedExp(state.heroLevel);
  const cur = state.heroExp || 0;
  return { cur, need, pct: need ? Math.min(100, Math.round(cur / need * 100)) : 0, max: false };
}
function updateHomeExp() {
  const fill = document.getElementById("homeExpFill");
  const text = document.getElementById("homeExpText");
  const p = heroExpProgress();
  if (fill) fill.style.width = p.pct + "%";
  if (text) {
    text.textContent = p.max ? "已满级" : `${p.pct}%`;
    text.title = p.max ? "已满级" : `${formatPower(p.cur)}/${formatPower(p.need)}`;
    text.setAttribute("aria-label", `经验 ${text.title}`);
  }
}

function forgeEnhanceCap() {
  return forgeRoleLevel() * FORGE_CONFIG.enhanceCapFactor;
}

function forgeSlotState(type, slotId) {
  const bag = forgeBag()[type];
  if (!bag[slotId] || typeof bag[slotId] !== "object") bag[slotId] = { enh: 0, star: 0 };
  const row = bag[slotId];
  row.enh = Math.max(0, Math.min(forgeEnhanceCap(), Math.floor(Number(row.enh) || 0)));
  row.star = Math.max(0, Math.min(FORGE_CONFIG.starMax, Math.floor(Number(row.star) || 0)));
  return row;
}

function forgeWornItem(type, slotId) {
  return warriorEquipmentFor(type)[slotId] || null;
}

function forgeQualityCoefficient(type, slotId) {
  const item = forgeWornItem(type, slotId);
  const entry = EQUIPMENT_QUALITY.find((row) => row.id === (item ? item.quality : 1));
  return entry ? entry.coefficient : 1;
}

function forgeEnhanceValue(type, slotId, level) {
  const base = EQUIPMENT_BASE_VALUES[slotId] || 10;
  return Math.round(base * forgeQualityCoefficient(type, slotId) * level * FORGE_CONFIG.enhanceValueRate);
}

function forgeStarValue(type, slotId, star) {
  const base = EQUIPMENT_BASE_VALUES[slotId] || 10;
  return Math.round(base * forgeQualityCoefficient(type, slotId) * star * FORGE_CONFIG.starValueRate);
}

function forgeEnhanceCost(level) {
  const targetLevel = Math.max(1, Math.floor(Number(level) || 0) + 1);
  const tier = FORGE_ECONOMY.enhanceCostTiers.find((entry) => targetLevel <= entry.maxLevel)
    || FORGE_ECONOMY.enhanceCostTiers[FORGE_ECONOMY.enhanceCostTiers.length - 1];
  return {
    gold: Math.ceil((FORGE_CONFIG.enhanceGoldBase + level * FORGE_CONFIG.enhanceGoldStep) * tier.goldMultiplier),
    stone: tier.stone,
  };
}

function forgeStarCost(star) {
  const targetStar = Math.max(1, Math.floor(Number(star) || 0) + 1);
  const tier = FORGE_ECONOMY.starCostTiers.find((entry) => targetStar <= entry.maxLevel)
    || FORGE_ECONOMY.starCostTiers[FORGE_ECONOMY.starCostTiers.length - 1];
  return {
    gold: Math.ceil((FORGE_CONFIG.starGoldBase + star * FORGE_CONFIG.starGoldStep) * tier.goldMultiplier),
    stone: tier.stone,
  };
}

function forgeStarRate(star) {
  const table = FORGE_STAR_RATES;
  const index = Math.min(Math.max(0, Math.floor(star)), table.length - 1);
  return table[index];
}

function forgeStoneCount(kind) {
  return kind === "star" ? state.forgeStarStone : state.forgeEnhanceStone;
}

function forgeStoneName(kind) {
  return kind === "star" ? "升星石" : "强化石";
}

function forgeMasterRows(kind, type = state.selectedWarriorType) {
  const key = kind === "star" ? "star" : "enh";
  // 达标线只统计「已穿戴装备」的槽位：空槽位既不出数值，也不参与大师判定，
  // 不会因为空槽等级低而拖低已装备槽位的大师加成（超哥 2026-09-17 定案 1B）。
  const wornSlots = EQUIPMENT_SLOTS.filter(({ id }) => !!forgeWornItem(type, id));
  const lowest = wornSlots.reduce((low, { id }) => Math.min(low, forgeSlotState(type, id)[key]), Infinity);
  const floor = Number.isFinite(lowest) ? lowest : 0;
  const tiers = kind === "star" ? FORGE_STAR_MASTER : FORGE_ENHANCE_MASTER;
  return {
    floor,
    worn: wornSlots.length,
    total: EQUIPMENT_SLOTS.length,
    rows: tiers.map((tier) => ({ ...tier, active: floor >= tier.level })),
  };
}

/* ===== 战斗力计算 =====
   战力与战斗同源：都用 getWarriorBonuses() 的最终属性，不再另算一套。
   战力 = 主角等级 × levelWeight + Σ( 属性终值 × 属性权重 )，最后四舍五入取整；
   总战力 = 各武将战力之和（主页与打造面板展示的就是这个汇总值）。 */

/* 大师加成按其档位标注的属性生效：攻击 / 攻速 / 暴击 / 命中 */
function forgeMasterStatPercent(type, kind) {
  const percent = { attack: 0, crit: 0, hit: 0, speed: 0 };
  forgeMasterRows(kind, type).rows.forEach((row) => {
    if (!row.active) return;
    const key = { "攻击": "attack", "攻速": "speed", "暴击": "crit", "命中": "hit" }[row.stat];
    if (!key) return;
    const value = parseFloat(String(row.value).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(value)) percent[key] += value;
  });
  return percent;
}

function warriorMasterPercent(type) {
  const enhancePercent = forgeMasterStatPercent(type, "enhance");
  const starPercent = forgeMasterStatPercent(type, "star");
  const total = {};
  Object.keys(enhancePercent).forEach((key) => { total[key] = enhancePercent[key] + starPercent[key]; });
  return total;
}

/* 单个槽位给武将的属性数值 = 装备基础值 + 强化加成 + 升星加成
   （依据规格「强化 / 升星数值需该槽位穿戴装备后才生效」，空槽位无装备时不计入） */
function forgeSlotStatValue(type, slotId) {
  const item = forgeWornItem(type, slotId);
  if (!item && !COMBAT_POWER_CONFIG.countForgeWithoutEquipment) return 0;
  const row = forgeSlotState(type, slotId);
  return (item ? item.value || 0 : 0)
    + forgeEnhanceValue(type, slotId, row.enh)
    + forgeStarValue(type, slotId, row.star);
}

function warriorPower(type = state.selectedWarriorType) {
  const levelPower = forgeRoleLevel() * COMBAT_POWER_CONFIG.levelWeight;
  const breakthroughPower = Math.max(0, Math.min(MAX_WARRIOR_QUALITY, state.warriorQuality[type] || 1) - 1)
    * COMBAT_POWER_CONFIG.breakthroughSkillWeight;
  const stats = getWarriorBonuses(type);
  const statPower = Object.keys(COMBAT_POWER_CONFIG.statWeight).reduce(
    (sum, key) => sum + (stats[key] || 0) * (COMBAT_POWER_CONFIG.statWeight[key] || 1),
    0,
  );
  return Math.max(0, Math.round(levelPower + breakthroughPower + statPower));
}

function totalCombatPower() {
  return WARRIORS.reduce((sum, warrior) => sum + warriorPower(warrior.type), 0);
}

function formatPower(value) {
  return String(Math.max(0, Math.round(Number(value) || 0)));
}

let hudPowerShown = null;

// 战力增加时，在主页头像下方飘出 +N
function homePowerFloat(delta) {
  if (!homePowerText || !(delta > 0)) return;
  const host = homePowerText.closest(".profile-power") || homePowerText.parentElement;
  if (!host) return;
  host.querySelectorAll(".profile-power-float").forEach((node) => node.remove());
  const tip = document.createElement("b");
  tip.className = "profile-power-float";
  tip.textContent = "+" + formatPower(delta);
  host.appendChild(tip);
  window.setTimeout(() => tip.remove(), 1000);
}

function forgeEnhanceOnce(type, slotId) {
  const row = forgeSlotState(type, slotId);
  const cap = forgeEnhanceCap();
  if (row.enh >= cap) return { ok: false, reason: "max" };
  const cost = forgeEnhanceCost(row.enh);
  if (state.gold < cost.gold) return { ok: false, reason: "gold", cost };
  if (state.forgeEnhanceStone < cost.stone) return { ok: false, reason: "stone", cost };
  state.gold -= cost.gold;
  state.forgeEnhanceStone -= cost.stone;
  row.enh += 1;
  updateMainQuestStat("enhance");
  renderHud();
  saveProgress();
  updateDailyProgress("enhance");
  return { ok: true, cost };
}

function forgeStarOnce(type, slotId) {
  const row = forgeSlotState(type, slotId);
  if (row.star >= FORGE_CONFIG.starMax) return { ok: false, reason: "max" };
  const cost = forgeStarCost(row.star);
  if (state.gold < cost.gold) return { ok: false, reason: "gold", cost };
  if (state.forgeStarStone < cost.stone) return { ok: false, reason: "stone", cost };
  state.gold -= cost.gold;
  state.forgeStarStone -= cost.stone;
  const rate = forgeStarRate(row.star);
  const success = rate >= 1 || Math.random() < rate;
  if (success) row.star += 1;
  updateMainQuestStat("star");
  renderHud();
  saveProgress();
  updateDailyProgress("star");
  return { ok: true, success, cost, rate };
}

function forgeStopTimer() {
  if (forgeTimer) clearTimeout(forgeTimer);
  forgeTimer = null;
}

function forgeQualityFrame(item, slotId) {
  const q = item ? (EQUIPMENT_QUALITY.find((e) => e.id === item.quality) || EQUIPMENT_QUALITY[0]) : null;
  const base = q ? q.asset : "ui/character/equipment-slot.png";
  return `<span class="forge-quality-frame${q ? "" : " empty"}">
    <img class="forge-quality-base" src="${ASSET}${base}" alt="" />
    ${item ? `<img class="forge-equip-icon" src="${ASSET}${EQUIPMENT_ICONS[slotId] || "equipment/weapon.png"}" alt="" />` : ""}
    ${item ? "" : '<span class="forge-empty-mark">无</span>'}
  </span>`;
}

function showForge(back = showHome) {
  forgeUi.busy = false;
  forgeStopTimer();
  const type = state.selectedWarriorType;
  if (!EQUIPMENT_SLOTS.some(({ id }) => id === forgeUi.slot)) forgeUi.slot = EQUIPMENT_SLOTS[0].id;
  renderForge(back, type);
}

function renderForge(back, type = state.selectedWarriorType) {
  const tab = FORGE_TABS.find((entry) => entry.id === forgeUi.tab) || FORGE_TABS[0];
  const slotId = forgeUi.slot;
  const slot = slotInfo(slotId);
  const row = forgeSlotState(type, slotId);
  const item = forgeWornItem(type, slotId);
  const warrior = getWarriorAppearance(type);
  const unlocked = FORGE_UNLOCKED_TABS.includes(tab.id);

  const closeForge = () => {
    forgeUi.busy = false;
    forgeStopTimer();
    forgeUi.notice = "";
    back();
  };

  showModal("装备打造", `${warrior.name} · ${tab.name}`, [], { backAction: closeForge });
  modalCard.classList.add("forge-modal");

  const tabs = `<div class="forge-tabs" role="tablist">${FORGE_TABS
    .map((entry) => `<button type="button" role="tab" class="forge-tab${entry.id === tab.id ? " active" : ""}${FORGE_UNLOCKED_TABS.includes(entry.id) ? "" : " locked"}" data-forge-tab="${entry.id}" aria-selected="${entry.id === tab.id}">${entry.name}</button>`)
    .join("")}</div>`;

  /* 武将切换页签：装备养成（强化/升星）永久记在具体武将身上，
     必须先能选武将，否则面板只能养成 state.selectedWarriorType 那一个。 */
  const warriorTabs = `<div class="forge-warriors" role="tablist" aria-label="选择武将">${WARRIORS
    .map((entry) => {
      const entryQuality = qualityInfo(state.warriorQuality[entry.type] || 1);
      const wornCount = getEquipmentSetStatus(entry.type).count;
      return `<button type="button" role="tab" class="forge-warrior${entry.type === type ? " active" : ""}" data-forge-warrior="${entry.type}" aria-selected="${entry.type === type}" title="切换到${entry.name}">
        <strong>${entry.name}</strong><small>${entryQuality.name} · ${wornCount}/6</small>
      </button>`;
    })
    .join("")}</div>`;

  const wallet = `<div class="forge-wallet">
    <span class="forge-money"><img src="${ASSET}icon-coin.png" alt="金币" /><b>${formatCurrency(state.gold)}</b></span>
    <span class="forge-money"><img src="${ASSET}ui/forge/stone-enhance.png" alt="强化石" /><b>${state.forgeEnhanceStone}</b><button type="button" class="forge-plus" data-forge-buy="enhance" aria-label="获取强化石"><img src="${ASSET}ui/stamina-plus.png" alt="" /></button></span>
    <span class="forge-money"><img src="${ASSET}ui/forge/stone-star.png" alt="升星石" /><b>${state.forgeStarStone}</b><button type="button" class="forge-plus" data-forge-buy="star" aria-label="获取升星石"><img src="${ASSET}ui/stamina-plus.png" alt="" /></button></span>
  </div>`;

  const slots = `<div class="forge-slots" role="list">${EQUIPMENT_SLOTS
    .map((entry) => {
      const cell = forgeSlotState(type, entry.id);
      const worn = forgeWornItem(type, entry.id);
      const quality = worn ? (EQUIPMENT_QUALITY.find((q) => q.id === worn.quality) || EQUIPMENT_QUALITY[0]) : null;
      const color = quality ? quality.color : "#c9d8d2";
      return `<button type="button" role="listitem" class="forge-slot${entry.id === slotId ? " active" : ""}" data-forge-slot="${entry.id}" style="--quality-color:${color}" title="${entry.name}">
        <img class="forge-slot-base" src="${ASSET}ui/forge/slot-round.png" alt="" />
        <img class="forge-slot-glow" src="${ASSET}ui/forge/slot-glow.png" alt="" />
        ${forgeQualityFrame(worn, entry.id)}
        ${cell.enh > 0 ? `<span class="forge-slot-enh">+${cell.enh}</span>` : ""}
        ${cell.star > 0 ? `<span class="forge-slot-star">${cell.star}★</span>` : ""}
        <span class="forge-slot-label">${entry.label}</span>
      </button>`;
    })
    .join("")}</div>`;

  let body = "";
  if (!unlocked) {
    body = `<div class="forge-locked">
      <img src="${ASSET}ui/forge/gem.png" alt="" />
      <strong>${tab.name}模块筹备中</strong>
      <span>本轮先开放「强化」与「升星」，洗炼与魂石将在下一轮补齐。</span>
    </div>`;
  } else if (tab.id === "enhance") {
    body = forgeEnhanceBody(type, slotId, row, item, slot);
  } else {
    body = forgeStarBody(type, slotId, row, item, slot);
  }

  const powerBar = `<div class="forge-power" role="status" aria-live="polite" data-forge-power>
    <img class="forge-power-banner" src="${ASSET}ui/power/power-banner.png" alt="" />
    <img class="forge-power-title" src="${ASSET}ui/power/power-title.png" alt="总战力" />
    <span class="forge-power-body"><img class="forge-power-icon" src="${ASSET}ui/power/power-icon.png" alt="战力" /><b class="forge-power-value" data-forge-power-value>${formatPower(totalCombatPower())}</b></span>
    <img class="forge-power-rank" src="${ASSET}ui/power/power-rank.png" alt="" />
  </div>`;

  modalDetail.innerHTML = `<div class="forge-panel">
    <div class="forge-top">${wallet}<button type="button" class="forge-help" data-forge-help aria-label="规则说明">?</button></div>
    ${tabs}
    ${warriorTabs}
    ${powerBar}
    ${slots}
    <div class="forge-stage">${body}</div>
  </div>`;

  modalDetail.querySelectorAll("[data-forge-warrior]").forEach((button) => button.addEventListener("click", () => {
    const nextWarrior = button.dataset.forgeWarrior;
    if (forgeUi.busy || nextWarrior === state.selectedWarriorType) return;
    forgeStopTimer();
    state.selectedWarriorType = nextWarrior;
    forgeUi.notice = "";
    forgeUi.autoTarget = 0;
    saveProgress();
    renderForge(back);
  }));
  modalDetail.querySelectorAll("[data-forge-tab]").forEach((button) => button.addEventListener("click", () => {
    if (forgeUi.busy || button.dataset.forgeTab === forgeUi.tab) return;
    forgeUi.tab = button.dataset.forgeTab;
    forgeUi.notice = "";
    forgeUi.autoTarget = 0;
    renderForge(back);
  }));
  modalDetail.querySelectorAll("[data-forge-slot]").forEach((button) => button.addEventListener("click", () => {
    if (forgeUi.busy || button.dataset.forgeSlot === forgeUi.slot) return;
    forgeUi.slot = button.dataset.forgeSlot;
    forgeUi.notice = "";
    forgeUi.autoTarget = 0;
    renderForge(back);
  }));
  modalDetail.querySelectorAll("[data-forge-buy]").forEach((button) => button.addEventListener("click", () => {
    if (forgeUi.busy) return;
    showForgeSource(button.dataset.forgeBuy, () => renderForge(back));
  }));
  modalDetail.querySelectorAll("[data-forge-master]").forEach((button) => button.addEventListener("click", () => {
    if (forgeUi.busy) return;
    showForgeMaster(button.dataset.forgeMaster, () => renderForge(back));
  }));
  const help = modalDetail.querySelector("[data-forge-help]");
  if (help) help.addEventListener("click", () => showForgeRules(() => renderForge(back)));
  bindForgeActions(modalDetail, back);
}

/* ===== 打造面板：就地刷新 + 特效（避免每次操作重建整块 DOM 造成闪屏）=====
   文档要求：强化 / 升星操作时只在「当前操作的装备图标」上叠加一次性特效，
   而不是整屏刷新。故 renderForge 只负责搭骨架，操作后仅就地更新数值 + 播放火花。 */
function bindForgeActions(root, back) {
  root.querySelectorAll("[data-forge-act]").forEach((button) => button.addEventListener("click", () => {
    const act = button.dataset.forgeAct;
    if (act === "stop") {
      forgeUi.busy = false;
      forgeStopTimer();
      forgeUi.notice = "已停止自动升星";
      refreshForge(back);
      return;
    }
    if (forgeUi.busy) return;
    if (act === "enhance-one") runForgeEnhanceOne(back);
    if (act === "enhance-max") runForgeEnhanceToCap(back);
    if (act === "star-one") runForgeStarOne(back);
    if (act === "star-auto") runForgeStarAuto(back);
  }));
  const targetSelect = root.querySelector("[data-forge-target-select]");
  if (targetSelect) targetSelect.addEventListener("change", () => {
    forgeUi.autoTarget = Number(targetSelect.value) || 0;
  });
}

/* 在装备图标上叠加一次性「打铁冒火星」特效；kind = "ok" | "fail" */
function spawnForgeSpark(frame, kind = "ok") {
  if (!frame) return;
  const fx = document.createElement("span");
  fx.className = `forge-spark-fx ${kind}`;
  const count = kind === "fail" ? 6 : 11;
  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement("i");
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 20 + Math.random() * 18;
    spark.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * dist - 6}px`);
    spark.style.setProperty("--delay", `${(Math.random() * 0.08).toFixed(3)}s`);
    spark.style.setProperty("--dur", `${(0.42 + Math.random() * 0.22).toFixed(3)}s`);
    fx.appendChild(spark);
  }
  frame.appendChild(fx);
  window.setTimeout(() => fx.remove(), 720);
}

/* 战力增加时在最上层飘出「+N」 */
function floatPowerGain(root, delta) {
  if (!delta || delta <= 0 || !root) return;
  const host = root.querySelector("[data-forge-power]");
  if (!host) return;
  const tip = document.createElement("span");
  tip.className = "forge-power-float";
  tip.textContent = `+${formatPower(delta)}`;
  host.appendChild(tip);
  window.setTimeout(() => tip.remove(), 900);
}

function updateForgePower(root, delta = 0) {
  const valueEl = root.querySelector("[data-forge-power-value]");
  if (valueEl) valueEl.textContent = formatPower(totalCombatPower());
  if (delta > 0) floatPowerGain(root, delta);
}

function forgeCompareInner(isEnhance, type, slotId, row, slot) {
  if (isEnhance) {
    const cap = forgeEnhanceCap();
    const atCap = row.enh >= cap;
    return `<div class="forge-metric"><span>当前强化等级</span><strong>+${row.enh}</strong><em>${slot.label} +${forgeEnhanceValue(type, slotId, row.enh)}</em></div>
      <div class="forge-arrow" aria-hidden="true"><img src="${ASSET}ui/forge/upgrade-arrow.png" alt="" /></div>
      <div class="forge-metric next"><span>下一强化等级</span><strong>${atCap ? "—" : `+${row.enh + 1}`}</strong><em>${slot.label} +${forgeEnhanceValue(type, slotId, Math.min(row.enh + 1, cap))}</em></div>`;
  }
  const maxed = row.star >= FORGE_CONFIG.starMax;
  return `<div class="forge-metric"><span>当前星级</span><strong>${row.star}★</strong><em>${slot.label} +${forgeStarValue(type, slotId, row.star)}</em></div>
    <div class="forge-arrow" aria-hidden="true"><img src="${ASSET}ui/forge/upgrade-arrow.png" alt="" /></div>
    <div class="forge-metric next"><span>下一星级</span><strong>${maxed ? "—" : `${row.star + 1}★`}</strong><em>${slot.label} +${forgeStarValue(type, slotId, Math.min(row.star + 1, FORGE_CONFIG.starMax))}</em></div>`;
}

function forgeCostInner(isEnhance, row) {
  const cost = isEnhance ? forgeEnhanceCost(row.enh) : forgeStarCost(row.star);
  const goldLack = state.gold < cost.gold;
  const stoneLack = isEnhance ? state.forgeEnhanceStone < cost.stone : state.forgeStarStone < cost.stone;
  const label = isEnhance ? "强化消耗：" : "升星消耗：";
  const stoneAlt = isEnhance ? "强化石" : "升星石";
  const stoneImg = isEnhance ? "stone-enhance.png" : "stone-star.png";
  return `<span class="forge-cost-label">${label}</span>
    <span class="forge-cost-gold${goldLack ? " lack" : ""}"><img src="${ASSET}icon-coin.png" alt="金币" /><b>${formatCurrency(cost.gold)}</b></span>
    <span class="forge-cost-stone${stoneLack ? " lack" : ""}"><img src="${ASSET}ui/forge/${stoneImg}" alt="${stoneAlt}" /><b>${cost.stone}</b></span>`;
}

function forgeRateInner(row) {
  const maxed = row.star >= FORGE_CONFIG.starMax;
  return `成功率 <b>${maxed ? "—" : `${Math.round(forgeStarRate(row.star) * 100)}%`}</b> · 最高 ${FORGE_CONFIG.starMax} 星`;
}

function forgeActionsInner(isEnhance, row) {
  const blocked = forgeUi.busy;
  if (isEnhance) {
    if (row.enh >= forgeEnhanceCap()) return `<div class="forge-maxed">已达到当前最高等级</div>`;
    return `<button type="button" class="forge-primary" data-forge-act="enhance-one"${blocked ? " disabled" : ""}>强化一次</button>
      <button type="button" class="forge-primary alt" data-forge-act="enhance-max"${blocked ? " disabled" : ""}>一键至顶</button>`;
  }
  if (row.star >= FORGE_CONFIG.starMax) return `<div class="forge-maxed">已达到当前最高星级</div>`;
  if (blocked) return `<button type="button" class="forge-danger" data-forge-act="stop">停止升星</button>`;
  const target = Math.max(row.star + 1, Math.min(forgeUi.autoTarget || row.star + 1, FORGE_CONFIG.starMax));
  const options = [];
  for (let star = row.star + 1; star <= FORGE_CONFIG.starMax; star += 1) {
    options.push(`<option value="${star}"${star === target ? " selected" : ""}>${star} 星</option>`);
  }
  return `<button type="button" class="forge-primary" data-forge-act="star-one"${blocked ? " disabled" : ""}>升星一次</button>
    <div class="forge-auto">
      <button type="button" class="forge-primary alt" data-forge-act="star-auto"${blocked ? " disabled" : ""}>自动升星</button>
      <select class="forge-target-select" data-forge-target-select aria-label="自动升星目标">${options.join("")}</select>
    </div>`;
}

function forgeActionSig(tab, row) {
  const maxed = tab.id === "enhance" ? row.enh >= forgeEnhanceCap() : row.star >= FORGE_CONFIG.starMax;
  if (maxed) return "maxed";
  return forgeUi.busy ? "busy" : "idle";
}

function forgeDynamicMarkup(tab, type, slotId, row, item, slot) {
  const isEnhance = tab.id === "enhance";
  const tip = isEnhance
    ? `提示：每一个装备槽位可以强化的最高等级不能超过角色等级的 2 倍（当前上限 +${forgeEnhanceCap()}）。`
    : "提示：每一个槽位的星级加成仅对当前槽位上的装备有效！";
  return `<div class="forge-dynamic">
    ${isEnhance ? "" : `<div class="forge-rate">${forgeRateInner(row)}</div>`}
    <div class="forge-compare">${forgeCompareInner(isEnhance, type, slotId, row, slot)}</div>
    ${item ? "" : '<p class="forge-empty-hint">该槽位未穿戴装备，强化 / 升星加成暂不生效。</p>'}
    <div class="forge-cost">${forgeCostInner(isEnhance, row)}</div>
    <p class="forge-notice" role="status" aria-live="polite"${forgeUi.notice ? "" : ' style="display:none"'}>${forgeUi.notice || ""}</p>
    <div class="forge-actions" data-sig="${forgeActionSig(tab, row)}">${forgeActionsInner(isEnhance, row)}</div>
    <p class="forge-tip">${tip}</p>
  </div>`;
}

/* 就地刷新动态区：只改文本 / 数值节点，绝不重建整块 DOM */
function forgeDynamicRefresh(host, tab, type, slotId, row, item, slot, back) {
  const isEnhance = tab.id === "enhance";
  const metrics = host.querySelectorAll(".forge-compare .forge-metric");
  if (metrics.length === 2) {
    const cap = forgeEnhanceCap();
    const atCap = row.enh >= cap;
    const maxed = row.star >= FORGE_CONFIG.starMax;
    const [cur, nxt] = metrics;
    if (isEnhance) {
      cur.querySelector("strong").textContent = `+${row.enh}`;
      cur.querySelector("em").textContent = `${slot.label} +${forgeEnhanceValue(type, slotId, row.enh)}`;
      nxt.querySelector("strong").textContent = atCap ? "—" : `+${row.enh + 1}`;
      nxt.querySelector("em").textContent = `${slot.label} +${forgeEnhanceValue(type, slotId, Math.min(row.enh + 1, cap))}`;
    } else {
      cur.querySelector("strong").textContent = `${row.star}★`;
      cur.querySelector("em").textContent = `${slot.label} +${forgeStarValue(type, slotId, row.star)}`;
      nxt.querySelector("strong").textContent = maxed ? "—" : `${row.star + 1}★`;
      nxt.querySelector("em").textContent = `${slot.label} +${forgeStarValue(type, slotId, Math.min(row.star + 1, FORGE_CONFIG.starMax))}`;
    }
  }
  const rateEl = host.querySelector(".forge-rate");
  if (rateEl && !isEnhance) rateEl.innerHTML = forgeRateInner(row);
  const costEl = host.querySelector(".forge-cost");
  if (costEl) {
    const cost = isEnhance ? forgeEnhanceCost(row.enh) : forgeStarCost(row.star);
    const gold = costEl.querySelector(".forge-cost-gold");
    const stone = costEl.querySelector(".forge-cost-stone");
    const label = costEl.querySelector(".forge-cost-label");
    if (label) label.textContent = isEnhance ? "强化消耗：" : "升星消耗：";
    if (gold) {
      gold.querySelector("b").textContent = formatCurrency(cost.gold);
      gold.classList.toggle("lack", state.gold < cost.gold);
    }
    if (stone) {
      stone.querySelector("b").textContent = cost.stone;
      stone.classList.toggle("lack", isEnhance ? state.forgeEnhanceStone < cost.stone : state.forgeStarStone < cost.stone);
    }
  }
  const noticeEl = host.querySelector(".forge-notice");
  if (noticeEl) {
    noticeEl.textContent = forgeUi.notice || "";
    noticeEl.style.display = forgeUi.notice ? "" : "none";
  }
  const actionsEl = host.querySelector(".forge-actions");
  const sig = forgeActionSig(tab, row);
  if (actionsEl && actionsEl.dataset.sig !== sig) {
    actionsEl.dataset.sig = sig;
    actionsEl.innerHTML = forgeActionsInner(isEnhance, row);
    bindForgeActions(actionsEl, back);
  }
}

/* 操作后调用：就地更新数值 + 播特效（不再重建整屏） */
function refreshForge(back, options = {}) {
  const tab = FORGE_TABS.find((entry) => entry.id === forgeUi.tab) || FORGE_TABS[0];
  const type = state.selectedWarriorType;
  const slotId = forgeUi.slot;
  const slot = slotInfo(slotId);
  const row = forgeSlotState(type, slotId);
  const item = forgeWornItem(type, slotId);
  const root = modalDetail.querySelector(".forge-panel");
  if (!root) { renderForge(back); return; }

  const money = root.querySelectorAll(".forge-money b");
  if (money[0]) money[0].textContent = formatCurrency(state.gold);
  if (money[1]) money[1].textContent = state.forgeEnhanceStone;
  if (money[2]) money[2].textContent = state.forgeStarStone;

  root.querySelectorAll(".forge-slot").forEach((button) => {
    const cell = forgeSlotState(type, button.dataset.forgeSlot);
    let enh = button.querySelector(".forge-slot-enh");
    if (cell.enh > 0) {
      if (!enh) { enh = document.createElement("span"); enh.className = "forge-slot-enh"; button.appendChild(enh); }
      enh.textContent = `+${cell.enh}`;
    } else if (enh) enh.remove();
    let star = button.querySelector(".forge-slot-star");
    if (cell.star > 0) {
      if (!star) { star = document.createElement("span"); star.className = "forge-slot-star"; button.appendChild(star); }
      star.textContent = `${cell.star}★`;
    } else if (star) star.remove();
  });

  const dynamic = root.querySelector(".forge-dynamic");
  if (dynamic) forgeDynamicRefresh(dynamic, tab, type, slotId, row, item, slot, back);

  updateForgePower(root, options.powerDelta || 0);

  if (options.spark) {
    [root.querySelector(".forge-hero-frame"), root.querySelector(".forge-slot.active")]
      .filter(Boolean)
      .forEach((frame) => spawnForgeSpark(frame, options.spark));
  }
}

function forgeEnhanceBody(type, slotId, row, item, slot) {
  const shownName = item ? equipmentName(item) : slot.name;
  return `<div class="forge-item-name"><span>${shownName}</span></div>
    <div class="forge-craft">
      <img class="forge-hearth" src="${ASSET}ui/forge/forge-hearth.png" alt="" />
      <span class="forge-hearth-glow" aria-hidden="true"></span>
      <button type="button" class="forge-master" data-forge-master="enhance"><span>强化大师</span></button>
      <div class="forge-hero">
        <div class="forge-hero-frame">${forgeQualityFrame(item, slotId)}</div>
        <span class="forge-hero-name">${slot.name}</span>
      </div>
    </div>
    ${forgeDynamicMarkup(FORGE_TABS.find((entry) => entry.id === "enhance"), type, slotId, row, item, slot)}`;
}

function forgeStarBody(type, slotId, row, item, slot) {
  const shownName = item ? equipmentName(item) : slot.name;
  return `<div class="forge-item-name"><span>${shownName}</span></div>
    <div class="forge-craft">
      <img class="forge-hearth" src="${ASSET}ui/forge/forge-hearth.png" alt="" />
      <span class="forge-hearth-glow" aria-hidden="true"></span>
      <button type="button" class="forge-master" data-forge-master="star"><span>升星大师</span></button>
      <div class="forge-hero">
        <div class="forge-hero-frame">${forgeQualityFrame(item, slotId)}</div>
        <span class="forge-hero-name">${slot.name}</span>
      </div>
    </div>
    ${forgeDynamicMarkup(FORGE_TABS.find((entry) => entry.id === "star"), type, slotId, row, item, slot)}`;
}

function runForgeEnhanceOne(back) {
  const type = state.selectedWarriorType;
  const slotId = forgeUi.slot;
  const row = forgeSlotState(type, slotId);
  const cost = forgeEnhanceCost(row.enh);
  if (state.gold < cost.gold) return showForgeLack("enhance", "gold", cost, () => renderForge(back));
  if (state.forgeEnhanceStone < cost.stone) return showForgeLack("enhance", "stone", cost, () => renderForge(back));
  const before = warriorPower(type);
  const result = forgeEnhanceOnce(type, slotId);
  const delta = Math.max(0, warriorPower(type) - before);
  forgeUi.notice = result.ok ? `强化成功 → +${forgeSlotState(type, slotId).enh}` : "强化未完成";
  refreshForge(back, { spark: "ok", powerDelta: delta });
}

function runForgeEnhanceToCap(back) {
  const type = state.selectedWarriorType;
  const slotId = forgeUi.slot;
  const step = () => {
    if (!forgeUi.busy) return;
    const before = warriorPower(type);
    const result = forgeEnhanceOnce(type, slotId);
    const delta = Math.max(0, warriorPower(type) - before);
    if (!result.ok) {
      forgeUi.busy = false;
      forgeUi.notice = result.reason === "max"
        ? `已强化至当前上限 +${forgeEnhanceCap()}`
        : `已强化至 +${forgeSlotState(type, slotId).enh}，${forgeStoneName("enhance")}不足`;
      refreshForge(back);
      return;
    }
    forgeUi.notice = `强化中… +${forgeSlotState(type, slotId).enh}`;
    refreshForge(back, { spark: "ok", powerDelta: delta });
    forgeTimer = setTimeout(step, 170);
  };
  forgeUi.busy = true;
  forgeUi.notice = "一键至顶进行中…";
  refreshForge(back);
  forgeTimer = setTimeout(step, 170);
}

function runForgeStarOne(back) {
  const type = state.selectedWarriorType;
  const slotId = forgeUi.slot;
  const row = forgeSlotState(type, slotId);
  const cost = forgeStarCost(row.star);
  if (state.gold < cost.gold) return showForgeLack("star", "gold", cost, () => renderForge(back));
  if (state.forgeStarStone < cost.stone) return showForgeLack("star", "stone", cost, () => renderForge(back));
  const beforeStar = row.star;
  const beforePower = warriorPower(type);
  const result = forgeStarOnce(type, slotId);
  const afterStar = forgeSlotState(type, slotId).star;
  const success = afterStar > beforeStar;
  const delta = Math.max(0, warriorPower(type) - beforePower);
  forgeUi.notice = success ? `升星成功 → ${afterStar} 星` : "升星失败，星级不变";
  refreshForge(back, { spark: success ? "ok" : "fail", powerDelta: delta });
}

function runForgeStarAuto(back) {
  const type = state.selectedWarriorType;
  const slotId = forgeUi.slot;
  const startRow = forgeSlotState(type, slotId);
  const target = Math.max(startRow.star + 1, Math.min(forgeUi.autoTarget || startRow.star + 1, FORGE_CONFIG.starMax));
  const step = () => {
    if (!forgeUi.busy) return;
    const row = forgeSlotState(type, slotId);
    if (row.star >= target) {
      forgeUi.busy = false;
      forgeUi.notice = `自动升星结束 → ${row.star} 星`;
      refreshForge(back);
      return;
    }
    const beforePower = warriorPower(type);
    const result = forgeStarOnce(type, slotId);
    const delta = Math.max(0, warriorPower(type) - beforePower);
    if (!result.ok) {
      forgeUi.busy = false;
      forgeUi.notice = result.reason === "max"
        ? "已达到当前最高星级"
        : `自动升星中断：${forgeStoneName("star")}或金币不足（当前 ${forgeSlotState(type, slotId).star} 星）`;
      refreshForge(back);
      return;
    }
    const now = forgeSlotState(type, slotId);
    forgeUi.notice = result.success ? `升星成功 → ${now.star} 星` : `${now.star} 星 · 本次升星失败，继续尝试…`;
    refreshForge(back, { spark: result.success ? "ok" : "fail", powerDelta: delta });
    forgeTimer = setTimeout(step, 230);
  };
  forgeUi.busy = true;
  forgeUi.notice = `自动升星中，目标 ${target} 星…`;
  refreshForge(back);
  forgeTimer = setTimeout(step, 230);
}

function showForgeLack(kind, lack, cost, back) {
  const label = kind === "star" ? "升星" : "强化";
  const detail = lack === "gold"
    ? `${label}需要 ${cost.gold} 金币，当前 ${formatCurrency(state.gold)}，不足。`
    : `${label}需要 ${forgeStoneName(kind)} ${cost.stone} 个，当前 ${forgeStoneCount(kind)} 个，不足。`;
  showModal("材料不足", detail, [
    { label: "获取材料", onClick: () => showForgeSource(lack === "gold" ? "star" : kind, back) },
    { label: "取消", secondary: true, onClick: back },
  ]);
}

function showForgeSource(kind, back) {
  const offer = FORGE_ECONOMY.exchangeOffers[kind] || FORGE_ECONOMY.exchangeOffers.enhance;
  const { price, amount } = offer;
  const name = forgeStoneName(kind);
  showModal(`${name}获取途径`, `通关结算和每日任务均可获得${name}；当前处于「${getForgeProgressionTier().name}」。也可用 ${price} 元宝兑换 ${amount} 个。当前元宝 ${state.yuanbao}，持有${name} ${forgeStoneCount(kind)} 个。`, [
    {
      label: `兑换 ${amount} 个（${price} 元宝）`,
      disabled: state.yuanbao < price,
      onClick: () => {
        if (state.yuanbao < price) return back();
        state.yuanbao -= price;
        if (kind === "star") state.forgeStarStone += amount;
        else state.forgeEnhanceStone += amount;
        renderHud();
        saveProgress();
        back();
      },
    },
  ], { backAction: back });
}

function showForgeMaster(kind, back) {
  const { floor, rows, worn, total } = forgeMasterRows(kind);
  const warrior = getWarriorAppearance(state.selectedWarriorType);
  const isStar = kind === "star";
  const floorText = isStar ? `${floor}★` : `+${floor}`;
  const masterSub = worn > 0
    ? `${warrior.name} · 已穿戴 ${worn}/${total} 槽 · 最低${isStar ? "星级" : "强化等级"} ${floorText}`
    : `${warrior.name} · 尚未穿戴装备`;
  showModal(isStar ? "升星大师" : "强化大师", masterSub, [], { backAction: back });
  modalCard.classList.add("forge-modal");
  modalDetail.innerHTML = `<div class="forge-master-panel">
    <p class="forge-master-hint">只统计已穿戴装备的槽位（当前 ${worn}/${total} 槽）：这些槽位的${isStar ? "星级" : "强化等级"}同时达到要求后，对应加成自动激活；未穿戴装备的槽位不参与判定。</p>
    <div class="forge-master-list" role="list">
      ${rows.map((tier) => `<div class="forge-master-row${tier.active ? " active" : ""}" role="listitem">
        <span class="forge-master-req">全身 ${isStar ? `${tier.level}★` : `+${tier.level}`}</span>
        <span class="forge-master-gain">${tier.stat} ${tier.value}</span>
        <span class="forge-master-state">${tier.active ? "已激活" : "未激活"}</span>
      </div>`).join("")}
    </div>
  </div>`;
}

function showForgeRules(back) {
  showModal("打造规则", "装备打造针对装备槽位生效：即使槽位为空也可强化、升星，但数值需要穿上装备后才会作用于战斗。", [], { backAction: back });
  modalCard.classList.add("forge-modal");
  modalDetail.innerHTML = `<div class="forge-rules">
    <section><h4>强化</h4><p>消耗金币 + 强化石，无成功率设定，满足消耗必定成功。强化等级上限 = 角色等级 × 2，当前上限 +${forgeEnhanceCap()}。</p></section>
    <section><h4>升星</h4><p>消耗金币 + 升星石，有成功率设定，星级越高消耗越大、成功率越低。最高 ${FORGE_CONFIG.starMax} 星。星级加成只对当前槽位上的装备有效。</p></section>
    <section><h4>强化大师 / 升星大师</h4><p>只统计已穿戴装备的槽位：这些槽位的强化等级或星级全部达到某一档要求后，该档加成自动激活（显示为蓝色）。未穿戴装备的槽位不参与判定，也不会拖低已装备槽位的大师档位。</p></section>
    <section><h4>洗炼 / 魂石</h4><p>本轮暂未开放，将在下一轮补齐。</p></section>
  </div>`;
}

function showGrowthModal(onBack = showHome) {
  showEquipmentGrowth(onBack);
}

function showHeroGrowthModal(onBack = showHome) {
  const breakthroughLevel = (state.heroBreakthrough + 1) * 10;
  const breakthroughCost = getHeroBreakthroughCost();
  const nextSkill = HERO_SKILLS.find((skill) => skill.level > state.heroLevel);
  const maxBreakthrough = Math.floor((HERO_MAX_LEVEL - 1) / 10);
  const editable = canManageHero();
  const needsBreakthrough = needsHeroBreakthrough();
  const expProgress = heroExpProgress();
  showModal(
    currentView === "home" ? "角色成长" : "局外养成",
    `Lv.${state.heroLevel} · 防线 ${state.maxHp} · 突破 ${state.heroBreakthrough}阶${expProgress.max ? " · 经验满级" : ` · 经验 ${formatPower(expProgress.cur)}/${formatPower(expProgress.need)}`}${editable ? "" : " · 战局进行中"}`,
    [
      {
        label: state.heroBreakthrough >= maxBreakthrough ? "突破已满" : needsBreakthrough
          ? `突破 · ${breakthroughCost}元宝` : `${breakthroughLevel}级可突破`,
        disabled: !editable || state.heroBreakthrough >= maxBreakthrough || !needsBreakthrough || state.yuanbao < breakthroughCost,
        onClick: () => {
          breakthroughHero();
          showHeroGrowthModal(onBack);
        },
      },
    ], { backAction: onBack },
  );
  modalCard.classList.add("growth-modal");
  modalDetail.innerHTML = `<div class="modal-resource-bar"><span><img src="${ASSET}home/premium.png" alt="元宝" /><b>${formatCurrency(state.yuanbao)}</b></span><span><img src="${ASSET}icon-coin.png" alt="金币" /><b>${formatCurrency(state.gold)}</b></span></div>`;
  const skills = document.createElement("div");
  skills.className = "growth-skill-list";
  HERO_SKILLS.forEach((skill) => {
    const unlocked = skill.level <= state.heroLevel;
    const row = document.createElement("div");
    row.className = `growth-skill-row${unlocked ? " unlocked" : " locked"}`;
    row.innerHTML = `<img src="${ASSET}${skill.icon}" alt="" />
      <div><strong>${skill.name}</strong><span>${skill.description}</span></div>
      <small>CD ${skill.cooldown}s<br>${unlocked ? "已解锁" : `${skill.level}级解锁`}</small>`;
    skills.appendChild(row);
  });
  modalDetail.appendChild(skills);
  const expWrap = document.createElement("div");
  expWrap.className = "growth-exp";
  expWrap.innerHTML = `<div class="growth-exp-head"><span>主角经验</span><b>${expProgress.max ? "已满级" : `${formatPower(expProgress.cur)} / ${formatPower(expProgress.need)}`}</b></div><div class="growth-exp-track"><i style="width:${expProgress.pct}%"></i></div>`;
  modalDetail.appendChild(expWrap);
}

function showShop(onBack = showHome, noticeText = "") {
  const shopExchangeTiers = (kind) => SHOP_EXCHANGE_CONFIG[kind].batchCosts
    .map((cost) => [cost * SHOP_EXCHANGE_CONFIG[kind].rate, cost]);
  const groups = [
    {
      kind: "enhance",
      label: "强化石",
      icon: "ui/forge/stone-enhance.png",
      field: "forgeEnhanceStone",
      unit: "个",
      tone: "green",
      tiers: shopExchangeTiers("enhance"),
    },
    {
      kind: "star",
      label: "升星石",
      icon: "ui/forge/stone-star.png",
      field: "forgeStarStone",
      unit: "个",
      tone: "purple",
      tiers: shopExchangeTiers("star"),
    },
    {
      kind: "gold",
      label: "金币",
      icon: "icon-coin.png",
      field: "gold",
      unit: "",
      tone: "gold",
      tiers: shopExchangeTiers("gold"),
    },
  ];
  const short = (value) => {
    const n = Math.max(0, Math.round(Number(value) || 0));
    if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
    if (n >= 10000) return n % 10000 === 0 ? `${n / 10000}万` : `${(n / 10000).toFixed(1)}万`;
    return String(n);
  };
  const ownedText = (group) => {
    const value = Number(state[group.field]) || 0;
    return `${short(value)}${group.unit}`;
  };
  const cardHtml = (group, amount, cost) => {
    const lack = state.yuanbao < cost;
    return `<button type="button" class="shop-card" data-tone="${group.tone}" data-buy data-kind="${group.kind}" data-amount="${amount}" data-cost="${cost}" data-lack="${lack ? 1 : 0}">
        <img class="shop-card-icon" src="${ASSET}${group.icon}" alt="" />
        <span class="shop-card-amount">${short(amount)}${group.unit}</span>
        <span class="shop-card-price"><img src="${ASSET}home/premium.png" alt="元宝" />${cost}</span>
        <span class="shop-card-action">${lack ? "元宝不足" : "兑换"}</span>
      </button>`;
  };
  const groupHtml = (group) => `<section class="shop-group" data-group="${group.kind}">
      <header class="shop-group-head">
        <img src="${ASSET}${group.icon}" alt="" />
        <span class="shop-group-name">${group.label}</span>
        <span class="shop-group-owned">持有 <b>${ownedText(group)}</b></span>
      </header>
      <div class="shop-cards">${group.tiers.map(([amount, cost]) => cardHtml(group, amount, cost)).join("")}</div>
    </section>`;
  const adLeft = Math.max(0, SHOP_AD_DAILY_LIMIT - state.shopAdUsed);
  const shopAdGroupHtml = () => `<section class="shop-group shop-ad-group" data-group="ad">
      <header class="shop-group-head">
        <img src="${ASSET}home/premium.png" alt="" />
        <span class="shop-group-name">每日看广告领元宝</span>
        <span class="shop-group-owned">今日剩余 <b class="shop-ad-left">${adLeft}</b>/${SHOP_AD_DAILY_LIMIT}</span>
      </header>
      <button type="button" class="shop-ad-card" data-ad-yuanbao data-lack="${adLeft > 0 ? 0 : 1}"${adLeft > 0 ? "" : " disabled"}>
        <img class="shop-ad-icon" src="${ASSET}home/reward-chest.png" alt="" />
        <span class="shop-ad-text">看完广告立得 <b>${SHOP_AD_YUANBAO}</b> 元宝</span>
        <span class="shop-ad-action">${adLeft > 0 ? "观看广告" : "今日已领完"}</span>
      </button>
    </section>`;
  showModal("商店", "", [], { backAction: () => {
    hideModal();
    onBack();
  } });
  modalCard.classList.add("shop-modal");
  modalDetail.innerHTML = `<div class="shop-panel">
    <div class="shop-topbar">
      <span class="shop-title">商店</span>
      <span class="shop-wallets">
        <span class="shop-wallet"><img src="${ASSET}home/premium.png" alt="元宝" /><b class="shop-yuanbao">${state.yuanbao}</b></span>
        <span class="shop-wallet"><img src="${ASSET}icon-coin.png" alt="金币" /><b class="shop-coin">${formatCurrency(state.gold)}</b></span>
      </span>
    </div>
    <div class="shop-body">${shopAdGroupHtml()}${groups.map(groupHtml).join("")}</div>
    <p class="shop-notice" role="status" aria-live="polite"></p>
    <p class="shop-rate">汇率：1 元宝 = ${Object.values(SHOP_EXCHANGE_CONFIG)
      .map(({ rate, label }) => `${rate} ${label}`).join(" = ")}</p>
  </div>`;
  const notice = modalDetail.querySelector(".shop-notice");
  notice.textContent = noticeText;
  const adCard = modalDetail.querySelector("[data-ad-yuanbao]");
  if (adCard) {
    adCard.addEventListener("click", () => {
      if (state.shopAdUsed >= SHOP_AD_DAILY_LIMIT) {
        notice.textContent = `今日 ${SHOP_AD_DAILY_LIMIT} 次广告元宝已领完，明天再来。`;
        return;
      }
      AdService.showRewarded({
        placement: "商店领取元宝",
        onComplete: () => {
          state.shopAdUsed = Math.min(SHOP_AD_DAILY_LIMIT, state.shopAdUsed + 1);
          state.yuanbao += SHOP_AD_YUANBAO;
          renderHud();
          saveProgress();
          showShop(onBack, `已领取 ${SHOP_AD_YUANBAO} 元宝，今日剩余 ${Math.max(0, SHOP_AD_DAILY_LIMIT - state.shopAdUsed)} 次。`);
        },
      });
    });
  }
  modalDetail.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = groups.find((entry) => entry.kind === btn.dataset.kind);
      if (!group) return;
      const cost = Number(btn.dataset.cost) || 0;
      const amount = Number(btn.dataset.amount) || 0;
      if (state.yuanbao < cost) {
        notice.textContent = `元宝不足：兑换 ${short(amount)}${group.unit}${group.label}需要 ${cost} 元宝，当前 ${state.yuanbao} 元宝。`;
        return;
      }
      state.yuanbao -= cost;
      state[group.field] = (Number(state[group.field]) || 0) + amount;
      renderHud();
      saveProgress();
      notice.textContent = `已用 ${cost} 元宝兑换 ${short(amount)}${group.unit}${group.label}。`;
      modalDetail.querySelector(".shop-yuanbao").textContent = String(state.yuanbao);
      modalDetail.querySelector(".shop-coin").textContent = formatCurrency(state.gold);
      modalDetail.querySelector(`.shop-group[data-group="${group.kind}"] .shop-group-owned b`).textContent = ownedText(group);
      modalDetail.querySelectorAll("[data-buy]").forEach((other) => {
        const lack = state.yuanbao < (Number(other.dataset.cost) || 0);
        other.dataset.lack = lack ? "1" : "0";
        const action = other.querySelector(".shop-card-action");
        if (action) action.textContent = lack ? "元宝不足" : "兑换";
      });
    });
  });
}

/* ==================== 边塞军报 · 异兽入侵 ==================== */
var armyReportTicker = null;
var armyReportModalOpen = false;

function randBetween(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (high <= low) return low;
  return low + Math.floor(Math.random() * (high - low + 1));
}

/* 当前是否在异兽入侵副本里（战斗难度 / 波次 / BOSS 波判定都读这里） */
function isBeastRaid() {
  return Boolean(state.beastRaid && state.beastRaid.active);
}

/* 局内取「本次战局」的关卡等级：主线=当前关，入侵=入侵关基准等级 */
function getRunLevel() {
  return isBeastRaid() ? Math.max(1, state.beastRaid.level) : state.level;
}

/* BOSS 波：主线=最后一波；异兽入侵=每 5 波（第 5 / 10 波） */
function isBossWave(round = state.round) {
  if (isBeastRaid()) return round > 0 && round % ARMY_REPORT_CONFIG.bossEveryWaves === 0;
  if (isChallengeMode()) return round > 0 && round % CHALLENGE_MODE_CONFIG.bossEveryWaves === 0;
  return round === state.maxRounds;
}

function getActiveArmyReport() {
  const report = state.armyReport ? state.armyReport.active : null;
  if (!report) return null;
  if (Date.now() >= report.expiresAt) return null;
  return report;
}

/* 保底计数按自然日重置：跨日后重新累计、额度恢复 */
function refreshArmyReportPity() {
  if (!state.armyReport) return;
  const day = getDayKey();
  if (state.armyReport.pityDate === day) return;
  state.armyReport.pityDate = day;
  state.armyReport.pityMisses = 0;
  state.armyReport.pityUsed = 0;
}

/* 保底状态：used=当日额度是否已用尽；remain=再侦查几次必出 */
function armyReportPityStatus() {
  refreshArmyReportPity();
  const needed = Math.max(1, ARMY_REPORT_CONFIG.pityMissRequired);
  const limit = Math.max(1, ARMY_REPORT_CONFIG.pityDailyLimit);
  const misses = Math.max(0, state.armyReport.pityMisses);
  return {
    needed,
    limit,
    misses: Math.min(misses, needed),
    remain: Math.max(0, needed - misses),
    used: state.armyReport.pityUsed >= limit,
  };
}

/* 下一次侦查是否吃保底（当日额度未用尽 且 连续未发现已达阈值） */
function isArmyReportPityDue() {
  const status = armyReportPityStatus();
  return !status.used && state.armyReport.pityMisses >= status.needed;
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/* 军报 UI 同步：走马灯 + 小红点 + 弹窗倒计时。渲染开销很小，由 1 秒心跳与主循环共同驱动 */
function renderArmyReportState() {
  const report = getActiveArmyReport();
  const remain = report ? formatCountdown(report.expiresAt - Date.now()) : "";
  const copy = report
    ? `${report.source === "pity" ? "【保底军报】" : ""}${report.message}　剩余 ${remain}　点击横幅立即挑战`
    : "";
  document.querySelectorAll(".army-marquee").forEach((el) => {
    el.classList.toggle("visible", Boolean(report));
    el.querySelectorAll("[data-marquee-copy]").forEach((node) => {
      if (node.textContent !== copy) node.textContent = copy;
    });
  });
  if (homeScreen) homeScreen.classList.toggle("has-report", Boolean(report));
  if (gameScreen) gameScreen.classList.toggle("has-report", Boolean(report));
  if (armyReportDot) armyReportDot.classList.toggle("hidden", !report);
  if (!armyReportModalOpen || !modalDetail) return;
  const countdown = modalDetail.querySelector("[data-report-countdown]");
  if (countdown) countdown.textContent = report ? remain : "--:--";
  const online = modalDetail.querySelector("[data-report-next]");
  if (online) online.textContent = formatCountdown(Math.max(0, (state.armyReport.nextCheckAt || 0) - Date.now()));
}

/* 在线心跳：每 10 分钟一次 10% 判定；军报存在期间维持倒计时，超时即消失 */
function armyReportTick() {
  if (!state.armyReport) return;
  const now = Date.now();
  if (state.armyReport.active) {
    if (now >= state.armyReport.active.expiresAt) {
      clearArmyReport();
      if (currentView !== "battle") tipText.textContent = "军报已失效：未在时限内迎战，异兽撤离。";
      if (armyReportModalOpen) showArmyReport();
      return;
    }
    renderArmyReportState();
    return;
  }
  if (!state.armyReport.nextCheckAt) {
    state.armyReport.nextCheckAt = now + ARMY_REPORT_CONFIG.checkIntervalMs;
    return;
  }
  if (now < state.armyReport.nextCheckAt) return;
  state.armyReport.nextCheckAt = now + ARMY_REPORT_CONFIG.checkIntervalMs;
  // 保底优先：当日额度未用尽且已连续 pityMissRequired 次未发现 → 本次必出
  if (isArmyReportPityDue()) {
    triggerArmyReport("pity");
    return;
  }
  if (Math.random() < ARMY_REPORT_CONFIG.triggerChance) triggerArmyReport("online");
  else {
    state.armyReport.pityMisses += 1;
    saveProgress();
  }
}

function startArmyReportClock() {
  refreshArmyReportPity();
  if (armyReportTicker) clearInterval(armyReportTicker);
  armyReportTicker = setInterval(armyReportTick, 1000);
  armyReportTick();
}

function triggerArmyReport(source = "online") {
  if (getActiveArmyReport()) return false;
  refreshArmyReportPity();
  const byPity = source === "pity";
  const now = Date.now();
  state.armyReport.totalTriggered += 1;
  state.armyReport.active = {
    id: state.armyReport.totalTriggered,
    spawnedAt: now,
    expiresAt: now + ARMY_REPORT_CONFIG.stayMs,
    message: ARMY_REPORT_MESSAGES[Math.floor(Math.random() * ARMY_REPORT_MESSAGES.length)],
    source: byPity ? "pity" : source,
  };
  // 出报即打断「连续未发现」；保底出报消耗当日额度
  state.armyReport.pityMisses = 0;
  if (byPity) state.armyReport.pityUsed += 1;
  state.armyReport.nextCheckAt = now + ARMY_REPORT_CONFIG.checkIntervalMs;
  saveProgress();
  renderArmyReportState();
  if (currentView !== "battle") {
    tipText.textContent = byPity
      ? "保底军报已至：久候无讯，此番必有斩获！军报 5 分钟内有效，请尽快迎战。"
      : "军报已至：异兽入侵！军报 5 分钟内有效，请尽快迎战。";
  }
  return true;
}

function clearArmyReport() {
  if (!state.armyReport.active) return false;
  state.armyReport.active = null;
  saveProgress();
  renderArmyReportState();
  return true;
}

/* ---------- 奖励口径 ---------- */
/* 主线当前关卡「能产出」的最高装备品质（掉落表里权重 > 0 的最高档） */
function getMainlineEquipmentQualityCeiling(level = getRunLevel()) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const table = [...EQUIPMENT_DROP_TABLES].reverse().find(({ minLevel }) => safeLevel >= minLevel)
    || EQUIPMENT_DROP_TABLES[0];
  let ceiling = 1;
  table.weights.forEach((weight, index) => { if (weight > 0) ceiling = index + 1; });
  return ceiling;
}

function getBeastGoldRange(level = getRunLevel()) {
  const base = LEVEL_GOLD_REWARD.base + Math.max(1, level) * LEVEL_GOLD_REWARD.step;
  return {
    min: Math.round(base * ARMY_REPORT_CONFIG.goldMultiplierMin),
    max: Math.round(base * ARMY_REPORT_CONFIG.goldMultiplierMax),
  };
}

function rollBeastRaidReward(success) {
  const level = getRunLevel();
  const gold = getBeastGoldRange(level);
  const tier = getForgeProgressionTier(level);
  const stoneOf = (base) => Math.max(1, Math.round(base * ARMY_REPORT_CONFIG.stoneMultiplier));
  return {
    success,
    gold: success ? randBetween(gold.min, gold.max) : gold.min,
    yuanbao: success
      ? randBetween(ARMY_REPORT_CONFIG.yuanbaoMin, ARMY_REPORT_CONFIG.yuanbaoMax)
      : ARMY_REPORT_CONFIG.yuanbaoMin,
    qualityBonus: success
      ? randBetween(ARMY_REPORT_CONFIG.qualityBonusMin, ARMY_REPORT_CONFIG.qualityBonusMax)
      : ARMY_REPORT_CONFIG.qualityBonusMin,
    enhance: success && Math.random() < ARMY_REPORT_CONFIG.enhanceChance ? stoneOf(tier.levelEnhance) : 0,
    star: success && Math.random() < ARMY_REPORT_CONFIG.starChance ? stoneOf(tier.levelStar) : 0,
  };
}

/* 单场入侵只结算一次；失败后复活通关，按更高档位补齐差额（与主线 paidReward 同一套口径） */
function settleBeastRaid(success) {
  if (!state.beastPaid) {
    state.beastPaid = { gold: 0, yuanbao: 0, enhance: 0, star: 0, equipmentId: null, quality: 0 };
  }
  if (success && !state.beastVictoryTarget) state.beastVictoryTarget = rollBeastRaidReward(true);
  if (!success && !state.beastDefeatTarget) state.beastDefeatTarget = rollBeastRaidReward(false);
  const target = success ? state.beastVictoryTarget : state.beastDefeatTarget;
  const paid = state.beastPaid;

  const gained = {
    gold: Math.max(0, target.gold - paid.gold),
    yuanbao: Math.max(0, target.yuanbao - paid.yuanbao),
    enhance: Math.max(0, target.enhance - paid.enhance),
    star: Math.max(0, target.star - paid.star),
  };
  paid.gold = Math.max(paid.gold, target.gold);
  paid.yuanbao = Math.max(paid.yuanbao, target.yuanbao);
  paid.enhance = Math.max(paid.enhance, target.enhance);
  paid.star = Math.max(paid.star, target.star);
  state.gold += gained.gold;
  state.yuanbao += gained.yuanbao;
  state.forgeEnhanceStone += gained.enhance;
  state.forgeStarStone += gained.star;

  // 必得装备：一场入侵最多 1 件；失败给最低档，通关给 +1~2 档，取本次掷出的最好品质
  const quality = Math.min(
    EQUIPMENT_QUALITY.length,
    getMainlineEquipmentQualityCeiling(getRunLevel()) + target.qualityBonus,
  );
  const existing = paid.equipmentId
    ? state.equipmentInventory.find((item) => item.id === paid.equipmentId)
    : null;
  if (!existing) {
    const item = createEquipment(rand(EQUIPMENT_SLOTS).id, quality);
    state.equipmentInventory.push(item);
    paid.equipmentId = item.id;
    paid.quality = quality;
  } else if (quality > existing.quality) {
    const upgraded = createEquipment(existing.slot, quality);
    existing.quality = quality;
    existing.value = upgraded.value;
    paid.quality = quality;
  }
  saveProgress();
  return { ...paid, gained, success };
}

function beastRewardRowHtml(result, success) {
  const rows = [
    { key: "equipment", kind: "must", label: "高品质装备", value: `${qualityInfo(result.quality).name}品质 ×1`, got: true },
    { key: "gold", kind: "must", label: "金币", value: `+${formatCurrency(result.gold)}`, got: true },
    { key: "yuanbao", kind: "must", label: "元宝", value: `+${result.yuanbao}`, got: true },
    { key: "enhance", kind: "chance", label: "强化石", value: result.enhance ? `+${result.enhance}` : "未掉落", got: result.enhance > 0 },
    { key: "star", kind: "chance", label: "升星石", value: result.star ? `+${result.star}` : "未掉落", got: result.star > 0 },
  ];
  return `<div class="army-report-card"><div class="beast-reward-row">${rows.map((row) => `<div class="beast-reward-item ${row.got ? "got" : "miss"}" data-reward="${row.key}">
      <i class="${row.kind}">${row.kind === "must" ? "必得" : "几率"}</i>
      <b>${row.value}</b>
      <span>${row.label}</span>
    </div>`).join("")}</div>
    <p class="army-report-note">${success ? "异兽已被击退，全额奖励已入账。" : "败退只结算保底奖励：必得项按范围最低值发放，几率材料不发放。"}</p></div>`;
}

/* ---------- 军报弹窗 ---------- */
function armyReportRewardSummary(level = Math.max(1, state.selectedLevel || state.level)) {
  const ceiling = getMainlineEquipmentQualityCeiling(level);
  const low = qualityInfo(Math.min(EQUIPMENT_QUALITY.length, ceiling + ARMY_REPORT_CONFIG.qualityBonusMin));
  const high = qualityInfo(Math.min(EQUIPMENT_QUALITY.length, ceiling + ARMY_REPORT_CONFIG.qualityBonusMax));
  const gold = getBeastGoldRange(level);
  return { qualityLow: low, qualityHigh: high, gold };
}

function showArmyReport() {
  if (!state.armyReport) return;
  const report = getActiveArmyReport();
  if (!report) {
    const wait = Math.max(0, (state.armyReport.nextCheckAt || 0) - Date.now());
    const pity = armyReportPityStatus();
    const pityText = pity.used ? "今日已用" : `还需 ${pity.remain} 次侦查`;
    showModal("边塞军报", `军中暂无急报。守城期间每 ${ARMY_REPORT_CONFIG.checkIntervalMs / 60000} 分钟侦查一次敌情，${Math.round(ARMY_REPORT_CONFIG.triggerChance * 100)}% 几率发现异兽入侵；发现后须在 ${ARMY_REPORT_CONFIG.stayMs / 60000} 分钟内迎战，超时军报作废。`, [
      { label: "知道了", secondary: true, onClick: () => {} },
    ]);
    modalCard.classList.add("army-report-modal");
    modalDetail.innerHTML = `<div class="army-report-card">
      <div class="army-report-next"><span>下次侦查</span><b data-report-next>${formatCountdown(wait)}</b></div>
      <div class="army-report-next is-pity${pity.used ? " is-used" : ""}"><span>保底必出</span><b>${pityText}</b></div>
      <div class="army-report-meta">
        <span><b>${ARMY_REPORT_CONFIG.waves}</b><small>入侵波次</small></span>
        <span><b>每 ${ARMY_REPORT_CONFIG.bossEveryWaves} 波</b><small>BOSS 波</small></span>
        <span><b>0</b><small>体力消耗</small></span>
      </div>
      <p class="army-report-note">异兽入侵为限时副本：玩法同主线副本，波次更多、每 ${ARMY_REPORT_CONFIG.bossEveryWaves} 波一个 BOSS 波。通关必得高品质装备、大量金币与元宝，失败也有保底奖励。</p>
      <p class="army-report-note">军报保底：当日连续 ${ARMY_REPORT_CONFIG.pityMissRequired} 次侦查未发现敌情，则下一次侦查必定发现；每日保底仅 ${ARMY_REPORT_CONFIG.pityDailyLimit} 次。</p>
    </div>`;
    armyReportModalOpen = true;
    return;
  }
  const info = armyReportRewardSummary();
  const byPity = report.source === "pity";
  const headline = byPity
    ? `斥候来报：多番侦查终有斩获，此番异兽必临边塞！军报剩余 ${formatCountdown(report.expiresAt - Date.now())}，请少主在时限内前往迎战。`
    : `斥候来报：异兽即将入侵边塞！军报剩余 ${formatCountdown(report.expiresAt - Date.now())}，请少主在时限内前往迎战。`;
  showModal("边塞军报", headline, [
    { label: "立即挑战", onClick: () => challengeArmyReport() },
    { label: "稍后再说", secondary: true, onClick: () => {} },
  ]);
  modalCard.classList.add("army-report-modal");
  modalDetail.innerHTML = `<div class="army-report-card">
    <div class="army-report-countdown"><span>军报倒计时${byPity ? "<i class='pity-tag'>保底</i>" : ""}</span><b data-report-countdown>${formatCountdown(report.expiresAt - Date.now())}</b></div>
    <div class="army-report-meta">
      <span><b>${ARMY_REPORT_CONFIG.waves}</b><small>入侵波次</small></span>
      <span><b>每 ${ARMY_REPORT_CONFIG.bossEveryWaves} 波</b><small>BOSS 波</small></span>
      <span><b>0</b><small>体力消耗</small></span>
    </div>
    <ul class="army-report-rewards">
      <li><i class="must">必得</i><span>高品质装备 · ${info.qualityLow.name}~${info.qualityHigh.name}品质 1 件</span></li>
      <li><i class="must">必得</i><span>大量金币 ${formatCurrency(info.gold.min)}~${formatCurrency(info.gold.max)}</span></li>
      <li><i class="must">必得</i><span>元宝 ${ARMY_REPORT_CONFIG.yuanbaoMin}~${ARMY_REPORT_CONFIG.yuanbaoMax}</span></li>
      <li><i class="chance">几率</i><span>装备强化石 / 装备升星石</span></li>
    </ul>
    <p class="army-report-note">通关按全额发放；失败只发保底（必得项按范围最低值），几率材料不发放。</p>
  </div>`;
  armyReportModalOpen = true;
}

/* ---------- 挑战流程 ---------- */
function challengeArmyReport() {
  const report = getActiveArmyReport();
  if (!report) {
    showArmyReport();
    return;
  }
  if (isBeastRaid() && state.phase !== "settle") {
    showModal("边塞军报", "上一场异兽入侵还没结束，先击退这批异兽再去迎战新的军报。", [
      { label: "回到当前入侵", onClick: showBattle },
      { label: "稍后再说", secondary: true, onClick: () => {} },
    ]);
    return;
  }
  if (state.levelStaminaSpent && state.phase !== "settle") {
    showModal("边塞军报", `第 ${state.level} 关主线战局尚未结束。军报剩余 ${formatCountdown(report.expiresAt - Date.now())}，放弃主线战局会损失本关已消耗的体力。`, [
      { label: "放弃主线，迎战异兽", onClick: () => beginBeastRaid(report) },
      { label: "继续主线战局", secondary: true, onClick: showBattle },
      { label: "稍后再说", secondary: true, onClick: () => {} },
    ]);
    return;
  }
  beginBeastRaid(report);
}

function beginBeastRaid(report) {
  clearArmyReport();
  const level = Math.max(1, state.selectedLevel || state.level);
  resetGame(true, {
    beast: { active: true, reportId: report.id, level, waves: ARMY_REPORT_CONFIG.waves },
  });
  // 不消耗体力（ARMY_REPORT_CONFIG.enterCostStamina = 0）；但标记战局进行中，返回主页可「继续守城」
  state.levelStaminaSpent = ARMY_REPORT_CONFIG.enterCostStamina <= 0;
  updateDailyProgress("beast");
  tipText.textContent = `异兽入侵：共 ${state.beastRaid.waves} 波，每 ${ARMY_REPORT_CONFIG.bossEveryWaves} 波一个 BOSS 波，不消耗体力，守住即可获得重赏。`;
  showBattle();
}

function returnHomeFromBeastRaid() {
  resetGame();
  showHome();
}

function showBeastVictory() {
  updateDailyProgress("play");
  const result = settleBeastRaid(true);
  state.armyReport.totalCleared += 1;
  renderHud();
  const parts = [
    `金币 +${formatCurrency(result.gold)}`,
    `元宝 +${result.yuanbao}`,
    `${qualityInfo(result.quality).name}品质装备 ×1`,
  ];
  if (result.enhance > 0) parts.push(`强化石 +${result.enhance}`);
  if (result.star > 0) parts.push(`升星石 +${result.star}`);
  showModal("异兽击退", `异兽入侵已平定！本场结算：${parts.join("、")}。`, [
    { label: "局外养成", secondary: true, onClick: () => showGrowthModal(showBeastVictory) },
    { label: "领取并返回", onClick: returnHomeFromBeastRaid },
  ]);
  modalCard.classList.add("army-report-modal");
  modalDetail.innerHTML = beastRewardRowHtml(result, true);
}

function showBeastDefeat() {
  updateDailyProgress("play");
  const result = settleBeastRaid(false);
  renderHud();
  const base = `异兽突破防线，本次入侵失败。按军报承诺，败退仍可领走保底：金币 +${formatCurrency(result.gold)}、元宝 +${result.yuanbao}、${qualityInfo(result.quality).name}品质装备 ×1（必得项按范围最低值，几率材料不发放）。`;
  if (!state.revived) {
    showModal("防线失守", `${base} 观看广告可回满防线、从当前波次继续迎战，通关后补齐全额奖励。`, [
      { label: "看广告继续迎战", onClick: () => AdService.showRewarded({ placement: "异兽入侵复活", onComplete: revive }) },
      { label: "领取并返回", secondary: true, onClick: returnHomeFromBeastRaid },
    ]);
  } else {
    showModal("异兽入侵失败", `${base} 本场复活机会已用完，军报已消耗，请等待下一次军报。`, [
      { label: "领取并返回", onClick: returnHomeFromBeastRaid },
    ]);
  }
  modalCard.classList.add("army-report-modal");
  modalDetail.innerHTML = beastRewardRowHtml(result, false);
}

function nextLevel() {
  state.level += 1;
  state.selectedLevel = state.level;
  resetGame(false);
}

function completeLevelToHome() {
  state.level += 1;
  state.selectedLevel = state.level;
  resetGame(false);
  showHome();
}

function resetGame(keepLevel = true, options = {}) {
  finishMergeHintAd(false, false);
  stopLoop();
  hideModal();
  state.resolutionId += 1;
  state.resolving = false;
  if (!keepLevel) {
    // level was already advanced by nextLevel
  }
  // 异兽入侵：传入 options.beast 即进入入侵副本；不传则回到主线上下文
  state.beastRaid = options.beast || null;
  state.beastPaid = null;
  state.beastVictoryTarget = null;
  state.beastDefeatTarget = null;
  state.challengeRewardMultiplier = isChallengeMode()
    ? randBetween(CHALLENGE_MODE_CONFIG.rewardMultiplierMin * 100, CHALLENGE_MODE_CONFIG.rewardMultiplierMax * 100) / 100 : 1;
  state.phase = "setup";
  state.round = 1;
  state.maxRounds = isBeastRaid()
    ? state.beastRaid.waves
    : isChallengeMode() ? challengeRoundsForLevel(state.level) : getRoundsForLevel(state.level);
  state.steps = 8;
  state.hp = state.maxHp;
  state.monsters = [];
  state.spawned = 0;
  state.bossLane = null;
  state.equipmentDropGranted = false;
  state.lastEquipmentDrop = null;
  state.lastChallengeEquipmentDrops = [];
  state.settlementAdEquipmentDropGranted = false;
  state.lastSettlementAdEquipmentDrop = null;
  state.settlementAdHeroExpGranted = false;
  state.speed = 1;
  state.levelStaminaSpent = false;
  state.levelExpAwarded = false;
  state.levelExpGain = 0;
  state.levelExpLeveled = 0;
  state.revived = false;
  state.doubled = false;
  state.totalKills = 0;
  state.cardsOffered = 0;
  state.killsSinceCard = 0;
  state.nextCardKillTarget = CARD_KILL_STEPS[0];
  state.cardQueued = false;
  state.cardCooldown = 0;
  state.rewardGranted = 0;
  state.paidReward = 0;
  state.paidYuanbao = 0;
  state.paidForgeEnhanceStone = 0;
  state.paidForgeStarStone = 0;
  state.mergeHintsUsed = 0;
  state.boardShufflesUsed = 0;
  state.shuffleAnimationPending = false;
  clearMergeHint();
  state.heroSkillIndex = 0;
  state.heroSkillQueue = shuffled(getUnlockedHeroSkills().map((skill) => skill.id));
  state.heroRallyRemaining = 0;
  state.heroDamageRemaining = 0;
  state.heroSpeedRemaining = 0;
  HERO_SKILLS.forEach((skill) => { state.heroSkillCooldowns[skill.id] = 0; });
  state.damageMultiplier = 1;
  state.attackSpeedMultiplier = 1;
  state.attackMode = "standard";
  state.executionReady = false;
  state.nextPieceId = 1;
  seedBoard();
  setSceneBg(getSceneKey(getRunLevel()));
  render();
  tipText.textContent = isBeastRaid()
    ? `异兽入侵：共 ${state.beastRaid.waves} 波，每 ${ARMY_REPORT_CONFIG.bossEveryWaves} 波一个 BOSS 波，不消耗体力。`
    : "交换棋子，让 3 个以上同类棋子在横、竖或斜线上连续排列即可消除。";
}

startWaveBtn.addEventListener("click", startWave);
staminaBtn.addEventListener("click", showStaminaRefill);
heroSkillBtn.addEventListener("click", releaseHeroSkill);
speedBtn.addEventListener("click", () => {
  state.speed = state.speed === 1 ? 2 : 1;
  renderHud();
});
adStepsBtn.addEventListener("click", () => AdService.showRewarded({
  placement: "额外步数",
  onComplete: () => {
    state.steps += 3;
    tipText.textContent = "激励广告完成，获得 3 步。";
  },
}));
mergeHintBtn.addEventListener("click", showMergeHintAd);
boardShuffleBtn.addEventListener("click", showBoardShuffleAd);
resetBtn.addEventListener("click", () => resetGame());
homeStartBtn.addEventListener("click", startLevelFromHome);
homeNormalModeBtn.addEventListener("click", () => selectHomeMode(false));
homeChallengeModeBtn.addEventListener("click", () => selectHomeMode(true));
homeStaminaBtn.addEventListener("click", showStaminaRefill);
homeHeroAvatar.addEventListener("click", () => showHeroSkillView(showHome));
battleHomeBtn.addEventListener("click", showHome);
homePrevLevelBtn.addEventListener("click", () => selectHomeLevel(-1));
homeNextLevelBtn.addEventListener("click", () => selectHomeLevel(1));
document.getElementById("armyMarqueeHome").addEventListener("click", () => {
  if (getActiveArmyReport()) showArmyReport();
});
homeQuickTask.addEventListener("click", () => {
  const task = currentMainQuest();
  if (!task) return;
  if (getMainQuestProgress(task) >= task.target) claimMainQuest();
  else jumpToMainQuest(task);
});
homeStageFocus.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  homeSwipeStartX = event.clientX;
});
homeStageFocus.addEventListener("pointerup", (event) => {
  if (homeSwipeStartX === null) return;
  const distance = event.clientX - homeSwipeStartX;
  homeSwipeStartX = null;
  if (Math.abs(distance) < 42) return;
  selectHomeLevel(distance < 0 ? 1 : -1);
});
homeStageFocus.addEventListener("pointercancel", () => {
  homeSwipeStartX = null;
});
document.querySelectorAll("[data-home-feature]").forEach((button) => {
  button.addEventListener("click", () => showHomeFeature(button.dataset.homeFeature));
});

renderLegend();
renderLanes();
loadProgress();
resetGame();
showHome();
startArmyReportClock();
if (state.tutorialStep < 5) setTimeout(startTutorial, 350);
WARRIORS.forEach(({ type }) => preloadWarriorAppearance(type));
[...Object.values(DAMAGE_GLYPHS), ...Object.values(COMBAT_POPUP_LABELS)].forEach((source) => {
  const glyph = new Image();
  glyph.src = `${ASSET}${source}`;
});
