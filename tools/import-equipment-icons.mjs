/**
 * 从 art/Icon 导入装备图标到 public/assets/equipment/
 *
 * 源文件命名规律（art/Icon）：
 *   item_1~42      按职业的武器 / 衣服，奇数=武器、偶数=衣服，每品质每职业 2 张
 *                  战士 起始 1、法师 起始 3、祭祀 起始 5；品质递增时编号 +6
 *   item_1X1~2X8   全职业通用部位，前缀 15/16/.../21 对应 白绿蓝紫橙红金，尾号为部位
 *                  1 鞋子、2 戒指、3 指环、4 头盔、5 项链、6 腰带、7 饰品、8 裤子
 *
 * 输出命名（ASCII）：
 *   weapon|armor - warrior|mage|priest - 1..7 .png
 *   helmet|necklace|ring|boots - 1..7 .png
 *
 * 部位对应：weapon=武器、armor=衣服、helmet=头盔、necklace=项链、ring=戒指、boots=靴子
 * 不使用的源素材：指环(3)、腰带(6)、饰品(7)、裤子(8)
 *
 * 用法：node tools/import-equipment-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "art", "Icon");
const outDir = path.join(root, "public", "assets", "equipment");

const WARRIOR_BY_APPEARANCE = [
  { id: "warrior", cn: "战士", start: 1 },
  { id: "mage", cn: "法师", start: 3 },
  { id: "priest", cn: "祭祀", start: 5 },
];
const QUALITY_CN = ["白", "绿", "蓝", "紫", "橙", "红", "金"];
const GLOBAL_SLOT_BY_TAIL = { 1: "boots", 2: "ring", 4: "helmet", 5: "necklace" };

const plan = new Map();

WARRIOR_BY_APPEARANCE.forEach(({ id, start }) => {
  QUALITY_CN.forEach((_, qualityIndex) => {
    const quality = qualityIndex + 1;
    const base = start + qualityIndex * 6;
    plan.set(base, `weapon-${id}-${quality}.png`);
    plan.set(base + 1, `armor-${id}-${quality}.png`);
  });
});

QUALITY_CN.forEach((_, qualityIndex) => {
  const quality = qualityIndex + 1;
  // 全职业编号为 151~158（白）、161~168（绿）……211~218（金）
  const base = 150 + qualityIndex * 10;
  Object.entries(GLOBAL_SLOT_BY_TAIL).forEach(([tail, slot]) => {
    plan.set(base + Number(tail), `${slot}-${quality}.png`);
  });
});

const sources = new Map();
const extras = [];
fs.readdirSync(srcDir).forEach((file) => {
  const match = /^item_(\d+)(.*)\.png$/.exec(file);
  if (!match) return;
  const num = Number(match[1]);
  sources.set(num, { file, label: match[2] });
  if (!plan.has(num)) extras.push(`${file}`);
});

fs.mkdirSync(outDir, { recursive: true });

const written = [];
const missing = [];
const mismatched = [];
[...plan.entries()].sort((a, b) => a[0] - b[0]).forEach(([num, target]) => {
  const source = sources.get(num);
  if (!source) {
    missing.push(`item_${num} -> ${target}`);
    return;
  }
  const from = path.join(srcDir, source.file);
  const to = path.join(outDir, target);
  fs.copyFileSync(from, to);

  const buf = fs.readFileSync(to);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  if (width !== 150 || height !== 150 || colorType !== 6) {
    mismatched.push(`${target} -> ${width}x${height} colorType${colorType}`);
  }
  written.push({ num, target, label: source.label });
});

console.log(`源目录：${path.relative(root, srcDir)}`);
console.log(`输出目录：${path.relative(root, outDir)}`);
console.log(`\n计划导入 ${plan.size} 张，实际写入 ${written.length} 张`);

const byGroup = new Map();
written.forEach(({ target }) => {
  const group = target.includes("-warrior-") || target.includes("-mage-") || target.includes("-priest-")
    ? target.split("-").slice(0, 2).join("-")
    : target.split("-")[0];
  byGroup.set(group, (byGroup.get(group) || 0) + 1);
});
console.log("\n分组统计：");
[...byGroup.entries()].sort().forEach(([group, count]) => console.log(`  ${group.padEnd(18)} ${count} 张`));

if (missing.length) {
  console.log("\n缺失源文件：");
  missing.forEach((line) => console.log(`  ${line}`));
}
if (mismatched.length) {
  console.log("\n尺寸异常（应为 150x150 RGBA）：");
  mismatched.forEach((line) => console.log(`  ${line}`));
}
console.log(`\n未使用源素材 ${extras.length} 张（指环 / 腰带 / 饰品 / 裤子）：${extras.slice(0, 8).join("、")}${extras.length > 8 ? " 等" : ""}`);

const ok = !missing.length && !mismatched.length && written.length === plan.size;
console.log(ok ? "\n结论：全部导入成功" : "\n结论：存在问题，请检查上方输出");
process.exit(ok ? 0 : 1);
