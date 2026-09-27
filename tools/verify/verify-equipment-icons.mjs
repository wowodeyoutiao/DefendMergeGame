/**
 * 校验装备图标接入与职业绑定规则。
 * 从 app.js 源码文本抽取真实函数，注入最小依赖后做纯数据断言，
 * 同时逐文件校验 6 部位 × 7 品质（武器/衣服再乘 3 职业）图标是否齐全。
 * 用法：node tools/verify/verify-equipment-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");

function extract(fnName) {
  const start = src.indexOf(`function ${fnName}(`);
  if (start < 0) throw new Error(`未找到 ${fnName}`);
  const lines = src.slice(start).split(/\r?\n/);
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trimEnd() === "}") return lines.slice(0, i + 1).join("\n");
  }
  throw new Error(`${fnName} 结束位置解析失败`);
}

const EQUIPMENT_SLOTS = [
  { id: "weapon", name: "武器", stat: "attack", warriorBound: true },
  { id: "armor", name: "衣服", stat: "crit", warriorBound: true },
  { id: "helmet", name: "头盔", stat: "hit" },
  { id: "necklace", name: "项链", stat: "attack" },
  { id: "ring", name: "戒指", stat: "attack" },
  { id: "boots", name: "靴子", stat: "speed" },
];
const EQUIPMENT_QUALITY = new Array(7).fill(null).map((_, index) => ({ id: index + 1 }));
const WARRIORS = [
  { type: "fan", name: "男战士", modelRole: "warrior" },
  { type: "sword", name: "男法师", modelRole: "mage" },
  { type: "rock", name: "女祭司", modelRole: "priest" },
];
const state = { selectedWarriorType: "fan" };
const slotInfo = (slot) => EQUIPMENT_SLOTS.find((entry) => entry.id === slot) || EQUIPMENT_SLOTS[0];

const fn = new Function(
  "EQUIPMENT_SLOTS",
  "EQUIPMENT_QUALITY",
  "WARRIORS",
  "state",
  "slotInfo",
  `${extract("warriorModelRole")}
${extract("warriorShortName")}
${extract("getEquipmentIcon")}
${extract("equipmentFitsWarrior")}
${extract("equipmentWarriorTag")}
${extract("equipmentArtType")}
return { warriorModelRole, warriorShortName, getEquipmentIcon, equipmentFitsWarrior, equipmentWarriorTag, equipmentArtType };`
);
const api = fn(EQUIPMENT_SLOTS, EQUIPMENT_QUALITY, WARRIORS, state, slotInfo);

let failed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  通过  ${name}`);
  } else {
    failed += 1;
    console.log(`  失败  ${name} ${detail}`);
  }
}

const ASSET_DIR = path.join(root, "public", "assets");
const exists = (relative) => fs.existsSync(path.join(ASSET_DIR, relative));

console.log("一、图标资源完整性（6 部位 x 7 品质，武器/衣服 x 3 职业）");
const boundSlots = ["weapon", "armor"];
const freeSlots = ["helmet", "necklace", "ring", "boots"];
let missing = [];
boundSlots.forEach((slot) => {
  WARRIORS.forEach(({ type }) => {
    for (let q = 1; q <= 7; q += 1) {
      const file = api.getEquipmentIcon(slot, q, type);
      if (!exists(file)) missing.push(file);
    }
  });
});
freeSlots.forEach((slot) => {
  for (let q = 1; q <= 7; q += 1) {
    const file = api.getEquipmentIcon(slot, q, "fan");
    if (!exists(file)) missing.push(file);
  }
});
check(`全部 ${boundSlots.length * 3 * 7 + freeSlots.length * 7} 个图标组合均存在`, missing.length === 0, missing.slice(0, 5).join("、"));
check("武器/衣服共 42 张独立文件", new Set(boundSlots.flatMap((slot) => WARRIORS.flatMap(({ type }) => Array.from({ length: 7 }, (_, i) => api.getEquipmentIcon(slot, i + 1, type))))).size === 42);
check("全职业 4 部位共 28 张独立文件", new Set(freeSlots.flatMap((slot) => Array.from({ length: 7 }, (_, i) => api.getEquipmentIcon(slot, i + 1, "fan")))).size === 28);

console.log("\n二、图标路径规则");
check("战士武器 白 -> weapon-warrior-1.png", api.getEquipmentIcon("weapon", 1, "fan") === "equipment/weapon-warrior-1.png");
check("法师武器 金 -> weapon-mage-7.png", api.getEquipmentIcon("weapon", 7, "sword") === "equipment/weapon-mage-7.png");
check("祭司衣服 红 -> armor-priest-6.png", api.getEquipmentIcon("armor", 6, "rock") === "equipment/armor-priest-6.png");
check("靴子 紫 -> boots-4.png（不含职业）", api.getEquipmentIcon("boots", 4, "rock") === "equipment/boots-4.png");
check("头盔 橙 -> helmet-5.png（不含职业）", api.getEquipmentIcon("helmet", 5, "sword") === "equipment/helmet-5.png");
check("项链 绿 -> necklace-2.png", api.getEquipmentIcon("necklace", 2) === "equipment/necklace-2.png");
check("戒指 金 -> ring-7.png", api.getEquipmentIcon("ring", 7) === "equipment/ring-7.png");
check("品质越界收敛到 7", api.getEquipmentIcon("ring", 99) === "equipment/ring-7.png");
check("品质越界收敛到 1", api.getEquipmentIcon("ring", 0) === "equipment/ring-1.png");
check("默认使用当前选中武将职业", api.getEquipmentIcon("weapon", 3) === "equipment/weapon-warrior-3.png");
state.selectedWarriorType = "rock";
check("切换武将后默认职业跟随", api.getEquipmentIcon("weapon", 3) === "equipment/weapon-priest-3.png");
state.selectedWarriorType = "fan";

console.log("\n三、职业模型映射");
check("fan=warrior", api.warriorModelRole("fan") === "warrior");
check("sword=mage", api.warriorModelRole("sword") === "mage");
check("rock=priest", api.warriorModelRole("rock") === "priest");
check("未知职业兜底 warrior", api.warriorModelRole("unknown") === "warrior");
check("短名去掉性别前缀", api.warriorShortName("fan") === "战士" && api.warriorShortName("sword") === "法师" && api.warriorShortName("rock") === "祭司");

console.log("\n四、职业绑定规则");
const warriorSword = { slot: "weapon", warrior: "fan" };
const mageSword = { slot: "weapon", warrior: "sword" };
const legacySword = { slot: "weapon" };
const helmet = { slot: "helmet" };
check("战士武器可给战士穿", api.equipmentFitsWarrior(warriorSword, "fan") === true);
check("战士武器不能给法师穿", api.equipmentFitsWarrior(warriorSword, "sword") === false);
check("战士武器不能给祭司穿", api.equipmentFitsWarrior(warriorSword, "rock") === false);
check("法师武器可给法师穿", api.equipmentFitsWarrior(mageSword, "sword") === true);
check("旧存档无职业字段的武器保持通用", api.equipmentFitsWarrior(legacySword, "rock") === true);
check("头盔不受职业限制", api.equipmentFitsWarrior(helmet, "rock") === true);
check("空装备视为可穿", api.equipmentFitsWarrior(null, "fan") === true);
check("武器展示名带职业标记", api.equipmentWarriorTag(warriorSword) === "战士");
check("头盔展示名不带职业标记", api.equipmentWarriorTag(helmet) === "");

console.log("\n五、图标身份一致性（品质只由底框表达，同一件装备四处长得一样）");
const legacyRenders = [];
["fan", "sword", "rock"].forEach((viewer) => {
  state.selectedWarriorType = viewer;
  legacyRenders.push(api.getEquipmentIcon(legacySword.slot, 1, api.equipmentArtType(legacySword)));
});
check("旧存档通用武器不随查看武将改变外观", new Set(legacyRenders).size === 1, legacyRenders.join("、"));
check("旧存档通用武器固定取第一个职业美术", legacyRenders[0] === "equipment/weapon-warrior-1.png");
state.selectedWarriorType = "fan";
check("带职业字段的装备取自身职业", api.equipmentArtType(mageSword) === "sword");
check("带职业字段的装备不受查看武将影响", (() => { state.selectedWarriorType = "rock"; const r = api.equipmentArtType(mageSword); state.selectedWarriorType = "fan"; return r === "sword"; })());
check("头盔等通用部位不影响图标路径", api.getEquipmentIcon(helmet.slot, 3, api.equipmentArtType(helmet)) === "equipment/helmet-3.png");
check("空槽位回落到当前武将", api.equipmentArtType(null) === "fan");

console.log(failed ? `\n结论：${failed} 项失败` : "\n结论：全部通过");
process.exit(failed ? 1 : 0);
