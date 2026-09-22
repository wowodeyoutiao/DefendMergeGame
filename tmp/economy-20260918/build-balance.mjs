import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root = path.resolve(import.meta.dirname, '../..');
const outputDir = path.join(root, 'outputs/balance-20260921');
const previewDir = path.join(import.meta.dirname, 'previews-20260921');
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
const source = await fs.readFile(path.join(root, 'app.js'), 'utf8');
const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
const names = ['STAMINA_COST_PER_LEVEL', 'STARTING_STAMINA', 'MAX_STAMINA', 'STAMINA_OVERFLOW_LIMIT', 'STAMINA_REFILL_AMOUNT', 'STAMINA_PURCHASE_COST', 'STAMINA_REGEN_INTERVAL', 'SHOP_AD_DAILY_LIMIT', 'SHOP_AD_YUANBAO', 'SETTLEMENT_AD_EQUIPMENT_CHANCE', 'STAGE_CHEST_META', 'LEVEL_GOLD_REWARD', 'LEVEL_YUANBAO_REWARD', 'ARMY_REPORT_CONFIG', 'HERO_MAX_LEVEL', 'HERO_EXP_PER_STAMINA', 'HERO_EXP_TABLE', 'HERO_BREAKTHROUGH_COST', 'MAX_MERGE_HINTS', 'MAX_BOARD_SHUFFLES', 'EQUIPMENT_SLOTS', 'EQUIPMENT_QUALITY', 'EQUIPMENT_BASE_VALUES', 'COMBAT_RATING_CONFIG', 'COMBAT_POWER_CONFIG', 'BOSS_COMBAT_RATINGS', 'EQUIPMENT_BREAKTHROUGH_COSTS', 'EQUIPMENT_SYNTHESIS_COSTS', 'EQUIPMENT_SYNTHESIS_RATES', 'EQUIPMENT_SYNTHESIS_BONUS', 'EQUIPMENT_DROP_CHANCE', 'EQUIPMENT_DROP_PITY_MISSES', 'EQUIPMENT_DROP_TABLES', 'FORGE_CONFIG', 'FORGE_ECONOMY', 'FORGE_STAR_RATES', 'FORGE_ENHANCE_MASTER', 'FORGE_STAR_MASTER', 'DAILY_TASKS', 'HERO_SKILLS', 'MONSTER_PROFILES', 'CHAPTERS', 'BOSS_CONFIG', 'LEVEL_SCALING', 'LEVEL_CONTENT_COUNT', 'CARD_KILL_STEPS', 'MONSTER_MOVE_INTERVAL', 'ATTACK_INTERVAL_BY_TIER', 'ATTACK_RANGE_BY_TIER', 'AREA_RADIUS_BY_TIER', 'TYPES', 'state'];
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing function ${name}`);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const pureFunctions = ['getDayKey', 'getRoundsForLevel', 'getWaveProfile', 'getLevelHpScale', 'getForgeProgressionTier', 'getDailyTaskReward', 'getFullLevelReward', 'getFailureReward', 'getFullYuanbaoReward', 'getFailureYuanbaoReward', 'getFullForgeMaterialReward', 'getFailureForgeMaterialReward', 'forgeEnhanceCost', 'forgeStarCost', 'forgeStarRate', 'getHitChance', 'getCriticalChance'];
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('const boardEl =')) + '\n' + pureFunctions.map(functionSource).join('\n') + `\nvar snapshot = {${names.join(',')}};`, context, { timeout: 2000 });
const data = JSON.parse(JSON.stringify(context.snapshot));
const wb = Workbook.create();
wb.comments.setSelf({ displayName: 'User' });
const sheetNames = ['使用说明', '广告成长对照', '经济参数', '材料与任务', '商店与兑换', '装备品质', '装备掉落', '强化消耗', '升星消耗', '难度参数', '章节与怪物', '关卡总表', '波次预览', '战斗压力', '每日计划', '30天收支', '产销全景', '主角与技能', '问题与建议'];
const sheets = Object.fromEntries(sheetNames.map(name => [name, wb.worksheets.add(name)]));
const color = { ink: '#263B43', header: '#176E73', pale: '#EAF3F3', input: '#FFF4CE', blue: '#1757A6', formula: '#17623C', gray: '#67757D', alert: '#FFE0D9' };
const params = {};
const parameterRows = {};
const bounds = {};
function col(index) {
  let result = '';
  for (let value = index; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + (value - 1) % 26) + result;
  return result;
}
function set(name, address, value) {
  const cell = sheets[name].getRange(address);
  if (typeof value === 'string' && value.startsWith('=')) cell.formulas = [[value]];
  else cell.values = [[value]];
}
function block(name, startRow, rows, startCol = 1) {
  if (!rows.length) return;
  const width = Math.max(...rows.map(row => row.length));
  const padded = rows.map(row => Array.from({ length: width }, (_, index) => row[index] ?? null));
  sheets[name].getRange(`${col(startCol)}${startRow}:${col(startCol + width - 1)}${startRow + rows.length - 1}`).values = padded.map(row => row.map(value => typeof value === 'string' && value.startsWith('=') ? null : value));
  for (let column = 0; column < width; column++) {
    if (padded.every(row => typeof row[column] === 'string' && row[column].startsWith('='))) {
      sheets[name].getRange(`${col(startCol + column)}${startRow}:${col(startCol + column)}${startRow + rows.length - 1}`).formulas = padded.map(row => [row[column]]);
    } else if (padded.some(row => typeof row[column] === 'string' && row[column].startsWith('='))) {
      for (let row = 0; row < padded.length; row++) {
        const value = padded[row][column];
        if (typeof value === 'string' && value.startsWith('=')) set(name, `${col(startCol + column)}${startRow + row}`, value);
      }
    }
  }
}
function sourceAt(marker) {
  const offset = source.indexOf(marker);
  assert(offset >= 0, marker);
  return `app.js:${source.slice(0, offset).split('\n').length} · ${marker.replace(/^(const |function )/, '').slice(0, 58)}`;
}
function title(name, heading, subtitle, width, endRow) {
  const sheet = sheets[name];
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(6);
  const used = sheet.getRange(`A1:${col(width)}${endRow}`);
  used.format.font.color = color.ink;
  used.format.rowHeight = 23;
  used.format.columnWidth = 14;
  used.setNumberFormat('#,##0.00;[Red]-#,##0.00;"-"');
  const titleEnd = col(Math.min(width, 10));
  sheet.getRange(`A1:${titleEnd}2`).merge();
  set(name, 'A1', heading);
  sheet.getRange(`A1:${titleEnd}2`).format = { fill: color.header, font: { bold: true, color: '#FFFFFF' } };
  sheet.getRange(`A3:${titleEnd}3`).merge();
  set(name, 'A3', subtitle);
  sheet.getRange(`A3:${titleEnd}3`).format = { fill: color.pale, wrapText: true, rowHeight: 44 };
  bounds[name] = { width, endRow };
}
function header(name, row, labels) {
  block(name, row, [labels]);
  sheets[name].getRange(`A${row}:${col(labels.length)}${row}`).format = { fill: color.header, font: { bold: true, color: '#FFFFFF' }, wrapText: true, rowHeight: 36 };
}
function input(name, range, min = 0, max = 1000000000, integer = false) {
  const target = sheets[name].getRange(range);
  target.format.fill = color.input;
  target.format.font.color = color.blue;
  target.dataValidation = { rule: { type: integer ? 'whole' : 'decimal', operator: 'between', formula1: min, formula2: max } };
}
function formats(name, addresses, format) { for (const address of addresses) sheets[name].getRange(address).setNumberFormat(format); }
function widths(name, sizes) { sizes.forEach((size, index) => { sheets[name].getRange(`${col(index + 1)}1:${col(index + 1)}${bounds[name].endRow}`).format.columnWidth = size; }); }
function note(name, cell, text) { wb.comments.addThread({ cell: sheets[name].getRange(cell) }, text); }
function ref(key, current = false) { assert(params[key], key); return params[key].replace('$E$', current ? '$C$' : '$E$'); }
function addParams(name, definitions, heading, subtitle) {
  title(name, heading, subtitle, 8, definitions.length + 6);
  header(name, 6, ['参数标识', '参数名称', '工程当前值', '调优试算值', '本次采用值', '单位', '代码来源', '口径与建议']);
  const rows = definitions.map(([key, label, value, candidate, unit, marker, explanation], index) => {
    const row = index + 7;
    params[key] = `'${name}'!$E$${row}`;
    parameterRows[key] = { name, row };
    return [key, label, value, candidate ?? value, `=IF('使用说明'!$B$4=0,C${row},D${row})`, unit, marker ? sourceAt(marker) : '试算假设（非工程配置）', explanation];
  });
  block(name, 7, rows);
  input(name, `D7:D${definitions.length + 6}`);
  sheets[name].getRange(`C7:C${definitions.length + 6}`).format.font.color = color.gray;
  sheets[name].getRange(`E7:E${definitions.length + 6}`).format.font.color = color.formula;
  sheets[name].getRange(`B7:H${definitions.length + 6}`).format.wrapText = true;
  sheets[name].getRange(`A7:H${definitions.length + 6}`).format.rowHeight = 44;
  widths(name, [29, 26, 16, 16, 16, 13, 49, 58]);
  definitions.forEach((definition, index) => {
    if (definition[4] === '概率' || definition[4] === '比例') {
      formats(name, [`C${index + 7}:E${index + 7}`], '0.0%');
      input(name, `D${index + 7}`, 0, 1);
    }
  });
}

title('使用说明', '合战守格｜产销与关卡调优工作簿', '以当前真实工程为基线；黄色蓝字可改，绿色为联动公式，灰字为工程快照。所有试算均不自动写回游戏。', 10, 40);
block('使用说明', 4, [['配置模式', 0, '0＝当前工程；1＝调优试算。切换后全表重算。'], ['检查关卡', 1, '波次预览、任务奖励、战斗压力使用此关卡，支持1～900。']]);
input('使用说明', 'B4', 0, 1, true);
input('使用说明', 'B5', 1, data.LEVEL_CONTENT_COUNT, true);
formats('使用说明', ['B4:B5'], '0');
sheets['使用说明'].getRange('C4:J4').merge();
sheets['使用说明'].getRange('C5:J5').merge();
widths('使用说明', [25, 19, 18, 18, 18, 18, 18, 18, 18, 18]);

const eco = [
  ['staminaStart', '新玩家初始体力', data.STARTING_STAMINA, null, '点', 'const STARTING_STAMINA', '仅新档一次发放'],
  ['staminaDisplay', '体力显示满值', data.MAX_STAMINA, null, '点', 'const MAX_STAMINA', '实际恢复上限另见下一行'],
  ['staminaCap', '实际体力累积上限', data.STAMINA_OVERFLOW_LIMIT, null, '点', 'function refreshStamina', '当前自然恢复也可累积至500，不在60停下'],
  ['staminaMinutes', '恢复1点需要时间', data.STAMINA_REGEN_INTERVAL / 60000, 18, '分钟', 'const STAMINA_REGEN_INTERVAL', '维持已确认的18分钟恢复1点；主要通过广告补给与挑战模式延长日活'],
  ['staminaCost', '主线每局消耗', data.STAMINA_COST_PER_LEVEL, null, '点', 'const STAMINA_COST_PER_LEVEL', '开局扣除；输赢均消耗；复活不再扣'],
  ['staminaRefill', '单次补给增加体力', data.STAMINA_REFILL_AMOUNT, null, '点', 'const STAMINA_REFILL_AMOUNT', '增加60，不是把当前值设置成60；总量不超过上限'],
  ['staminaPrice', '元宝补给体力价格', data.STAMINA_PURCHASE_COST, null, '元宝/次', 'const STAMINA_PURCHASE_COST', '每天限1次'],
  ['staminaBuyLimit', '元宝补给日限次', 1, null, '次/天', 'function refillStamina', '每天自然日重置'],
  ['staminaAdLimit', '广告补给日限次', 1, null, '次/天', 'function refillStamina', '当前没有先购买再看广告的校验'],
  ['goldStart', '初始金币', data.state.gold, null, '金币', 'const state =', '新档默认值；旧档持有不在此表内'],
  ['yuanStart', '初始元宝', data.state.yuanbao, null, '元宝', 'const state =', '新档默认值'],
  ['enhStart', '初始强化石', data.FORGE_ECONOMY.startingEnhanceStone, null, '个', 'const FORGE_ECONOMY', '新档默认值'],
  ['starStart', '初始升星石', data.FORGE_ECONOMY.startingStarStone, null, '个', 'const FORGE_ECONOMY', '新档默认值'],
  ['goldBase', '胜利金币常数', data.LEVEL_GOLD_REWARD.base, null, '金币', 'const LEVEL_GOLD_REWARD', '金币=常数+关卡×斜率；不含击杀/棋盘铜钱'],
  ['goldSlope', '胜利金币关卡斜率', data.LEVEL_GOLD_REWARD.step, null, '金币/关', 'const LEVEL_GOLD_REWARD', '后期增长通过打造与合成消耗承接'],
  ['yuanBase', '胜利元宝常数', data.LEVEL_YUANBAO_REWARD.enabled ? data.LEVEL_YUANBAO_REWARD.base : 0, null, '元宝', 'const LEVEL_YUANBAO_REWARD', '当前关闭，元宝来自首通宝箱、日常、军报与广告'],
  ['yuanSlope', '胜利元宝关卡斜率', data.LEVEL_YUANBAO_REWARD.enabled ? data.LEVEL_YUANBAO_REWARD.step : 0, null, '元宝/关', 'const LEVEL_YUANBAO_REWARD', '当前关闭，避免重复刷关产出元宝'],
  ['yuanCap', '胜利元宝上限', 1000000000, 40, '元宝/局', 'function getFullYuanbaoReward', '当前无上限，以大数表示；候选40'],
  ['failureFactor', '失败结算波次系数', 0.6, null, '比例', 'function getFailureReward', 'floor(满额×到达波次/总波次×此系数)；不是已完成波数'],
  ['doubleFactor', '广告结算总倍率', 2, null, '倍', 'function showVictory', '金币、两类材料和主角经验补足至2倍；首通宝箱不翻倍'],
  ['adEquipmentChance', '结算广告额外装备概率', data.SETTLEMENT_AD_EQUIPMENT_CHANCE, null, '概率', 'const SETTLEMENT_AD_EQUIPMENT_CHANCE', '独立于关卡掉落与保底，每个胜利结算最多抽取一次'],
  ['loginGold', '每日登录金币', 50, null, '金币/天', 'function claimDailyLogin', '手动领取一次'],
  ['taskPlayGold', '完成一局任务金币', 80, null, '金币', 'function getDailyTaskReward', '每日一次'],
  ['taskClearGold', '消除30任务金币', 120, null, '金币', 'function getDailyTaskReward', '每日一次'],
  ['taskKillYuan', '击败20任务元宝', 10, null, '元宝', 'function getDailyTaskReward', '每日一次'],
  ['taskBeastGold', '参加军报任务金币', 150, null, '金币', 'function getDailyTaskReward', '参与即可；需遇到军报'],
  ['taskBeastYuan', '参加军报任务元宝', 20, null, '元宝', 'function getDailyTaskReward', '每日一次'],
  ['taskEnhGold', '强化一次任务金币', 80, null, '金币', 'function getDailyTaskReward', '还返还材料；每日一次'],
  ['taskStarGold', '升星一次任务金币', 80, null, '金币', 'function getDailyTaskReward', '每日一次；失败尝试也推进任务'],
  ['adYuan', '商店每次广告元宝', data.SHOP_AD_YUANBAO, null, '元宝/次', 'const SHOP_AD_YUANBAO', '纯IAA模拟广告'],
  ['adYuanLimit', '商店广告日限次', data.SHOP_AD_DAILY_LIMIT, null, '次/天', 'const SHOP_AD_DAILY_LIMIT', '与体力/局内广告各自计数'],
  ...data.STAGE_CHEST_META.map((entry, index) => [`chest${index}`, `${entry.label}宝箱`, entry.amount, null, '元宝/关', 'const STAGE_CHEST_META', `${entry.condition}；每关每档只领一次；三档可叠加，不属于重复通关奖励`]),
  ['coin3', '铜钱3连消金币', 50, null, '金币', 'function eliminateMatches', '持久货币；与局内宝箱棋子不同'],
  ['coin4', '铜钱4连消金币', 120, null, '金币', 'function eliminateMatches', '每次消除簇独立计算'],
  ['coin5', '铜钱5连消金币', 280, null, '金币', 'function eliminateMatches', '每次消除簇独立计算'],
  ['coin6', '铜钱6连及以上金币', 680, null, '金币', 'function eliminateMatches', '数量封顶6档'],
  ['sellBase', '白装出售基础金币', 10, null, '金币/件', 'function equipmentSalePrice', 'round(10×品质系数)，批量回收同价'],
  ['dropChance', '主线装备基础掉率', data.EQUIPMENT_DROP_CHANCE, null, '概率', 'const EQUIPMENT_DROP_CHANCE', '仅胜利触发；一次最多1件'],
  ['dropPity', '连续未掉落保底阈值', data.EQUIPMENT_DROP_PITY_MISSES, null, '次', 'const EQUIPMENT_DROP_PITY_MISSES', '连续3次未掉落后第4次必出；失败局不计掉落抽样'],
  ['synthCount', '合成材料装备数', 5, null, '件/次', 'function getSynthesisQuote', '同品质，成功得高一级随机部位；失败全部损失'],
  ['synthBonusOn', '合成额外奖励开关', Number(data.EQUIPMENT_SYNTHESIS_BONUS.enabled), null, '0/1', 'const EQUIPMENT_SYNTHESIS_BONUS', '当前关闭；不得当作收入'],
  ['synthBonusChance', '合成额外金币几率', data.EQUIPMENT_SYNTHESIS_BONUS.chance, null, '概率', 'const EQUIPMENT_SYNTHESIS_BONUS', '仅成功且开关开启'],
  ['synthBonusFactor', '额外金币售价倍率', data.EQUIPMENT_SYNTHESIS_BONUS.salePriceMultiplier, null, '倍', 'const EQUIPMENT_SYNTHESIS_BONUS', '按产物品质售价计算'],
  ['enhGoldBase', '强化首级金币', data.FORGE_CONFIG.enhanceGoldBase, null, '金币', 'const FORGE_CONFIG', '阶梯倍率另乘'],
  ['enhGoldStep', '强化每级金币增加', data.FORGE_CONFIG.enhanceGoldStep, null, '金币', 'const FORGE_CONFIG', 'ceil((首级+当前级×增量)×阶梯倍率)'],
  ['starGoldBase', '升星首星金币', data.FORGE_CONFIG.starGoldBase, null, '金币', 'const FORGE_CONFIG', '无论成功或失败都扣'],
  ['starGoldStep', '升星每星金币增加', data.FORGE_CONFIG.starGoldStep, null, '金币', 'const FORGE_CONFIG', 'ceil((首星+当前星×增量)×阶梯倍率)'],
  ['enhValueRate', '每强化级基础属性增幅', data.FORGE_CONFIG.enhanceValueRate, null, '比例', 'const FORGE_CONFIG', '按部位白装基础值×品质系数×强化级数×增幅后round'],
  ['starValueRate', '每星基础属性增幅', data.FORGE_CONFIG.starValueRate, null, '比例', 'const FORGE_CONFIG', '当前无失败降星'],
  ['heroBreakBase', '主角首次突破元宝', data.HERO_BREAKTHROUGH_COST, null, '元宝', 'function getHeroBreakthroughCost', '开放后续等级区间；不负责技能解锁'],
  ['heroBreakStep', '后续每阶突破增量', 100, null, '元宝', 'function getHeroBreakthroughCost', 'cost=150+已突破阶数×100'],
  ['heroExpRate', '体力转经验系数', data.HERO_EXP_PER_STAMINA, null, '经验/体力/等级', 'function heroExpPerStage', '当前胜利经验=10×100×结算时主角等级；失败不发'],
  ['raidCheck', '军报侦查间隔', data.ARMY_REPORT_CONFIG.checkIntervalMs / 60000, null, '分钟', 'const ARMY_REPORT_CONFIG', '仅在线计时；有军报/在军报战局时影响抽样'],
  ['raidChance', '军报触发概率', data.ARMY_REPORT_CONFIG.triggerChance, null, '概率', 'const ARMY_REPORT_CONFIG', '非每次上线保证触发'],
  ['raidPity', '军报未发现保底阈值', data.ARMY_REPORT_CONFIG.pityMissRequired, null, '次', 'const ARMY_REPORT_CONFIG', '连续3次未发现后下一次必出'],
  ['raidPityLimit', '军报日保底次数', data.ARMY_REPORT_CONFIG.pityDailyLimit, null, '次/天', 'const ARMY_REPORT_CONFIG', '并非军报总次数上限'],
  ['raidStay', '军报存在时长', data.ARMY_REPORT_CONFIG.stayMs / 60000, null, '分钟', 'const ARMY_REPORT_CONFIG', '过期不可挑战'],
  ['raidGoldMin', '军报最低金币倍数', data.ARMY_REPORT_CONFIG.goldMultiplierMin, null, '倍', 'function getBeastGoldRange', '失败给最低；金币基数沿用主线采用值'],
  ['raidGoldMax', '军报最高金币倍数', data.ARMY_REPORT_CONFIG.goldMultiplierMax, null, '倍', 'function getBeastGoldRange', '胜利区间均匀随机'],
  ['raidYuanMin', '军报最低元宝', data.ARMY_REPORT_CONFIG.yuanbaoMin, 20, '元宝', 'function rollBeastRaidReward', '失败也给最低'],
  ['raidYuanMax', '军报最高元宝', data.ARMY_REPORT_CONFIG.yuanbaoMax, 80, '元宝', 'function rollBeastRaidReward', '胜利区间均匀随机'],
  ['raidQualityMin', '军报品质最低加档', data.ARMY_REPORT_CONFIG.qualityBonusMin, 0, '品质档', 'function settleBeastRaid', '以主线掉落表有概率的最高品质为基准，封顶金色'],
  ['raidQualityMax', '军报品质最高加档', data.ARMY_REPORT_CONFIG.qualityBonusMax, 1, '品质档', 'function settleBeastRaid', '当前1关即可能出紫/橙；候选减少跨档'],
  ['raidEnhChance', '军报强化石掉率', data.ARMY_REPORT_CONFIG.enhanceChance, null, '概率', 'function rollBeastRaidReward', '仅胜利，独立抽样'],
  ['raidStarChance', '军报升星石掉率', data.ARMY_REPORT_CONFIG.starChance, null, '概率', 'function rollBeastRaidReward', '仅胜利，独立抽样'],
  ['raidStoneFactor', '军报材料数量倍数', data.ARMY_REPORT_CONFIG.stoneMultiplier, null, '倍', 'function rollBeastRaidReward', 'max(1,round(同关主线材料×倍数))'],
  ['hintLimit', '提示广告局上限', data.MAX_MERGE_HINTS, null, '次/局', 'const MAX_MERGE_HINTS', '观看完成才生效'],
  ['shuffleLimit', '洗牌广告局上限', data.MAX_BOARD_SHUFFLES, null, '次/局', 'const MAX_BOARD_SHUFFLES', '不消耗步数，棋子种类与等级保留'],
  ['adStepGain', '加步广告每次步数', 3, null, '步', 'placement: "额外步数"', '当前无每局总次数上限，只有当前步数低于11才能点'],
];
addParams('经济参数', eco, '01｜经济基础参数', 'C列为工程快照；D列为可调整方案；E列受“使用说明”B4控制。候选值是待验证方案，不等于已上线配置。');

const materialDefs = [];
let previousMin = 1;
data.FORGE_ECONOMY.progressionTiers.forEach((tier, index) => {
  materialDefs.push([`matMin${index}`, `${tier.name}起始关卡`, previousMin, null, '关', 'const FORGE_ECONOMY', '必须严格递增；末档开放至无限关']);
  for (const [suffix, label, value] of [['enh', '胜利强化石', tier.levelEnhance], ['star', '胜利升星石', tier.levelStar], ['play', '完成一局强化石', tier.dailyEnhance[0]], ['clear', '消除任务强化石', tier.dailyEnhance[1]], ['kill', '击杀任务升星石', tier.dailyStar]]) materialDefs.push([`mat${suffix}${index}`, `${tier.name}·${label}`, value, null, '个', 'const FORGE_ECONOMY', '关卡结算按本关；日常任务按最高解锁关卡取档']);
  previousMin = tier.maxLevel + 1;
});
addParams('材料与任务', materialDefs, '02｜材料投放与每日任务档位', '前两天并非按注册时间判定，当前是1～14关新手档。新增强化/升星任务返材已包含在每日模拟中。');
function tierFormula(level, suffix) {
  let result = ref(`mat${suffix}0`);
  for (let index = 1; index < 5; index++) result = `IF(${level}>=${ref(`matMin${index}`)},${ref(`mat${suffix}${index}`)},${result})`;
  return result;
}

const shopDefs = [];
for (const [kind, label, amount, price, candidateAmount, candidatePrice] of [
  ['shopEnh', '商店强化石兑换', 20, 10, 20, 10], ['shopStar', '商店升星石兑换', 2, 10, 2, 10], ['shopGold', '商店金币兑换', 500, 1, 500, 1],
  ['forgeEnh', '打造弹窗强化石兑换', data.FORGE_ECONOMY.exchangeOffers.enhance.amount, data.FORGE_ECONOMY.exchangeOffers.enhance.price, data.FORGE_ECONOMY.exchangeOffers.enhance.amount, data.FORGE_ECONOMY.exchangeOffers.enhance.price], ['forgeStar', '打造弹窗升星石兑换', data.FORGE_ECONOMY.exchangeOffers.star.amount, data.FORGE_ECONOMY.exchangeOffers.star.price, data.FORGE_ECONOMY.exchangeOffers.star.amount, data.FORGE_ECONOMY.exchangeOffers.star.price],
]) {
  const marker = kind.startsWith('shop') ? 'function showShop' : 'const FORGE_ECONOMY';
  shopDefs.push([`${kind}Amount`, `${label}数量`, amount, candidateAmount, kind.endsWith('Gold') ? '金币' : '个', marker, '统一单价；商店其余档位按此比例倍增，无次数限制']);
  shopDefs.push([`${kind}Price`, `${label}元宝`, price, candidatePrice, '元宝', marker, '与其他入口保持一致；候选同时校准两处入口']);
}
addParams('商店与兑换', shopDefs, '03｜商店与材料兑换', '现有商店12个商品按固定汇率等比例扩包；打造缺料弹窗有另一套汇率。下方同时列出全部商品与两处入口差异。');
header('商店与兑换', 20, ['入口', '道具', '档位倍数', '采用数量', '元宝消耗', '每元宝获得', '当前配置原价', '说明']);
const offers = [];
for (const [key, label, factors] of [['shopEnh', '强化石', [1, 5, 20, 50]], ['shopStar', '升星石', [1, 5, 20, 50]], ['shopGold', '金币', [1, 10, 50, 100]], ['forgeEnh', '强化石', [1]], ['forgeStar', '升星石', [1]]]) {
  for (const factor of factors) {
    const row = 21 + offers.length;
    offers.push([key.startsWith('shop') ? '边塞商店' : '打造缺料弹窗', label, factor, `=${ref(`${key}Amount`)}*C${row}`, `=${ref(`${key}Price`)}*C${row}`, `=IFERROR(D${row}/E${row},0)`, `=${ref(`${key}Price`, true)}*C${row}`, '无限次；元宝足够即可兑换']);
  }
}
block('商店与兑换', 21, offers);
bounds['商店与兑换'].endRow = 34;

const qualityDefs = [];
data.EQUIPMENT_QUALITY.forEach((quality, index) => {
  qualityDefs.push([`qcoef${index + 1}`, `${quality.name}·${quality.prefix}系数`, quality.coefficient, null, '倍', 'const EQUIPMENT_QUALITY', '基础装备各项属性均按此系数round']);
  if (index < 6) {
    qualityDefs.push([`qsynthGold${index + 1}`, `${quality.name}5合1金币`, data.EQUIPMENT_SYNTHESIS_COSTS[index], null, '金币/次', 'const EQUIPMENT_SYNTHESIS_COSTS', '成功或失败均扣除']);
    qualityDefs.push([`qsynthRate${index + 1}`, `${quality.name}5合1成功率`, data.EQUIPMENT_SYNTHESIS_RATES[index], null, '概率', 'const EQUIPMENT_SYNTHESIS_RATES', '成功产出高一级随机部位']);
    qualityDefs.push([`qbreak${index + 1}`, `${quality.name}满套突破`, data.EQUIPMENT_BREAKTHROUGH_COSTS[index], null, '元宝', 'const EQUIPMENT_BREAKTHROUGH_COSTS', '六件同品质已穿戴装备扣除，装备基础属性永久保留']);
  }
});
addParams('装备品质', qualityDefs, '04｜装备品质、合成与突破', '三名武将共18部位；装备出售=round(10×品质系数)。全套突破只吸收装备基础属性，强化/升星仍保留在原槽位。');
const qStart = qualityDefs.length + 10;
header('装备品质', qStart, ['品质', '名称前缀', '采用系数', '单件售价', '合成金币/次', '合成成功率', '每件高阶预期材料', '只合成获得本品质的白装等价']);
for (let quality = 1; quality <= 7; quality++) {
  const row = qStart + quality;
  block('装备品质', row, [[quality, data.EQUIPMENT_QUALITY[quality - 1].prefix, `=${ref(`qcoef${quality}`)}`, `=ROUND(${ref('sellBase')}*C${row},0)`, quality < 7 ? `=${ref(`qsynthGold${quality}`)}` : '最高品质', quality < 7 ? `=${ref(`qsynthRate${quality}`)}` : 0, quality < 7 ? `=IFERROR(${ref('synthCount')}/F${row},0)` : 0, quality === 1 ? 1 : `=H${row - 1}*G${row - 1}`]]);
}
bounds['装备品质'].endRow = qStart + 7;

title('装备掉落', '05｜装备掉落概率与保底', '每个区间的7档概率必须合计100%。蓝字方案生效需要选择模式1。部位均匀随机，保底只保掉落，不保部位/品质。', 10, 50);
header('装备掉落', 6, ['起始关卡', '白色', '绿色', '蓝色', '紫色', '橙色', '红色', '金色', '合计', '状态']);
const candidateWeights = [[0.92, 0.08, 0, 0, 0, 0, 0], [0.8, 0.16, 0.04, 0, 0, 0, 0], [0.68, 0.22, 0.09, 0.01, 0, 0, 0], [0.56, 0.26, 0.14, 0.035, 0.005, 0, 0], [0.46, 0.29, 0.17, 0.065, 0.014, 0.001, 0], [0.33, 0.31, 0.22, 0.11, 0.026, 0.0038, 0.0002]];
for (let index = 0; index < 6; index++) {
  const row = 7 + index;
  block('装备掉落', row, [[data.EQUIPMENT_DROP_TABLES[index].minLevel, ...data.EQUIPMENT_DROP_TABLES[index].weights, `=SUM(B${row}:H${row})`, `=IF(ABS(I${row}-1)<0.000001,"正常","概率异常")`]]);
  const candidateRow = 18 + index;
  block('装备掉落', candidateRow, [[data.EQUIPMENT_DROP_TABLES[index].minLevel, ...candidateWeights[index], `=SUM(B${candidateRow}:H${candidateRow})`, `=IF(ABS(I${candidateRow}-1)<0.000001,"正常","概率异常")`]]);
  const activeRow = 29 + index;
  block('装备掉落', activeRow, [Array.from({ length: 8 }, (_, column) => `=IF('使用说明'!$B$4=0,${col(column + 1)}${row},${col(column + 1)}${candidateRow})`).concat([`=SUM(B${activeRow}:H${activeRow})`, `=IF(ABS(I${activeRow}-1)<0.000001,"正常","概率异常")`])]);
}
header('装备掉落', 17, ['试算起始关', '白色', '绿色', '蓝色', '紫色', '橙色', '红色', '金色', '合计', '状态']);
header('装备掉落', 28, ['采用起始关', '白色', '绿色', '蓝色', '紫色', '橙色', '红色', '金色', '合计', '状态']);
input('装备掉落', 'A18:A23', 1, 900, true);
input('装备掉落', 'B18:H23', 0, 1);
formats('装备掉落', ['B7:I12', 'B18:I23', 'B29:I34'], '0.00%');
block('装备掉落', 38, [['长期每胜预期掉落', `=IF(${ref('dropChance')}=0,1/(${ref('dropPity')}+1),${ref('dropChance')}/(1-(1-${ref('dropChance')})^(${ref('dropPity')}+1)))`, '稳态含保底；前几局与此期望有偏差'], ['集齐1人6部位期望件数', '=6*(1+1/2+1/3+1/4+1/5+1/6)', '同品质独立均匀抽样：14.7件；未含合成/军报'], ['试算关金装概率', "=VLOOKUP('使用说明'!$B$5,A29:H34,8,TRUE)", '条件概率：已经掉落装备时'], ['每件金装预期胜局', '=IF(B40=0,0,1/(B38*B40))', '0表示该区间不投放金装；不含军报/合成'], ['半年追求目标', 180, '目标天数，不是本表可保证的玩家留存率']]);
widths('装备掉落', [24, 19, 23, 14, 14, 14, 14, 14, 14, 18]);

function forgeTable(name, kind, maxLevel) {
  const tiers = data.FORGE_ECONOMY[kind === 'enh' ? 'enhanceCostTiers' : 'starCostTiers'];
  title(name, `${kind === 'enh' ? '06｜强化' : '07｜升星'}消耗明细`, kind === 'enh' ? '目标等级=当前等级+1；强化必成。列出+1～+300。实际强化上限为max(主角等级,最高解锁关卡)×2，可能超过300。' : '按现行数组逐星读取：21星仍为25%、26星仍为20%。候选修正边界。失败扣材料和金币但不降星。预期成本=每次成本/成功率。', 12, maxLevel + 19);
  header(name, 6, ['目标起始级', '当前石头', '当前金币倍率', '试算石头', '试算金币倍率', '采用石头', '采用金币倍率']);
  let startLevel = 1;
  tiers.forEach((tier, index) => {
    const row = index + 7;
    block(name, row, [[startLevel, tier.stone, tier.goldMultiplier, tier.stone, tier.goldMultiplier, `=IF('使用说明'!$B$4=0,B${row},D${row})`, `=IF('使用说明'!$B$4=0,C${row},E${row})`]]);
    startLevel = tier.maxLevel + 1;
  });
  input(name, 'D7:E13', 0, 1000);
  header(name, 18, ['目标等级', '材料/次', '金币/次', '当前成功率', '试算成功率', '采用成功率', '材料期望/级', '金币期望/级', '累计材料/槽', '累计金币/槽', '18槽累计材料', '18槽累计金币']);
  for (let level = 1; level <= maxLevel; level++) {
    const row = level + 18;
    const rate = kind === 'enh' ? 1 : data.FORGE_STAR_RATES[level - 1];
    const candidate = kind === 'enh' ? 1 : level <= 10 ? rate : level <= 20 ? 0.25 : level <= 25 ? 0.2 : 0.1;
    block(name, row, [[level, `=VLOOKUP(A${row},$A$7:$G$13,6,TRUE)`, `=ROUNDUP((${ref(kind === 'enh' ? 'enhGoldBase' : 'starGoldBase')}+(A${row}-1)*${ref(kind === 'enh' ? 'enhGoldStep' : 'starGoldStep')})*VLOOKUP(A${row},$A$7:$G$13,7,TRUE),0)`, rate, candidate, `=IF('使用说明'!$B$4=0,D${row},E${row})`, `=IFERROR(B${row}/F${row},0)`, `=IFERROR(C${row}/F${row},0)`, `=SUM(G$19:G${row})`, `=SUM(H$19:H${row})`, `=I${row}*18`, `=J${row}*18`]]);
  }
  if (kind === 'star') input(name, `E19:E${maxLevel + 18}`, 0.01, 1);
  formats(name, [`D19:F${maxLevel + 18}`], '0.0%');
  widths(name, [15, 14, 16, 17, 17, 17, 19, 20, 20, 21, 22, 23]);
}
forgeTable('强化消耗', 'enh', 300);
forgeTable('升星消耗', 'star', 30);

const diff = [
  ['minWaves', '主线最低波数', 3, null, '波', 'function getRoundsForLevel', '1～3关三波；4/5/6关分别4/5/6波'],
  ['maxWaves', '主线最高波数', 7, null, '波', 'function getRoundsForLevel', '7关及以后七波'],
  ['countBase', '每波怪物数常数', 5, null, '只', 'function startWave', '包括最终Boss占位'],
  ['countWave', '每增1波增加怪物', 2, null, '只/波', 'function startWave', '总数=常数+波次项+ceil(关卡项)'],
  ['countLevel', '每关怪物数量斜率', 1.15, 0.12, '只/关', 'function startWave', '当前到900关每波超过千只'],
  ['countCap', '单波怪物数量上限', 1000000000, 18, '只', 'function startWave', '当前无上限，以大数表示；试算18，Boss替代末只'],
  ['hpBase', '怪物基础血量常数', data.LEVEL_SCALING.hpBase, null, 'HP', 'const LEVEL_SCALING', '单怪HP=基数×关卡^幂次×后期封顶倍率×波次形状'],
  ['hpLevel', '基础血量关卡斜率', 0, null, 'HP/关', null, '真实工程已改用单怪血量幂次，保留字段用于兼容旧表'],
  ['hpWave', '基础血量波次斜率', 0, null, 'HP/波', null, '真实工程已改用波次形状，保留字段用于兼容旧表'],
  ['hpMultiplier', '整体怪物生命倍率', 1, null, '倍', null, '真实工程已改用后期封顶倍率，保留字段用于兼容旧表'],
  ['difficultySlope', '关卡额外难度斜率', 0, null, '每关系数', null, '真实工程已改用后期血量逐关增幅，保留字段用于兼容旧表'],
  ['monsterTotalBase', '每关总怪物数基数', data.LEVEL_SCALING.monsterTotalBase, null, '只', 'const LEVEL_SCALING', '主线总怪数=基数×关卡^幂次，再按波次形状分摊'],
  ['monsterTotalPower', '总怪物数幂次', data.LEVEL_SCALING.monsterTotalPower, null, '幂次', 'const LEVEL_SCALING', '控制后期出怪数量，不与单怪血量重复线性膨胀'],
  ['levelHpPower', '单怪血量幂次', data.LEVEL_SCALING.hpPower, null, '幂次', 'const LEVEL_SCALING', '普通玩家养成可追赶；不再沿用旧线性公式'],
  ['lateHpStart', '后期血量起始关', data.LEVEL_SCALING.lateHpStart, null, '关', 'const LEVEL_SCALING', '1～20关保持新手体验'],
  ['lateHpPerLevel', '后期血量逐关增幅', data.LEVEL_SCALING.lateHpPerLevel, null, '比例/关', 'const LEVEL_SCALING', '21关后增加，配合封顶倍率'],
  ['lateHpCap', '后期血量倍率上限', data.LEVEL_SCALING.lateHpCap, null, '倍', 'const LEVEL_SCALING', '防止高关无限膨胀'],
  ['spawnSeconds', '出怪配置间隔', 0.72, null, '秒', 'function startWave', '100ms逻辑步长使1倍速实际约0.8秒'],
  ['moveSeconds', '移动配置间隔', data.MONSTER_MOVE_INTERVAL, null, '秒', 'const MONSTER_MOVE_INTERVAL', '100ms逻辑步长使1倍速实际约1.3秒'],
  ['tickSeconds', '逻辑更新间隔', 0.1, null, '秒', 'function runLoop', 'tick后计时器归零，间隔向上量化'],
  ['gameSpeed', '预览战斗倍速', 1, null, '倍', 'function runLoop', '支持1倍/2倍；时间预估含实际量化'],
  ['bossSpawnFactor', '实际Boss额外血量倍数', 4, 5, '倍', 'const maxHp = Math.round', '还需乘brute的1.7；当前不是BOSS_CONFIG.hpMultiplier'],
  ['bossUnusedFactor', '未引用Boss配置倍率', data.BOSS_CONFIG.hpMultiplier, null, '倍', 'const BOSS_CONFIG', '仅审计展示：当前spawnMonster未使用它，不参与试算'],
  ['bossGold', 'Boss击杀金币', data.BOSS_CONFIG.reward, 30, '金币', 'const BOSS_CONFIG', '最后一波最后一只，主线每局1只'],
  ['bossSkill', 'Boss狂暴CD', data.BOSS_CONFIG.skillInterval, null, '秒', 'const BOSS_CONFIG', '每7秒直接伤害防线，并加速场上怪物'],
  ['bossEnrageSeconds', '狂暴持续时间', data.BOSS_CONFIG.enrageDuration, null, '秒', 'const BOSS_CONFIG', '与漏怪伤害是两个来源'],
  ['bossEnrageSpeed', '狂暴移动倍率', data.BOSS_CONFIG.enrageSpeed, null, '倍', 'const BOSS_CONFIG', '全场怪物生效'],
  ['bossDefenseHit', '狂暴防线伤害', data.BOSS_CONFIG.defenseHit, null, 'HP/次', 'const BOSS_CONFIG', 'Boss仍在场即可触发，不必走出棋盘'],
  ['bossDodge', 'Boss闪避值', data.BOSS_COMBAT_RATINGS.dodge, null, '固定值', 'const BOSS_COMBAT_RATINGS', '当前与其他怪同为100'],
  ['bossResilience', 'Boss韧性值', data.BOSS_COMBAT_RATINGS.resilience, null, '固定值', 'const BOSS_COMBAT_RATINGS', '当前为0'],
  ['raidWaves', '军报波数', data.ARMY_REPORT_CONFIG.waves, null, '波', 'const ARMY_REPORT_CONFIG', '当前10波'],
  ['raidBossEvery', '军报Boss波间隔', data.ARMY_REPORT_CONFIG.bossEveryWaves, null, '波', 'const ARMY_REPORT_CONFIG', '第5/10波Boss'],
  ['raidCountBase', '军报怪物数常数', 6, null, '只', 'function startWave', '其他数量项与主线相同'],
  ['raidDifficulty', '军报血量难度倍率', data.ARMY_REPORT_CONFIG.difficultyMultiplier, null, '倍', 'const ARMY_REPORT_CONFIG', '血量放大，非怪物数倍率'],
  ['spawnY', '怪物初始纵坐标', -5.45, null, '格', 'function spawnMonster', '走出棋盘y≥6才漏怪；Boss技能伤害另算'],
  ['leakY', '防线边界纵坐标', 6, null, '格', 'const BOARD_SIZE', '最后一排中心y=5'],
  ['hitBase', '武将基础命中值', data.COMBAT_RATING_CONFIG.baseHit, null, '固定值', 'const COMBAT_RATING_CONFIG', '命中>=闪避时100%命中；否则命中/闪避'],
  ['critBase', '武将基础暴击值', data.COMBAT_RATING_CONFIG.baseCrit, null, '固定值', 'const COMBAT_RATING_CONFIG', '不是暴击概率'],
  ['critK', '暴击差值系数K', data.COMBAT_RATING_CONFIG.criticalCoefficient, null, '系数', 'const COMBAT_RATING_CONFIG', '概率=(max(0,暴击-韧性)×K+4)/100；系数并非0.5%'],
  ['critFlat', '固定暴击参数', data.COMBAT_RATING_CONFIG.criticalFlatPercent, null, '百分数值', 'const COMBAT_RATING_CONFIG', '4表示4%，不是0.04'],
  ['critDamage', '暴击伤害倍数', data.COMBAT_RATING_CONFIG.criticalDamageMultiplier, null, '倍', 'const COMBAT_RATING_CONFIG', '默认1.5倍'],
  ['mergeAttackFactor', '棋子升级攻击倍数', 1.8, null, '倍/级', 'function attackMonsters', '装备攻击是相加项，不再乘1.8的局内等级项'],
  ['prepSeconds', '每波操作期耗时假设', 6, null, '秒/波', '', '玩家行为假设；不包含广告/选卡停顿，可调'],
  ['tailSeconds', '每波尾怪清理耗时假设', 4, null, '秒/波', '', '估计，不能当成实测战斗时长'],
  ['targetMinutes', '目标主线单局时长', 3, null, '分钟', '', '延续用户提出的目标，出怪下限超出则必须调整数量/间隔'],
  ...data.CARD_KILL_STEPS.map((value, index) => [`cardStep${index}`, `第${index + 1}张卡所需新增击杀`, value, null, '只', 'const CARD_KILL_STEPS', '每次选卡后重置计数；累计94击杀才够6张']),
];
addParams('难度参数', diff, '08｜关卡与战斗参数', '数量、HP、出怪间隔、移动、Boss、命中与韧性均可调。实际脚本使用的参数优先于注释；候选模式提供单波数量封顶与缓增HP。');
input('难度参数', `D${parameterRows.spawnY.row}`, -100, 100);

const monsterDefs = [];
for (const [kind, profile] of Object.entries(data.MONSTER_PROFILES)) {
  const label = { normal: '普通', runner: '疾行', brute: '重甲', elite: '精英' }[kind];
  for (const [field, fieldLabel, unit] of [['hp', '生命倍率', '倍'], ['move', '每步移动', '格'], ['reward', '击杀金币', '金币'], ['dodge', '闪避值', '固定值'], ['resilience', '韧性值', '固定值']]) {
    const candidate = field === 'reward' ? { normal: 4, runner: 5, brute: 6, elite: 8 }[kind] : profile[field];
    monsterDefs.push([`${kind}${field}`, `${label}·${fieldLabel}`, profile[field], candidate, unit, 'const MONSTER_PROFILES', '当前全部种类闪避100、韧性0；资源形象随章节切换']);
  }
}
addParams('章节与怪物', monsterDefs, '09｜怪物模板与章节出场表', '每5关换地图，7张地图循环。旧LEVEL_WAVE_PROFILES数组未参与当前getWaveProfile；按CHAPTERS.roster读取。');
header('章节与怪物', 30, ['章节序号', '场景名', '场景资源', 'Boss名称', '波1类型', '波2类型', '波3类型', '波4类型', '波5类型', '波6类型', '波7及以后']);
block('章节与怪物', 31, data.CHAPTERS.map((chapter, index) => [index + 1, chapter.name, chapter.scene, chapter.bossName, ...chapter.roster]));
input('章节与怪物', 'E31:K37');
sheets['章节与怪物'].getRange('E31:K37').dataValidation = { rule: { type: 'list', values: Object.keys(data.MONSTER_PROFILES) } };
header('章节与怪物', 40, ['类型', '采用HP倍率', '采用移动/步', '采用击杀金币', '采用闪避', '采用韧性']);
block('章节与怪物', 41, Object.keys(data.MONSTER_PROFILES).map(kind => [kind, `=${ref(`${kind}hp`)}`, `=${ref(`${kind}move`)}`, `=${ref(`${kind}reward`)}`, `=${ref(`${kind}dodge`)}`, `=${ref(`${kind}resilience`)}`]));
bounds['章节与怪物'] = { width: 11, endRow: 44 };

function monsterLookup(kind, index) { return `VLOOKUP(${kind},'章节与怪物'!$A$41:$F$44,${index},FALSE)`; }
function waveKind(chapter, wave) { return `INDEX('章节与怪物'!$E$31:$K$37,${chapter},${Math.min(7, wave)})`; }
function spawnInterval() { return `ROUNDUP(${ref('spawnSeconds')}/(${ref('tickSeconds')}*${ref('gameSpeed')}),0)*${ref('tickSeconds')}`; }
const stageEnd = data.LEVEL_CONTENT_COUNT + 6;
title('关卡总表', '10｜900关难度与奖励', 'E～G为单关覆盖项，默认1/0/1；右侧保留逐波计算。时长是数量与间隔推导，不是实测通关时间。可筛选关卡与地图。', 51, stageEnd);
const stageLabels = ['关卡', '地图序号', '地图', '波数', 'HP倍率覆盖', '每波数量增减', '结算倍率覆盖', '怪物总数', '全局总HP', '最终BossHP', '全杀金币', '仅出怪分钟', '加操作尾怪分钟', '胜利金币', '胜利元宝', '强化石', '升星石', '保底后掉率', '主线最高品质', '军报最低品质', '军报最高品质', '最多可触发卡', '时长提示'];
for (let wave = 1; wave <= 7; wave++) stageLabels.push(`波${wave}数量`, `波${wave}基础HP`, `波${wave}总HP`, `波${wave}击杀金币`);
header('关卡总表', 6, stageLabels);
const stageRows = [];
for (let level = 1; level <= data.LEVEL_CONTENT_COUNT; level++) {
  const row = level + 6;
  const countCells = [], hpCells = [], goldCells = [], helpers = [];
  for (let wave = 1; wave <= 7; wave++) {
      const count = `${col(24 + (wave - 1) * 4)}${row}`;
      const base = `${col(25 + (wave - 1) * 4)}${row}`;
      countCells.push(count); hpCells.push(`${col(26 + (wave - 1) * 4)}${row}`); goldCells.push(`${col(27 + (wave - 1) * 4)}${row}`);
      const kind = waveKind(`B${row}`, wave);
    const waveShape = `(${ref('monsterTotalBase')}*POWER(A${row},${ref('monsterTotalPower')})/D${row}*(0.85+0.3*(${wave}-1)/MAX(1,D${row}-1)))`;
    const hpScale = `(${ref('hpBase')}*POWER(A${row},${ref('levelHpPower')})*MIN(${ref('lateHpCap')},1+MAX(0,A${row}-${ref('lateHpStart')})*${ref('lateHpPerLevel')}))`;
    const waveHpShape = `(36+${wave}*7)/(36+7*(D${row}+1)/2)`;
    helpers.push(`=IF(${wave}>D${row},0,MAX(2,MIN(${ref('countCap')},ROUND(${waveShape},0)+F${row})))`,
      `=IF(${wave}>D${row},0,ROUND(${hpScale}*${waveHpShape}*E${row},0))`,
      `=IF(${count}=0,0,(${count}-IF(${wave}=D${row},1,0))*ROUND(${base}*${monsterLookup(kind, 2)},0)+IF(${wave}=D${row},ROUND(${base}*${ref('bossSpawnFactor')}*${ref('brutehp')},0),0))`,
      `=IF(${count}=0,0,(${count}-IF(${wave}=D${row},1,0))*${monsterLookup(kind, 4)}+IF(${wave}=D${row},${ref('bossGold')},0))`);
  }
  const rarity = Array.from({ length: 7 }, (_, index) => `IF(VLOOKUP(A${row},'装备掉落'!$A$29:$H$34,${index + 2},TRUE)>0,${index + 1},0)`).join(',');
  const cards = Array.from({ length: 6 }, (_, index) => `IF(H${row}>=(${Array.from({ length: index + 1 }, (_, card) => ref(`cardStep${card}`)).join('+')}),1,0)`).join('+');
  stageRows.push([level, `=MOD(INT((A${row}-1)/5),7)+1`, `=INDEX('章节与怪物'!$B$31:$B$37,B${row})`, `=MIN(${ref('maxWaves')},MAX(${ref('minWaves')},A${row}))`, 1, 0, 1,
    `=SUM(${countCells.join(',')})`, `=SUM(${hpCells.join(',')})`, `=ROUND(INDEX(X${row}:AY${row},1,(D${row}-1)*4+2)*${ref('bossSpawnFactor')}*${ref('brutehp')},0)`, `=SUM(${goldCells.join(',')})`,
    `=H${row}*(${spawnInterval()})/60`, `=L${row}+D${row}*(${ref('prepSeconds')}+${ref('tailSeconds')})/60`,
    `=ROUNDDOWN((${ref('goldBase')}+A${row}*${ref('goldSlope')})*G${row},0)`, `=ROUNDDOWN(MIN(${ref('yuanCap')},${ref('yuanBase')}+A${row}*${ref('yuanSlope')})*G${row},0)`,
    `=ROUNDDOWN((${tierFormula(`A${row}`, 'enh')})*G${row},0)`, `=ROUNDDOWN((${tierFormula(`A${row}`, 'star')})*G${row},0)`, "='装备掉落'!$B$38", `=MAX(${rarity})`,
    `=MIN(7,S${row}+${ref('raidQualityMin')})`, `=MIN(7,S${row}+${ref('raidQualityMax')})`, `=${cards}`, `=IF(L${row}>${ref('targetMinutes')},"仅出怪已超目标","还需实测")`, ...helpers]);
}
block('关卡总表', 7, stageRows);
input('关卡总表', `E7:E${stageEnd}`, 0.01, 100);
input('关卡总表', `F7:F${stageEnd}`, -10000, 10000, true);
input('关卡总表', `G7:G${stageEnd}`, 0, 100);
formats('关卡总表', [`A7:B${stageEnd}`, `D7:D${stageEnd}`, `H7:K${stageEnd}`, `N7:Q${stageEnd}`, `S7:V${stageEnd}`, `X7:AY${stageEnd}`], '#,##0');
formats('关卡总表', [`R7:R${stageEnd}`], '0.0%');
widths('关卡总表', [10, 12, 18, 9, 15, 16, 17, 16, 22, 22, 18, 19, 23, 17, 17, 14, 14, 17, 18, 18, 18, 18, 25, ...Array(28).fill(19)]);
sheets['关卡总表'].tables.add(`A6:AY${stageEnd}`, true, 'StageBalance');

title('波次预览', '11｜所选关卡逐波怪物', '使用说明B5选择关卡。Boss替代本波最后一只；下方另列军报10波。通行时间未计禁锢、减速、Boss狂暴和攻击击退。', 15, 29);
header('波次预览', 6, ['模式', '波次', '普通怪模板', '总数量', '基础HP', '普通单只HP', 'Boss数量', 'Boss单只HP', '移动/步', '无控制通行秒', '闪避', '韧性', '全杀金币', '出怪秒', '怪物总HP']);
for (let index = 0; index < 17; index++) {
  const row = index + 7, raid = index >= 7, wave = raid ? index - 6 : index + 1;
  const level = "'使用说明'!$B$5", chapter = `MOD(INT((${level}-1)/5),7)+1`;
  const active = raid ? `${wave}<=${ref('raidWaves')}` : `${wave}<=MIN(${ref('maxWaves')},MAX(${ref('minWaves')},${level}))`;
  const hpOverride = raid ? '1' : `VLOOKUP(${level},'关卡总表'!$A$7:$AY$${stageEnd},5,FALSE)`;
  const countDelta = raid ? '0' : `VLOOKUP(${level},'关卡总表'!$A$7:$AY$${stageEnd},6,FALSE)`;
  block('波次预览', row, [[raid ? '军报' : '主线', wave, `=${waveKind(chapter, wave)}`,
    `=IF(${active},MAX(2,MIN(${ref('countCap')},ROUND(${ref('monsterTotalBase')}*POWER(${level},${ref('monsterTotalPower')})/${ref('maxWaves')}*(0.85+0.3*(B${row}-1)/MAX(1,${ref('maxWaves')}-1)),0)+${countDelta})),0)`,
    `=ROUND(${ref('hpBase')}*POWER(${level},${ref('levelHpPower')})*MIN(${ref('lateHpCap')},1+MAX(0,${level}-${ref('lateHpStart')})*${ref('lateHpPerLevel')})*((36+B${row}*7)/(36+7*(${ref('maxWaves')}+1)/2))*(${raid ? ref('raidDifficulty') : '1'}*${hpOverride}),0)`,
    `=IF(D${row}>0,ROUND(E${row}*${monsterLookup(`C${row}`, 2)},0),0)`,
    `=IF(D${row}>0,IF(${raid ? `MOD(B${row},${ref('raidBossEvery')})=0` : `B${row}=MIN(${ref('maxWaves')},MAX(${ref('minWaves')},${level}))`},1,0),0)`,
    `=IF(G${row}>0,ROUND(E${row}*${ref('bossSpawnFactor')}*${ref('brutehp')},0),0)`, `=${monsterLookup(`C${row}`, 3)}`,
    `=ROUNDUP((${ref('leakY')}-${ref('spawnY')})/I${row},0)*ROUNDUP(${ref('moveSeconds')}/(${ref('tickSeconds')}*${ref('gameSpeed')}),0)*${ref('tickSeconds')}`,
    `=${monsterLookup(`C${row}`, 5)}`, `=${monsterLookup(`C${row}`, 6)}`, `=(D${row}-G${row})*${monsterLookup(`C${row}`, 4)}+G${row}*${ref('bossGold')}`, `=D${row}*(${spawnInterval()})`, `=(D${row}-G${row})*F${row}+G${row}*H${row}`]]);
}
block('波次预览', 26, [['Boss闪避', `=${ref('bossDodge')}`, 'Boss韧性', `=${ref('bossResilience')}`], ['Boss无狂暴通行秒', `=ROUNDUP((${ref('leakY')}-${ref('spawnY')})/${ref('brutemove')},0)*ROUNDUP(${ref('moveSeconds')}/(${ref('tickSeconds')}*${ref('gameSpeed')}),0)*${ref('tickSeconds')}`, 'Boss技能CD', `=${ref('bossSkill')}`]]);
widths('波次预览', [15, 10, 20, 15, 18, 18, 15, 20, 16, 21, 14, 14, 20, 18, 23]);
formats('波次预览', ['B7:H23', 'K7:M23', 'O7:O23'], '#,##0');

title('战斗压力', '12｜武将输出与怪物压力试算', '仅估计静态输出，不预测胜率。棋盘站位、技能、卡牌、装置、敌人分路都会改变覆盖率；黄色项为人工输入的实战假设。', 16, 29);
header('战斗压力', 6, ['武将', '在场棋子数', '局内等级', '装备永久攻击', '额外暴击值', '额外命中值', '攻速加成%', '每次平均目标', '有效输出时间占比', '攻击间隔秒', '命中率', '暴击率', '单次期望伤害', '有效总DPS', '基础单击伤害', '攻击范围/半径']);
['sword', 'fan', 'rock'].forEach((kind, index) => {
  const row = 7 + index;
  const intervals = data.ATTACK_INTERVAL_BY_TIER.slice(1).length === 4 ? data.ATTACK_INTERVAL_BY_TIER.slice(1) : data.ATTACK_INTERVAL_BY_TIER;
  block('战斗压力', row, [[data.TYPES[kind].name, 6, 1, 0, 0, 0, 0, 1, 0.55,
    `=CHOOSE(C${row},${intervals.join(',')})/(1+G${row}/100)`, `=IF(${ref('hitBase')}+F${row}>=B14,1,(${ref('hitBase')}+F${row})/MAX(0.000001,B14))`,
    `=MAX(0,MIN(1,(MAX(0,${ref('critBase')}+E${row}-B15)*${ref('critK')}+${ref('critFlat')})/100))`,
    `=(O${row}*${ref('mergeAttackFactor')}^(C${row}-1)+D${row})*K${row}*(1+L${row}*(${ref('critDamage')}-1))`, `=B${row}*M${row}/J${row}*H${row}*I${row}`, data.TYPES[kind].dps, `=CHOOSE(C${row},${kind === 'rock' ? '0.5,1,1.5,2' : '3,4,5,6'})`]]);
});
input('战斗压力', 'B7:B9', 0, 36, true); input('战斗压力', 'C7:C9', 1, 4, true); input('战斗压力', 'D7:G9', 0, 100000);
input('战斗压力', 'H7:H9', 0, 30); input('战斗压力', 'I7:I9', 0, 1);
block('战斗压力', 12, [['选中关卡', "='使用说明'!B5"], ['对抗对象', 'normal'], ['目标闪避', '=IF(B13="boss",'+ref('bossDodge')+','+monsterLookup('B13',5)+')'], ['目标韧性', '=IF(B13="boss",'+ref('bossResilience')+','+monsterLookup('B13',6)+')'],
  ['全场有效DPS', '=SUM(N7:N9)'], ['每秒新增HP压力', `=VLOOKUP(B12,'关卡总表'!$A$7:$AY$${stageEnd},9,FALSE)/(VLOOKUP(B12,'关卡总表'!$A$7:$AY$${stageEnd},12,FALSE)*60)`], ['DPS/新增HP压力', '=IFERROR(B16/B17,0)'], ['最终Boss静态击杀秒', `=IF(B16=0,0,VLOOKUP(B12,'关卡总表'!$A$7:$AY$${stageEnd},10,FALSE)/B16)`], ['压力口径', '比值<1提示长期堆怪风险；>1也不保证所有分路均守住。'], ['Boss时间口径', '假定全场DPS都打Boss；忽略技能时为乐观估计，0表示无输出。']]);
input('战斗压力', 'B13'); sheets['战斗压力'].getRange('B13').dataValidation = { rule: { type: 'list', values: ['normal','runner','brute','elite','boss'] } };
sheets['战斗压力'].getRange('B20:P20').merge(); sheets['战斗压力'].getRange('B21:P21').merge();
formats('战斗压力', ['I7:I9', 'K7:L9', 'B18'], '0.0%');
widths('战斗压力', [27, 19, 16, 20, 18, 18, 18, 20, 23, 19, 15, 15, 23, 21, 21, 24]);

console.log('Stage and combat sheets ready');

title('每日计划', '13｜30天玩家行为与养成目标', '玩家行为是假设，不是留存或胜率预测。每天按一个代表关卡计算，首日仅计90分钟恢复。次数可为群体均值；目标消耗允许出现缺口，不会假装已经买得起。', 32, 49);
header('每日计划', 6, ['可调项目', ...Array.from({ length: 30 }, (_, day) => `第${day + 1}天`), '口径']);
const planDefs = [
  ['在线时间（分钟）', 90, '含军报、广告、主线；不含离线时间'],
  ['主线单局预留（分钟）', 3, '实际采用max(本项,关卡出怪+操作+尾怪)'],
  ['最终胜率', 0.8, '已含复活结果；不是由战斗力自动推导'],
  ['胜局中新关占比', 0.65, '其余为重打；不重复发已领宝箱'],
  ['失败到达波次比例', 0.65, '向上取整到实际波次，再按游戏floor结算'],
  ['胜局击杀完成比例', 1, '可能漏怪仍获胜，可下调'],
  ['败局击杀完成比例', 0.45, '总关怪物的比例，不等于到达波次'],
  ['结算翻倍广告占比', 0.25, '每局最多一次；主线模拟，不给军报奖励翻倍'],
  ['军报参与次数', 1, '人工假设；随机在线军报不保证每日恰好一次'],
  ['军报胜率', 0.7, '败局仍有最低金币/元宝/装备'],
  ['军报预留耗时（分钟）', 5, '实际取max(本项,10波出怪+操作+尾怪估计)，不低估后期大量出怪'],
  ['单条广告耗时（秒）', 30, '真实平台假设；Demo模拟广告只有数秒'],
  ['每主线额外广告数', 0.2, '提示/洗牌/加步/复活合计，不含结算翻倍'],
  ['元宝补体力次数', 1, '日限1；同日先挣元宝再购买，现金不足会警示'],
  ['广告补体力次数', 1, '日限1；与元宝入口独立'],
  ['商店领元宝广告数', 3, '当前日限5'],
  ['可自然恢复小时', day => day === 1 ? 1.5 : 24, '首日仅在线90分钟，后续完整24小时；上限损耗按先恢复后消费估算'],
  ['每日任务领取比例', 1, '完成并手动领取的比例；无参与/无打造不发对应任务'],
  ['新关剩余血量>50%占比', 0.75, '对应第二档宝箱；已含完美通关'],
  ['新关满血通关占比', 0.35, '不得高于上一行；三档奖励叠加'],
  ['每主线铜钱3消次数', 0.8, '局内行为估计，保留小数代表群体平均'],
  ['每主线铜钱4消次数', 0.15, '同上'],
  ['每主线铜钱5消次数', 0.02, '同上'],
  ['每主线铜钱6+消次数', 0, '同上'],
  ['主线掉装出售比例', 0.1, '军报高品质装备默认保留；出售与留存不重复计件'],
  ['统一养成槽位数', 18, '只改B32；后续引用同一批槽位。不代表已穿满18件装备'],
  ['当日强化目标/槽', day => day <= 2 ? day : day <= 7 ? 2 + (day - 2) * 2 : day <= 14 ? 12 + Math.ceil((day - 7) * 8 / 7) : day <= 21 ? 20 + Math.ceil((day - 14) * 10 / 7) : 30 + Math.ceil((day - 21) * 10 / 9), '前2天低消耗，首周到+12、两周到+20、30天到+40；全队同步培养会出现适度缺口'],
  ['当日升星目标/槽', day => day === 1 ? 0 : day <= 7 ? Math.ceil((day - 1) / 2) : day <= 14 ? 3 + Math.ceil((day - 7) * 3 / 7) : day <= 21 ? 6 + Math.ceil((day - 14) * 2 / 7) : 8 + Math.ceil((day - 21) * 3 / 9), '前2天体验1星，首周3星、两周6星、30天11星；失败消耗按期望计入'],
  ['装备合成尝试次数', 0, '默认关闭；开启需有同品质5件库存，另校验可用部位'],
  ['合成材料品质1～6', 1, '每次消耗同档5件'],
  ['武将突破次数', day => [3, 7, 14, 21, 30].includes(day) ? 1 : 0, '按单武将阶段性成套估算；实际仍受同品质6部位约束'],
  ['武将突破前品质1～6', 1, '每次扣6件装备并花元宝'],
  ['主角突破次数', day => [5, 10, 16, 23, 30].includes(day) ? 1 : 0, '按阶段成长安排元宝消耗；实际需达到对应10级里程碑'],
  ['主角当日突破起始阶', day => Math.max(0, [5, 10, 16, 23, 30].filter(value => value < day).length), '与上方突破日联动，成本每阶增加100元宝'],
  ['商店购金币预算（元宝）', 0, '按最小商品包向下取整，多余预算不扣'],
  ['商店购强化石预算（元宝）', day => day >= 7 ? 20 : 0, '第7天后每天预留20元宝补强化缺口，体现首通元宝的长期去向'],
  ['商店购升星石预算（元宝）', day => day >= 10 ? 20 : 0, '第10天后每天预留20元宝补升星缺口'],
  ['打造购强化石预算（元宝）', 0, '此入口单价与商店不同'],
  ['打造购升星石预算（元宝）', 0, '按最小商品包向下取整'],
  ['军报每次击杀金币估计', 600, '额外人工假设，未按军报每波重算；失败/胜利的加权平均'],
  ['军报每次铜钱金币估计', 0, '未观测默认0，可填实测均值'],
];
block('每日计划', 7, planDefs.map(([label, value, explanation], index) => [label, ...Array.from({ length: 30 }, (_, day) => index === 25 && day > 0 ? '=$B$32' : typeof value === 'function' ? value(day + 1) : value), explanation]));
input('每日计划', 'B7:AE47', 0, 1000000);
for (const row of [9,10,11,12,13,14,16,24,25,26,31]) input('每日计划', `B${row}:AE${row}`, 0, 1);
for (const row of [20,21]) input('每日计划', `B${row}:AE${row}`, 0, 1, true);
input('每日计划', 'B22:AE22', 0, 5, true); input('每日计划', 'B32', 1, 18, true);
input('每日计划', 'B33:AE33', 0, 300, true); input('每日计划', 'B34:AE34', 0, 30, true);
input('每日计划', 'B36:AE36', 1, 6, true); input('每日计划', 'B38:AE38', 1, 6, true);
sheets['每日计划'].getRange('C32:AE32').format = { fill: '#EAF3F3', font: { color: color.formula } };
for (const row of [9,10,11,12,13,14,16,24,25,26,31]) formats('每日计划', [`B${row}:AE${row}`], '0.0%');
widths('每日计划', [37, ...Array(30).fill(14), 76]);
sheets['每日计划'].getRange('AF7:AF47').format.wrapText = true;
sheets['每日计划'].getRange('A7:AF47').format.rowHeight = 40;
sheets['每日计划'].freezePanes.freezeColumns(1);

title('30天收支', '14｜30天产销与库存需求预测', '从每日计划联动：先限制时间和体力，再算收入、养成需求、库存。负数表示计划缺口，不是实际允许透支；不模拟同日现金顺序、装备部位与品质可用性。', 32, 114);
header('30天收支', 6, ['项目', ...Array.from({ length: 30 }, (_, day) => `第${day + 1}天`), '口径']);
const labels = {
  7:'代表关卡',8:'主线波数',9:'采用胜率',10:'无广告每局分钟',11:'军报参与次数',12:'固定广告分钟',13:'含广告主线每局分钟',14:'时间可支持主线局数',15:'期初体力',16:'自然恢复体力',17:'元宝补充体力',18:'广告补充体力',19:'可用体力（封顶）',20:'体力可支持局数',21:'实际计划主线局数',22:'胜利局数期望',23:'失败局数期望',24:'新关胜利期望',25:'期末解锁关卡期望',26:'主线体力消耗',27:'期末体力',28:'实际计划在线分钟',29:'失败到达波次',30:'结算平均倍率',31:'日常领取比例',32:'单关全额金币',33:'单关全额元宝',34:'单关全额强化石',35:'单关全额升星石',36:'日常材料取档关卡',37:'主线装备掉落期望',38:'军报装备数量',39:'主线出售件数',40:'装备净留存',41:'累计可支配装备件数',42:'装备计划提示',
  44:'金币期初',45:'主线结算金币',46:'主线击杀金币',47:'主线铜钱消除金币',48:'登录金币',49:'日常任务金币',50:'军报结算金币',51:'军报击杀/铜钱金币',52:'出售装备金币',53:'合成额外奖励金币',54:'商店兑换金币',55:'金币总产出',56:'强化金币需求',57:'升星金币期望需求',58:'装备合成金币需求',59:'金币总消耗',60:'金币期末/资金缺口',
  62:'元宝期初',63:'主线结算元宝',64:'新关三档宝箱元宝',65:'每日任务元宝',66:'商店广告元宝',67:'军报结算元宝',68:'元宝总产出',69:'体力购买元宝消耗',70:'武将突破元宝消耗',71:'主角突破元宝消耗',72:'材料/金币兑换元宝',73:'元宝总消耗',74:'元宝期末/资金缺口',
  76:'强化石期初',77:'主线强化石',78:'每日任务强化石',79:'军报强化石期望',80:'兑换强化石',81:'强化石总产出',82:'强化石需求',83:'强化石期末/缺口',84:'强化石当日产销差',
  86:'升星石期初',87:'主线升星石',88:'每日任务升星石',89:'军报升星石期望',90:'兑换升星石',91:'升星石总产出',92:'升星石期望需求',93:'升星石期末/缺口',94:'升星石当日产销差',
  96:'当日强化目标',97:'前日强化目标',98:'当日升星目标',99:'前日升星目标',100:'计划养成槽位数',101:'强化材料增量需求',102:'强化金币增量需求',103:'升星材料增量期望',104:'升星金币增量期望',105:'养成目标提示',106:'计划广告次数',107:'资源可负担提示',108:'出怪时长提示',109:'宝箱领取假设提示',110:'同品质装备可用性',112:'军报总怪物数',113:'军报出怪与操作分钟',114:'实际采用军报分钟',
};
for (const [row, label] of Object.entries(labels)) set('30天收支', `A${row}`, label);
for (let day = 1; day <= 30; day++) {
  const column = col(day + 1), previous = col(day), cell = row => `${column}${row}`, plan = row => `'每日计划'!${column}${row}`;
  const stage = index => `VLOOKUP(${cell(7)},'关卡总表'!$A$7:$AY$${stageEnd},${index},FALSE)`;
  const taskMat = suffix => tierFormula(cell(36), suffix);
  const exchange = (row, key) => `ROUNDDOWN(${plan(row)}/${ref(`${key}Price`)},0)`;
  const spendExchange = [[41,'shopGold'],[42,'shopEnh'],[43,'shopStar'],[44,'forgeEnh'],[45,'forgeStar']].map(([row,key]) => `${exchange(row,key)}*${ref(`${key}Price`)}`).join('+');
  const settlement = full => `(${cell(22)}*${cell(full)}+${cell(23)}*ROUNDDOWN(${cell(full)}*${cell(29)}/${cell(8)}*${ref('failureFactor')},0))*${cell(30)}`;
  const synthGold = `CHOOSE(${plan(36)},${Array.from({length:6},(_,index)=>ref(`qsynthGold${index+1}`)).join(',')})`;
  const synthRate = `CHOOSE(${plan(36)},${Array.from({length:6},(_,index)=>ref(`qsynthRate${index+1}`)).join(',')})`;
  const breakGold = `CHOOSE(${plan(38)},${Array.from({length:6},(_,index)=>ref(`qbreak${index+1}`)).join(',')})`;
  const averageSale = Array.from({length:7},(_,index)=>`VLOOKUP(${cell(7)},'装备掉落'!$A$29:$H$34,${index+2},TRUE)*ROUND(${ref('sellBase')}*${ref(`qcoef${index+1}`)},0)`).join('+');
  const forgeDelta = (name, valueCol, target, prior) => `(IF(${cell(target)}=0,0,INDEX('${name}'!$${valueCol}$19:$${valueCol}$${name === '强化消耗' ? 318 : 48},${cell(target)}))-IF(${cell(prior)}=0,0,INDEX('${name}'!$${valueCol}$19:$${valueCol}$${name === '强化消耗' ? 318 : 48},${cell(prior)})))*${cell(100)}`;
  const formulas = {
    7:day===1?'1':`MIN(900,MAX(1,ROUNDDOWN(${previous}25,0)))`,8:stage(4),9:plan(9),10:`MAX(${plan(8)},${stage(13)})`,
    11:`MIN(${plan(15)},ROUNDDOWN(MAX(0,${plan(7)}-${cell(12)})/MAX(0.01,${cell(114)}),0))`,12:`(MIN(${plan(22)},${ref('adYuanLimit')})+MIN(${plan(21)},${ref('staminaAdLimit')}))*${plan(18)}/60`,
    13:`${cell(10)}+(${plan(14)}+${plan(19)})*${plan(18)}/60`,14:`MAX(0,ROUNDDOWN((${plan(7)}-${cell(11)}*${cell(114)}-${cell(12)})/MAX(0.01,${cell(13)}),0))`,
    15:day===1?ref('staminaStart'):`${previous}27`,16:`MAX(0,MIN(${ref('staminaCap')}-${cell(15)},ROUNDDOWN(${plan(23)}*60/${ref('staminaMinutes')},0)))`,
    17:`MIN(${plan(20)},${ref('staminaBuyLimit')})*${ref('staminaRefill')}`,18:`MIN(${plan(21)},${ref('staminaAdLimit')})*${ref('staminaRefill')}`,19:`MIN(${ref('staminaCap')},SUM(${cell(15)}:${cell(18)}))`,20:`ROUNDDOWN(${cell(19)}/${ref('staminaCost')},0)`,21:`MIN(${cell(14)},${cell(20)})`,
    22:`${cell(21)}*${cell(9)}`,23:`${cell(21)}-${cell(22)}`,24:`MIN(${cell(22)}*${plan(10)},MAX(0,900-${day===1?'0':`SUM($B24:${previous}24)`}))`,25:`MIN(900,1+SUM($B24:${cell(24)}))`,26:`${cell(21)}*${ref('staminaCost')}`,27:`${cell(19)}-${cell(26)}`,28:`${cell(21)}*${cell(13)}+${cell(11)}*${cell(114)}+${cell(12)}`,29:`MIN(${cell(8)},MAX(1,ROUNDUP(${cell(8)}*${plan(11)},0)))`,30:`1+${plan(14)}*(${ref('doubleFactor')}-1)`,31:`IF(${cell(21)}+${cell(11)}>0,${plan(24)},0)`,
    32:stage(14),33:stage(15),34:stage(16),35:stage(17),36:`ROUNDDOWN(${cell(25)},0)`,37:`${cell(22)}*'装备掉落'!$B$38`,38:cell(11),39:`${cell(37)}*${plan(31)}`,40:`${cell(37)}+${cell(38)}-${cell(39)}-${plan(35)}*(${ref('synthCount')}-${synthRate})-${plan(37)}*6`,41:`${day===1?'0':`${previous}41`}+${cell(40)}`,42:`IF(${cell(41)}<0,"装备总量不足","仍需检查同品质/部位")`,
    44:day===1?ref('goldStart'):`${previous}60`,45:settlement(32),46:`${stage(11)}*(${cell(22)}*${plan(12)}+${cell(23)}*${plan(13)})`,47:`${cell(21)}*(${plan(27)}*${ref('coin3')}+${plan(28)}*${ref('coin4')}+${plan(29)}*${ref('coin5')}+${plan(30)}*${ref('coin6')})`,48:`IF(${plan(7)}>0,${ref('loginGold')},0)`,49:`${cell(31)}*(IF(${cell(21)}>0,${ref('taskPlayGold')}+${ref('taskClearGold')},0)+IF(${cell(11)}>0,${ref('taskBeastGold')},0)+IF(${cell(101)}>0,${ref('taskEnhGold')},0)+IF(${cell(103)}>0,${ref('taskStarGold')},0))`,
    50:`${cell(11)}*(${ref('goldBase',true)}+${cell(7)}*${ref('goldSlope',true)})*(${plan(16)}*(${ref('raidGoldMin')}+${ref('raidGoldMax')})/2+(1-${plan(16)})*${ref('raidGoldMin')})`,51:`${cell(11)}*(${plan(46)}+${plan(47)})`,52:`${cell(39)}*(${averageSale})`,53:`${plan(35)}*${synthRate}*${ref('synthBonusOn')}*${ref('synthBonusChance')}*${ref('synthBonusFactor')}*ROUND(${ref('sellBase')}*CHOOSE(${plan(36)},${Array.from({length:6},(_,index)=>ref(`qcoef${index+2}`)).join(',')}),0)`,54:`${exchange(41,'shopGold')}*${ref('shopGoldAmount')}`,55:`SUM(${cell(45)}:${cell(54)})`,56:cell(102),57:cell(104),58:`${plan(35)}*${synthGold}`,59:`SUM(${cell(56)}:${cell(58)})`,60:`${cell(44)}+${cell(55)}-${cell(59)}`,
    62:day===1?ref('yuanStart'):`${previous}74`,63:settlement(33),64:`${cell(24)}*(${ref('chest0')}+${plan(25)}*${ref('chest1')}+MIN(${plan(25)},${plan(26)})*${ref('chest2')})`,65:`${cell(31)}*(IF(${cell(21)}>0,${ref('taskKillYuan')},0)+IF(${cell(11)}>0,${ref('taskBeastYuan')},0))`,66:`MIN(${plan(22)},${ref('adYuanLimit')})*${ref('adYuan')}`,67:`${cell(11)}*(${plan(16)}*(${ref('raidYuanMin')}+${ref('raidYuanMax')})/2+(1-${plan(16)})*${ref('raidYuanMin')})`,68:`SUM(${cell(63)}:${cell(67)})`,69:`MIN(${plan(20)},${ref('staminaBuyLimit')})*${ref('staminaPrice')}`,70:`${plan(37)}*${breakGold}`,71:`${plan(39)}*(${ref('heroBreakBase')}+${plan(40)}*${ref('heroBreakStep')})+${plan(39)}*MAX(0,${plan(39)}-1)/2*${ref('heroBreakStep')}`,72:spendExchange,73:`SUM(${cell(69)}:${cell(72)})`,74:`${cell(62)}+${cell(68)}-${cell(73)}`,
    76:day===1?ref('enhStart'):`${previous}83`,77:settlement(34),78:`${cell(31)}*(IF(${cell(21)}>0,${taskMat('play')}+${taskMat('clear')},0)+IF(${cell(101)}>0,MAX(1,ROUNDDOWN((${taskMat('play')})/2,0)),0))`,79:`${cell(11)}*${plan(16)}*${ref('raidEnhChance')}*MAX(1,ROUND(${cell(34)}*${ref('raidStoneFactor')},0))`,80:`${exchange(42,'shopEnh')}*${ref('shopEnhAmount')}+${exchange(44,'forgeEnh')}*${ref('forgeEnhAmount')}`,81:`SUM(${cell(77)}:${cell(80)})`,82:cell(101),83:`${cell(76)}+${cell(81)}-${cell(82)}`,84:`${cell(81)}-${cell(82)}`,
    86:day===1?ref('starStart'):`${previous}93`,87:settlement(35),88:`${cell(31)}*(IF(${cell(21)}>0,${taskMat('kill')},0)+IF(${cell(103)}>0,MAX(1,ROUNDUP((${taskMat('kill')})/2,0)),0))`,89:`${cell(11)}*${plan(16)}*${ref('raidStarChance')}*MAX(1,ROUND(${cell(35)}*${ref('raidStoneFactor')},0))`,90:`${exchange(43,'shopStar')}*${ref('shopStarAmount')}+${exchange(45,'forgeStar')}*${ref('forgeStarAmount')}`,91:`SUM(${cell(87)}:${cell(90)})`,92:cell(103),93:`${cell(86)}+${cell(91)}-${cell(92)}`,94:`${cell(91)}-${cell(92)}`,
    96:plan(33),97:day===1?'0':`${previous}96`,98:plan(34),99:day===1?'0':`${previous}98`,100:plan(32),101:`MAX(0,${forgeDelta('强化消耗','I',96,97)})`,102:`MAX(0,${forgeDelta('强化消耗','J',96,97)})`,103:`MAX(0,${forgeDelta('升星消耗','I',98,99)})`,104:`MAX(0,${forgeDelta('升星消耗','J',98,99)})`,105:`IF(OR(${cell(96)}<${cell(97)},${cell(98)}<${cell(99)}),"目标倒退，不退款","需求目标未校验等级上限")`,106:`MIN(${plan(21)},${ref('staminaAdLimit')})+MIN(${plan(22)},${ref('adYuanLimit')})+${cell(21)}*(${plan(14)}+${plan(19)})`,107:`IF(MIN(${cell(60)},${cell(74)},${cell(83)},${cell(93)})<0,"存在缺口，需降目标/兑换","仅日末资源足够")`,108:stage(23),109:`IF(${plan(26)}>${plan(25)},"满血占比过高，按较小值计算","正常")`,110:`IF(${plan(35)}+${plan(37)}>0,"本模型未校验，需检查背包","未安排合成/突破")`,
  };
  formulas[112]=Array.from({length:10},(_,index)=>`IF(${index+1}<=${ref('raidWaves')},MAX(1,MIN(${ref('countCap')},${ref('raidCountBase')}+${index+1}*${ref('countWave')}+ROUNDUP(${cell(7)}*${ref('countLevel')},0))),0)`).join('+');
  formulas[113]=`${cell(112)}*(${spawnInterval()})/60+${ref('raidWaves')}*(${ref('prepSeconds')}+${ref('tailSeconds')})/60`;
  formulas[114]=`MAX(${plan(17)},${cell(113)})`;
  for (const [row, formula] of Object.entries(formulas)) set('30天收支', cell(row), `=${formula}`);
}
for (const row of [15,21,27,44,55,59,60,62,68,73,74,76,81,82,83,86,91,92,93,96]) sheets['30天收支'].getRange(`A${row}:AE${row}`).format.fill = color.pale;
for (const row of [60,74,83,93,41,84,94]) sheets['30天收支'].getRange(`B${row}:AE${row}`).conditionalFormats.add('cellIs', {operator:'lessThan',formula:0,format:{fill:color.alert,font:{color:'#A52222'}}});
for (const row of [9,31]) formats('30天收支', [`B${row}:AE${row}`], '0.0%');
for (const [row, text] of [[24,'新关累计最多900关；重复挑战不再发新关宝箱，代表关卡按期初进度取整'],[37,'使用含保底稳态概率，第一天有轻微起始偏差'],[41,'只检查数量，不能替代同品质与6部位可用性校验'],[49,'假设有主线即完成消除/击杀任务；通过每日领取比例调整'],[50,'军报金币基数读取主线采用值，并按军报倍数放大'],[60,'负数为累计金币缺口；养成计划未因缺钱停止'],[74,'未模拟同日购买顺序；先赚元宝再补体力'],[83,'若负数则计划强化不能按期达成'],[93,'概率期望，不包含极端失败分位数'],[105,'强化限制依赖主角/解锁关卡，当前表为材料需求预算'],[114,'军报参与次数同时受可用时间约束；不直接使用固定5分钟']]) set('30天收支', `AF${row}`, text);
widths('30天收支', [37, ...Array(30).fill(18), 72]);
sheets['30天收支'].getRange('A7:AF114').format.rowHeight = 28;
sheets['30天收支'].getRange('AF7:AF114').format.wrapText = true;
for (const row of [42,105,107,108,109,110]) sheets['30天收支'].getRange(`B${row}:AE${row}`).format = {wrapText:true,rowHeight:44};
sheets['30天收支'].freezePanes.freezeColumns(1);
console.log('Thirty-day formulas ready');

title('产销全景', '15｜资源产出与消耗清单', '以app.js当前生效逻辑为准。永久资源与局内临时资源分列；表内采用值随模式切换，规则来源保留以便程序对照。', 7, 62);
header('产销全景', 6, ['资源', '方向', '渠道', '数量/口径', '限制与触发条件', '可调位置', '工程来源']);
const catalog = [
  ['体力','产出','新档初始',`=${ref('staminaStart')}`,'仅新玩家一次','经济参数','const STARTING_STAMINA'],
  ['体力','产出','自然恢复',`=1440/${ref('staminaMinutes')}`,'理论每日数量，达到500暂停；首日不送24小时恢复','经济参数','function refreshStamina'],
  ['体力','产出','元宝购买',`=${ref('staminaRefill')}`,'50元宝/次，每日一次；增加60，不是回到60','经济参数','function refillStamina'],
  ['体力','产出','激励广告',`=${ref('staminaRefill')}`,'每日一次；当前不检查元宝已购买','经济参数','function refillStamina'],
  ['体力','消耗','主线开始',`=${ref('staminaCost')}`,'开局扣除，失败不退款，复活不再扣','经济参数','function startWave'],
  ['体力','不消耗','军报入侵',0,'限时随机事件，免费进入','经济参数','function startWave'],
  ['金币','产出','主线胜利','采用值：常数+关卡×斜率','仅结算部分；失败=向下取整(全额×到达波/总波×0.6)','经济参数 / 关卡总表','function getFullLevelReward'],
  ['元宝','不产出','主线重复结算',0,'直接元宝已关闭；只由每关一次宝箱、任务、军报和广告产出','经济参数 / 关卡总表','function getFullYuanbaoReward'],
  ['强化石/升星石','产出','主线结算','按关卡五档取值','失败按相同波次比例取整，每类分别计算','材料与任务','function getFullForgeMaterialReward'],
  ['金币/材料/经验','产出','结算广告补差',`=${ref('doubleFactor')}`,'总倍率；每局一次，不翻倍宝箱与击杀金币；另有独立装备抽取','经济参数 / 广告成长对照','function showVictory'],
  ['金币','产出','击杀怪物','普通/疾行/重甲/精英/Boss分表','战斗实时入账，失败仍保留已击杀所得','章节与怪物 / 难度参数','const MONSTER_PROFILES'],
  ['金币','产出','铜钱棋子消除','3/4/5/6+连分别50/120/280/680','同种同级连续消除；不是步数宝箱','经济参数','function eliminateMatches'],
  ['金币','产出','每日登录',`=${ref('loginGold')}`,'自然日一次，手动领取','经济参数','function claimDailyLogin'],
  ['元宝','产出','关卡三档宝箱','通关5、>50%血10、满血15','每关每档一次，三档叠加；重复通关不再产出','经济参数','const STAGE_CHEST_META'],
  ['金币/强化石','产出','每日完成1局','80金币+当前档强化石','一次；失败完成一局也可推进','材料与任务 / 经济参数','function getDailyTaskReward'],
  ['金币/强化石','产出','每日消除30棋子','120金币+当前档强化石','一次，按最高解锁关卡取档','材料与任务 / 经济参数','function getDailyTaskReward'],
  ['元宝/升星石','产出','每日击败20怪','10元宝+当前档升星石','一次','材料与任务 / 经济参数','function getDailyTaskReward'],
  ['金币/元宝','产出','每日参加军报','150金币+20元宝','一次，必须实际参加事件','经济参数','function getDailyTaskReward'],
  ['金币/强化石','产出','每日强化1次','80金币+max(1,floor(完成局数任务材料/2))','一次，需进行操作','材料与任务 / 经济参数','function getDailyTaskReward'],
  ['金币/升星石','产出','每日升星1次','80金币+max(1,ceil(击杀任务材料/2))','一次，失败尝试也计数','材料与任务 / 经济参数','function getDailyTaskReward'],
  ['元宝','产出','商店广告',`=${ref('adYuan')}`,'每日5次，与体力/局内广告分开','经济参数','const SHOP_AD_YUANBAO'],
  ['金币/元宝','产出','军报结算','金币主线基数×2～5，元宝15～40','胜利随机；失败给最低，复活只补差','经济参数','function rollBeastRaidReward'],
  ['强化石/升星石','产出','军报结算','45%/25%概率分别给主线材料×2','仅胜利；两种材料独立抽样','经济参数','function rollBeastRaidReward'],
  ['装备','产出','主线胜利',`=${ref('dropChance')}`,'基础68%；连续3胜无掉落则第4胜必出；败局不抽','装备掉落','const EQUIPMENT_DROP_CHANCE'],
  ['装备','产出','结算广告',`=${ref('adEquipmentChance')}`,'每个胜利结算最多一次；独立抽取，不推进主线保底','广告成长对照 / 经济参数','function grantSettlementAdEquipmentDrop'],
  ['装备','产出','军报结算',1,'胜负均一件；主线最高有掉率品质+0～1档，封顶金色','经济参数 / 装备掉落','function settleBeastRaid'],
  ['装备','转化','5合1','同品质5件→高一级随机部位1件','失败全损；金币仍扣；成功率随品质递减','装备品质','const EQUIPMENT_SYNTHESIS_RATES'],
  ['金币','条件产出','合成额外奖励','当前开关关闭','开启后仅成功合成，有10%几率返产物售价×2','经济参数','const EQUIPMENT_SYNTHESIS_BONUS'],
  ['装备','消耗','出售/批量回收','1件→round(10×品质系数)金币','当前10/13/16/20/25/32/40，非向下取整','装备品质','function equipmentSalePrice'],
  ['装备/元宝','消耗','武将突破','6件同品质已穿装备+元宝','品质提升，基础属性永久吸收；强化/升星保留在槽位','装备品质','const EQUIPMENT_BREAKTHROUGH_COSTS'],
  ['金币/强化石','消耗','装备强化','等级阶梯材料与金币','必成；可强化空槽，但空槽不生效','强化消耗','function forgeEnhanceCost'],
  ['金币/升星石','消耗','装备升星','星级阶梯材料与金币','每次都扣；失败不降星，无失败保底','升星消耗','function forgeStarCost'],
  ['元宝','消耗','边塞商店','材料/金币共12档商品','不限次数；同种商品等比例大包','商店与兑换','function showShop'],
  ['元宝','消耗','打造缺料弹窗','20元宝→40强化石或4升星石','与边塞商店统一，定位为材料缺口补充','商店与兑换','const FORGE_ECONOMY'],
  ['元宝','消耗','主角突破','150+100×已突破阶数','每10级门槛，开放后续等级区间','经济参数 / 主角与技能','function getHeroBreakthroughCost'],
  ['金币','未生效','旧版主角金币升级','旧常量仍在，但无当前升级入口','不能计入金币消耗；现版按经验自动升级','主角与技能','function awardHeroExp'],
  ['经验','产出','主线胜利','10体力×100×当前主角等级','失败不发；结算广告可再补发一次；升1级防线+1HP','主角与技能 / 广告成长对照','function heroExpPerStage'],
  ['局内步数','产出','每波操作期',8,'仅局内，不存入永久背包','代码规则','state.steps = 8;'],
  ['局内步数','消耗','相邻棋子交换',1,'未连线也扣步；不可交换非相邻格','代码规则','function eliminateMatches'],
  ['局内步数','产出','普通4+连消','4消20%返1步，5消40%，以此到100%','自动连锁逐簇判定；同种同级至少3连','代码规则','function eliminateMatches'],
  ['局内步数','产出','宝箱棋子消除','数量-2步','3消1，4消2；与首通元宝宝箱不同','代码规则','function eliminateMatches'],
  ['局内步数','产出','加步广告',`=${ref('adStepGain')}`,'当前步数低于11可点，未找到每局总次数上限','经济参数','placement: "额外步数"'],
  ['局内机会','产出','提示广告',`=${ref('hintLimit')}`,'每局至多5次，完成广告才给提示','经济参数','const MAX_MERGE_HINTS'],
  ['局内机会','产出','洗牌广告',`=${ref('shuffleLimit')}`,'每局至多3次，不消耗步数','经济参数','const MAX_BOARD_SHUFFLES'],
  ['局内机会','产出','复活广告',1,'每局一次，不再扣体力；只补高档结算差额','代码规则','function showVictory'],
  ['局内防线HP','产出','葫芦棋子消除','3/4消回1HP，5+消回2HP','不超过当前最大防线血量','代码规则','function eliminateMatches'],
  ['局内控制/伤害','产出','陷阱/地雷消除','陷阱(n-2)×0.5秒；地雷(n-2)×60伤害','升级同类棋子，触碰对应格生效','代码规则','function eliminateMatches'],
  ['卡牌效果','产出','击杀三选一','新增击杀4/8/13/18/23/28，共94','每局最多6次；短关怪物不够则到不了6次','难度参数','const CARD_KILL_STEPS'],
  ['主角技能','时间','大招冷却','各技能独立CD；每局随机队列','玩家点击头像手动释放，无永久货币消耗','主角与技能','const HERO_SKILLS'],
];
block('产销全景', 7, catalog.map(row => [...row.slice(0,6),sourceAt(row[6])]));
bounds['产销全景'].endRow = catalog.length + 6;
sheets['产销全景'].getRange(`A7:G${catalog.length+6}`).format = {wrapText:true,rowHeight:56};
widths('产销全景', [24, 14, 30, 49, 70, 33, 65]);

title('主角与技能', '16｜经验、突破与手动技能', '当前主角由胜利经验自动升级，不再花金币升级。技能按等级解锁，战斗内由玩家点击头像释放；每局从已解锁技能中随机生成队列。', 10, 181);
header('主角与技能', 6, ['顺序','技能','解锁等级','技能CD秒','最大HP伤害比例','最低伤害','禁锢秒','防线回复','释放方式','效果说明']);
block('主角与技能', 7, data.HERO_SKILLS.map((skill,index) => [index+1,skill.name,skill.level,skill.cooldown,skill.effect.damagePct||0,skill.effect.damageMin||0,skill.effect.root||0,skill.effect.heal||0,'手动点击',skill.description]));
formats('主角与技能', ['E7:E21'], '0%');
sheets['主角与技能'].getRange('A7:J21').format = {wrapText:true,rowHeight:46};
set('主角与技能','A24',sourceAt('const HERO_SKILLS'));
sheets['主角与技能'].getRange('A24:J24').merge();
header('主角与技能', 30, ['当前等级','到下级经验','累计到本级经验','当级每勝经验','零经验起升级约需胜局','累计胜局粗估','防线HP','突破阶段门槛','备注','来源']);
block('主角与技能',31,data.HERO_EXP_TABLE.map((experience,index)=>{
  const row=index+31, level=index+1;
  return [level,level<150?experience:0,index===0?0:`=SUM(B$31:B${row-1})`,`=${ref('staminaCost')}*${ref('heroExpRate')}*A${row}`,`=IF(A${row}>=150,0,ROUNDUP(B${row}/D${row},0))`,index===0?0:`=SUM(E$31:E${row-1})`,`=A${row}+3`,`=INT(A${row}/10)`,level===150?'当前上限；最后一项经验未被升级使用':'升级局数忽略上一级结余，仅用于量级判断',sourceAt('const HERO_EXP_TABLE')];
}));
formats('主角与技能',['A31:H180'], '#,##0');
sheets['主角与技能'].getRange('I31:J180').format.wrapText=true;
sheets['主角与技能'].getRange('A31:J180').format.rowHeight=36;
widths('主角与技能',[14,27,27,24,29,24,18,24,42,72]);

const gearRow=qStart+11;
header('装备品质',gearRow,['部位','属性','白装基础值','绿色','蓝色','紫色','橙色','红色','金色']);
block('装备品质',gearRow+1,data.EQUIPMENT_SLOTS.map((slot,index)=>[slot.name,slot.stat==='speed'?'攻速百分数':slot.stat==='attack'?'攻击固定值':slot.stat==='crit'?'暴击固定值':'命中固定值',data.EQUIPMENT_BASE_VALUES[slot.id],...Array.from({length:6},(_,quality)=>`=ROUND(C${gearRow+index+1}*${ref(`qcoef${quality+2}`)},0)`)]));
const masterRow=gearRow+9;
header('装备品质',masterRow,['大师类型','全身等级门槛','加成属性','加成数值','生效条件']);
block('装备品质',masterRow+1,[...data.FORGE_ENHANCE_MASTER.map(item=>['强化',item.level,item.stat,item.value,'仅已穿装备槽参与，按该武将最低等级计算']),...data.FORGE_STAR_MASTER.map(item=>['升星',item.level,item.stat,item.value,'大师加成详见getWarriorBonuses，永久属性与局内等级分离'])]);
bounds['装备品质']={width:9,endRow:masterRow+16};
sheets['装备品质'].getRange(`E${masterRow+1}:I${masterRow+16}`).merge(true);
sheets['装备品质'].getRange(`A${masterRow+1}:I${masterRow+16}`).format.rowHeight=32;
set('装备品质',`A${masterRow+18}`,sourceAt('const FORGE_ENHANCE_MASTER'));
bounds['装备品质'].endRow=masterRow+18;

title('广告成长对照', 'IAA｜零广告与看满广告成长对照', '黄色参数仍在各配置页调整；本页自动对比每日完成元宝体力购买的零广告玩家，与完成体力、商店及每局结算广告的看满广告玩家。局内提示、洗牌、复活广告只提高胜率，未折成资源。', 12, 180);
header('广告成长对照', 6, ['成长指标', '30天·零广告', '30天·看满广告', '倍率', '90天·零广告', '90天·看满广告', '倍率', '180天·零广告', '180天·看满广告', '倍率', '计算口径']);
const stableDrop = `IF(${ref('dropChance')}=0,1/(${ref('dropPity')}+1),${ref('dropChance')}/(1-(1-${ref('dropChance')})^(${ref('dropPity')}+1)))`;
const noAdRuns = `ROUNDDOWN((1440/${ref('staminaMinutes')}+${ref('staminaRefill')}*${ref('staminaBuyLimit')})/${ref('staminaCost')},0)`;
const fullAdRuns = `ROUNDDOWN((1440/${ref('staminaMinutes')}+${ref('staminaRefill')}*(${ref('staminaBuyLimit')}+${ref('staminaAdLimit')}))/${ref('staminaCost')},0)`;
const comparisonLabels = [
  ['每日可打主线', '自然恢复 + 每日元宝体力；看满广告额外计1次广告体力'],
  ['累计主线局数', '未计失败、军报和首日初始体力；用于稳定日节奏比较'],
  ['结算资源等价局', '金币、强化石、升星石：看满广告按每局双倍'],
  ['主角经验等价胜局', '结算广告同步补发一份主角经验'],
  ['期望装备件数', '基础掉落含保底稳态；看满广告每胜额外独立抽取装备'],
  ['广告元宝', '商店每日5次广告；首通宝箱与日常元宝两类玩家相同'],
  ['体力广告次数', '每日最多1次'],
  ['结算广告次数', '看满广告按每个胜利结算一次'],
  ['关键资源广告合计', '仅计商店元宝、体力、结算；不含提示/洗牌/复活'],
  ['期望主角等级', '按当前经验表和等价胜局查找，不含失败局'],
  ['综合成长指数', '零广告=100；结算资源和装备件数倍率等权'],
];
block('广告成长对照', 7, comparisonLabels.map(([label, explanation]) => [label, null, null, null, null, null, null, null, null, null, explanation]));
const comparisonGroups = [
  { days: 30, no: 'B', full: 'C', ratio: 'D' },
  { days: 90, no: 'E', full: 'F', ratio: 'G' },
  { days: 180, no: 'H', full: 'I', ratio: 'J' },
];
for (const { days, no, full, ratio } of comparisonGroups) {
  set('广告成长对照', `${no}7`, `=${noAdRuns}`);
  set('广告成长对照', `${full}7`, `=${fullAdRuns}`);
  set('广告成长对照', `${no}8`, `=${no}7*${days}`);
  set('广告成长对照', `${full}8`, `=${full}7*${days}`);
  set('广告成长对照', `${no}9`, `=${no}8`);
  set('广告成长对照', `${full}9`, `=${full}8*${ref('doubleFactor')}`);
  set('广告成长对照', `${no}10`, `=${no}8`);
  set('广告成长对照', `${full}10`, `=${full}8*${ref('doubleFactor')}`);
  set('广告成长对照', `${no}11`, `=${no}8*(${stableDrop})`);
  set('广告成长对照', `${full}11`, `=${full}8*((${stableDrop})+${ref('adEquipmentChance')})`);
  set('广告成长对照', `${no}12`, '=0');
  set('广告成长对照', `${full}12`, `=${days}*${ref('adYuan')}*${ref('adYuanLimit')}`);
  set('广告成长对照', `${no}13`, '=0');
  set('广告成长对照', `${full}13`, `=${days}*${ref('staminaAdLimit')}`);
  set('广告成长对照', `${no}14`, '=0');
  set('广告成长对照', `${full}14`, `=${full}8`);
  set('广告成长对照', `${no}15`, '=0');
  set('广告成长对照', `${full}15`, `=${full}12/${ref('adYuan')}+${full}13+${full}14`);
  set('广告成长对照', `${no}16`, `=MIN(${data.HERO_MAX_LEVEL},MATCH(${no}10,$L$30:$L$${29 + data.HERO_MAX_LEVEL},1))`);
  set('广告成长对照', `${full}16`, `=MIN(${data.HERO_MAX_LEVEL},MATCH(${full}10,$L$30:$L$${29 + data.HERO_MAX_LEVEL},1))`);
  set('广告成长对照', `${no}17`, '=100');
  set('广告成长对照', `${full}17`, `=ROUND(AVERAGE(${full}9/${no}9,${full}11/${no}11)*100,0)`);
  for (let row = 7; row <= 17; row++) set('广告成长对照', `${ratio}${row}`, `=IFERROR(${full}${row}/${no}${row},0)`);
}
sheets['广告成长对照'].getRange('K29:L29').values = [['主角等级', '累计等价胜局']];
sheets['广告成长对照'].getRange('K29:L29').format = { fill: color.header, font: { bold: true, color: '#FFFFFF' }, wrapText: true, rowHeight: 36 };
let cumulativeHeroWins = 0;
const heroCurve = [];
for (let level = 1; level <= data.HERO_MAX_LEVEL; level++) {
  heroCurve.push([level, cumulativeHeroWins]);
  cumulativeHeroWins += data.HERO_EXP_TABLE[level - 1] / (data.STAMINA_COST_PER_LEVEL * data.HERO_EXP_PER_STAMINA * level);
}
block('广告成长对照', 30, heroCurve, 11);
sheets['广告成长对照'].getRange('B7:J17').format.font.color = color.formula;
sheets['广告成长对照'].getRange('D7:D17').format.fill = color.pale;
sheets['广告成长对照'].getRange('G7:G17').format.fill = color.pale;
sheets['广告成长对照'].getRange('J7:J17').format.fill = color.pale;
formats('广告成长对照', ['D7:D17', 'G7:G17', 'J7:J17'], '0.00x');
formats('广告成长对照', ['B11:C11', 'E11:F11', 'H11:I11'], '#,##0.0');
sheets['广告成长对照'].getRange('A7:K17').format = { wrapText: true, rowHeight: 38 };
sheets['广告成长对照'].getRange('K30:L179').format.font.color = color.gray;
widths('广告成长对照', [28, 18, 18, 13, 18, 18, 13, 18, 18, 13, 72, 18]);

title('问题与建议', '17｜当前问题、候选调整与验证', '不把模型结果当作真实玩家留存。候选仅用于对照；改动需单独接入工程并经过实战回放、分层用户数据验证。', 6, 26);
header('问题与建议',6,['优先级','当前事实','体验风险','本表候选/建议','验证方法','证据']);
const issues=[
 ['已确认','自然恢复80体力/日，元宝与广告补给各60','稳定约20局/日，按3分钟约60分钟；剩余时间由养成、挑战与军报承接','维持18分钟恢复1点，不用体力无限堆局数','分别观察不看广告/常规IAA/高活跃群体实际在线时间','const STAMINA_REGEN_INTERVAL'],
 ['P0','每波怪物数随关卡增加1.15只，无封顶','900关仅出怪已接近98分钟，900关不是一个月可玩的证据','候选数量斜率0.12、单波封顶18；再用HP/机制而非数量承接后期难度','实测P50/P80通关时长，主线目标约3分钟，Boss战单独统计','function startWave'],
 ['已处理','商店与打造弹窗统一为1元宝=2强化石=0.2升星石','材料兑换只用于补缺口，不再压过关卡和任务投放','继续观察元宝兑换率与材料缺口，不建议再上调汇率','逐入口检查实际扣费、货币显示、失败回滚','function showShop'],
 ['已确认','普通首通三档宝箱合计300元宝，挑战宝箱为3倍，重复通关不再产出','首通元宝高，必须由体力、突破和材料兑换持续回收','保持固定宝箱值；模型加入阶段突破与第7天后材料兑换预算','用广告成长对照与30天收支比较货币库存','const STAGE_CHEST_META'],
 ['已处理','军报品质只加0～1档，元宝15～40','免费事件仍有吸引力，但不再大幅跳过品质追求','继续限制每日曝光与高品质首次出现时间','模拟首次红/金、三武将套装P50/P80/P95达成天数','function settleBeastRaid'],
 ['需数据','121关后金装直接掉落率0.05%','主线金装保持稀有，主要追求来自长期合成与军报','上线后按首金P50/P80与三武将品质分布再校准','全来源蒙特卡洛模拟与90分钟行为模型联测','const EQUIPMENT_DROP_TABLES'],
 ['已处理','关卡与每日任务材料约为旧版40%至55%，初始材料同步下调','前2天仍可完成基础强化，后续需要在强化与升星之间选择','第7天后允许用首通元宝补材料，缺口控制为可追赶状态','检查首2日净产出、7/14/30日库存与兑换占比','const FORGE_ECONOMY'],
 ['已处理','升星成功率改为1～3星100%，4～5星80%，之后分档下降至15%','低星体验稳定，高星仍保留长期追求和资源消耗','监测每星平均尝试次数与连续失败退出率','边界3/4/5、10/11、20/21、25/26逐项测试','const FORGE_STAR_RATES'],
 ['P1','Boss配置写5倍，实际生成代码使用4倍×重甲1.7','只改BOSS_CONFIG不会改变Boss真实HP','本表按4倍还原，候选5倍；工程应统一到单一配置','对比实际出生HP与波次预览','function spawnMonster'],
 ['P1','第1关总怪物33只，6次卡牌累计需94次击杀','短关无法提供6次，后期长关则全挤在前段','建议按波次进度或总怪物百分比设卡牌阈值，短关明确只给3次','统计每次选卡距开局时间与Boss前覆盖率','const CARD_KILL_STEPS'],
 ['P1','怪物HP基础项×线性难度，呈二次增长','固定/线性养成未必跟得上；可能被百分比大招完全绕过','候选降低HP斜率，Boss增加技能而非单纯堆血；大招按Boss抗性单独结算','比较DPS/入场HP、各技能伤害占比、漏怪与防线损伤','function startWave'],
 ['P1','高阶技能可对全场造成130%/160%最大HP伤害','包含Boss时可能一键跳过所有血量成长','保留最低固定伤害并继续观察高关Boss的跳过率','全技能对Boss回归测试；记录击杀来源','const HERO_SKILLS'],
 ['P1','awardHeroExp自动越过10级，loadProgress按突破阶限制等级','未突破时可能重载后等级回退','统一升级门槛与存档加载规则；此次只登记，不改代码','9→10→11级不突破保存重载，检查等级/经验/最大HP','function awardHeroExp'],
 ['P2','强化上限max(主角等级,最高解锁关卡)×2','不是文档中的单纯角色等级×2；后期上限很高','先确认是否保留关卡拉升上限，本表列出到300级预算','校验空槽强化生效、装备卸下、大师加成与上限','function forgeEnhanceCap'],
 ['P2','所有怪物闪避100、韧性0；武将基础命中100','命中装备当前几乎没有边际作用；暴击每点仅0.005个百分点','分章节给少量高闪避/韧性怪，保留大部分命中稳定的爽感','战斗压力表与实战命中率、暴击率、反馈字样对比','const MONSTER_PROFILES'],
 ['P2','体力显示满60，自然恢复实际到500；广告无需先买','与早期需求存在差异，应先统一规则与文案','本表还原现状，是否改回60停恢复需另确认','测试59/60/499/500与跨自然日重置','function refreshStamina'],
 ['P2','军报是在线概率事件，保底一天1次不是最多1次','把每天1军报当确定供给会低估波动','每日计划保留显式假设；分别测0/1/2次和参与率','事件曝光、过期率、参加率、失败奖励利用率','const ARMY_REPORT_CONFIG'],
 ['已处理','主角经验按等价胜局分段增长，技能按等级解锁，结算广告同步补发经验','零广告可稳定成长，看满广告会更早达到技能等级门槛','用第1/7/30/90天主角等级与技能解锁率继续校准','广告成长对照页检查30/90/180天等级差异','const HERO_EXP_TABLE'],
 ['P2','30天模型按代表关卡+群体胜率预算，不执行实时战斗','不能承诺80%玩家留存30天或半年追求精确达成','接入逐局分布、装备部位蒙特卡洛、真实广告完成率后再定量','至少记录关卡、时长、失败波、广告完成、收支、背包变化','const LEVEL_CONTENT_COUNT'],
];
block('问题与建议',7,issues.map(row=>[...row.slice(0,5),sourceAt(row[5])]));
sheets['问题与建议'].getRange(`A7:F${issues.length+6}`).format={wrapText:true,rowHeight:86};
widths('问题与建议',[13,58,66,72,72,58]);

console.log('Audit and catalogue ready');

block('装备掉落',44,[['单武将全套金装胜局', '=IF(B40=0,0,B39/(B38*B40))', '只算本关主线直接掉落；未含军报/合成、之前品质突破所需装备'],['参考每日胜局', "=AVERAGE('30天收支'!B22:AE22)", '30天计划平均，不等于所有用户每天固定局数'],['单武将金套天数估计','=IF(OR(B40=0,B45=0),0,B44/B45)','0表示本区间不可直接获取；换关概率不同，不能解读为实际成长周期']]);
for(const row of [38,39,40,41,42,44,45,46]) {
  sheets['装备掉落'].getRange(`C${row}:J${row}`).merge();
  sheets['装备掉落'].getRange(`A${row}:J${row}`).format={wrapText:true,rowHeight:42};
}

header('使用说明',7,['核心指标','采用结果','单位/含义']);
const overview=[
 ['理论每日自然恢复',`=1440/${ref('staminaMinutes')}`,'体力/日，满500时不再恢复'],
 ['稳定体力支持局数',`=ROUNDDOWN((B8+${ref('staminaRefill')}*(${ref('staminaBuyLimit')}+${ref('staminaAdLimit')}))/${ref('staminaCost')},0)`,'局/日，假设两次补给都完成'],
 ['第1天主线计划',"='30天收支'!B21",'局，含时间及体力约束'],
 ['30天主线合计',"=SUM('30天收支'!B21:AE21)",'局，不含军报'],
 ['第30天解锁关卡',"='30天收支'!AE25",'期望值，不是80%用户可达承诺'],
 ['第1天强化石净产出',"='30天收支'!B84",'个，未含初始赠送'],
 ['第2天强化石净产出',"='30天收支'!C84",'个，产出减计划消耗'],
 ['第1天升星石净产出',"='30天收支'!B94",'个，按成功率折算期望消耗'],
 ['第2天升星石净产出',"='30天收支'!C94",'个，按成功率折算期望消耗'],
 ['第30天强化石库存',"='30天收支'!AE83",'负数表示计划缺口'],
 ['第30天升星石库存',"='30天收支'!AE93",'负数表示计划缺口'],
 ['第30天金币库存',"='30天收支'!AE60",'负数表示需要兑换/降低目标'],
 ['第30天元宝库存',"='30天收支'!AE74",'检查投放是否远超消费'],
 ['所选关仅出怪时间',`=VLOOKUP(B5,'关卡总表'!$A$7:$AY$${stageEnd},12,FALSE)`,'分钟，未含操作/选卡/广告'],
 ['所选关最多卡牌',`=VLOOKUP(B5,'关卡总表'!$A$7:$AY$${stageEnd},22,FALSE)`,'全击杀上限，不保证必触发'],
 ['所选关金套天数',"='装备掉落'!B46",'仅主线直接掉落，0表示不投放'],
];
block('使用说明',8,overview);
for(let row=7;row<=23;row++) sheets['使用说明'].getRange(`C${row}:E${row}`).merge();
sheets['使用说明'].getRange('A8:E23').format={wrapText:true,rowHeight:32};
sheets['使用说明'].getRange('B8:B23').format.font.color=color.formula;
sheets['使用说明'].getRange('B13:B19').conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:color.alert,font:{color:'#A52222'}}});
const guide=[
 '使用顺序：B4先选0核对现状，再选1编辑黄色试算值。灰色工程快照请保留。',
 '调资源：经济参数、材料与任务、商店与兑换、装备品质/掉落、强化/升星消耗。',
 '调关卡：难度参数控制总曲线；关卡总表E～G覆盖单关；章节与怪物调整出场及对抗属性。',
 '调体验：每日计划改在线时长、广告参与、胜率、养成目标，再查看30天收支与负数缺口。',
 '黄色为人工输入，绿色为公式，灰色为来源快照；概率填0～1，攻速值填百分数（6代表6%）。',
 '每日模型按代表关卡估计，非逐局仿真；合成与突破默认0，开启后还需校验同品质背包与等级门槛。',
 '材料前两日富余是按本表低目标试算；改目标/参与广告/军报次数后可能改变。',
 '表格尚未与游戏热加载配置连接。Excel调整不自动写回app.js，当前游戏数值没有改动。',
 '实际留存与半年追求需用玩家分布验证，不能从900关数量或单一平均值直接保证。',
 '来源：当前工程app.js，提取日期2026-09-21。旧设计文档只作背景，本表以生效代码为准。',
];
guide.forEach((text,index)=>{const row=index+26;sheets['使用说明'].getRange(`A${row}:E${row}`).merge();set('使用说明',`A${row}`,text);sheets['使用说明'].getRange(`A${row}:E${row}`).format={wrapText:true,rowHeight:43};});
sheets['使用说明'].getRange('A39:J39').merge();set('使用说明','A39',`工程快照SHA-256：${sourceHash}`);
sheets['使用说明'].getRange('A40:J40').merge();set('使用说明','A40','产销全景：完整渠道清单；问题与建议：代码现状、候选方案、验证口径。右侧为逐日计划结果，库存负数表示缺口。源代码更新后需要重新提取。');
sheets['使用说明'].getRange('A40:J40').format={wrapText:true,rowHeight:34};
block('使用说明',7,[['天数','关卡进度','金币期末','强化石期末','升星石期末']],6);
sheets['使用说明'].getRange('F7:J7').format={fill:color.header,font:{bold:true,color:'#FFFFFF'},wrapText:true};
block('使用说明',8,Array.from({length:30},(_,index)=>[index+1,`='30天收支'!${col(index+2)}25`,`='30天收支'!${col(index+2)}60`,`='30天收支'!${col(index+2)}83`,`='30天收支'!${col(index+2)}93`]),6);
formats('使用说明',['F8:F37','H8:J37'],'#,##0;[Red]-#,##0;0');
sheets['使用说明'].getRange('F8:J37').format.font.color=color.formula;
sheets['使用说明'].getRange('I8:J37').conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:color.alert,font:{color:'#A52222'}}});
bounds['使用说明'].endRow=40;
widths('使用说明',[31,21,18,18,18,17,17,17,17,17]);

for(const key of ['staminaMinutes','staminaCost','spawnSeconds','moveSeconds','tickSeconds','gameSpeed','bossSkill','raidBossEvery',...['shopEnh','shopStar','shopGold','forgeEnh','forgeStar'].map(kind=>`${kind}Price`)]) {
  const entry=parameterRows[key];input(entry.name,`D${entry.row}`,0.001,100000);
}
for(const key of ['minWaves','maxWaves']) {const entry=parameterRows[key];input(entry.name,`D${entry.row}`,1,7,true);}
input('难度参数',`D${parameterRows.raidWaves.row}`,1,10,true);
for(const key of ['dropPity','staminaBuyLimit','staminaAdLimit']) {const entry=parameterRows[key];input(entry.name,`D${entry.row}`,0,100,true);}
for(let quality=1;quality<=6;quality++){const entry=parameterRows[`qsynthRate${quality}`];input(entry.name,`D${entry.row}`,0.001,1);}
for(const name of sheetNames){
  const bound=bounds[name];
  sheets[name].getRange(`A1:${col(bound.width)}${bound.endRow}`).format.font.name='Microsoft YaHei';
  sheets[name].getRange(`A1:${col(bound.width)}${bound.endRow}`).format.font.size=10;
  sheets[name].getRange('A1').format.font.size=18;
  sheets[name].getRange(`A1:${col(bound.width)}${bound.endRow}`).format.verticalAlignment='center';
  if(name!=='使用说明'){
    set(name,'A4','采用方案');set(name,'B4',"=IF('使用说明'!$B$4=0,\"工程当前\",\"调优试算\")");
    sheets[name].getRange('B4:D4').merge();
  }
  sheets[name].tabColor=['使用说明','广告成长对照','30天收支','关卡总表','战斗压力'].includes(name)?'#176E73':name==='问题与建议'?'#B35B36':'#8B9C9F';
}
formats('难度参数',[`C${parameterRows.countCap.row}:E${parameterRows.countCap.row}`],'#,##0');
formats('经济参数',[`C${parameterRows.yuanCap.row}:E${parameterRows.yuanCap.row}`],'#,##0');
formats('强化消耗',['A19:C318'],'#,##0');
formats('升星消耗',['A19:C48'],'#,##0');
formats('装备掉落',['B38','B40'],'0.00%');
set('战斗压力','A23','棋盘数量校验');set('战斗压力','B23','=IF(SUM(B7:B9)>36,"超过棋盘36格","数量有效")');
sheets['战斗压力'].getRange('B23:D23').merge();
set('主角与技能','A26','经验曲线已按等价胜局重算：前期快速解锁技能，60级后逐步拉长；结算广告同步补发一份经验。');
sheets['主角与技能'].getRange('A26:J26').merge();

wb.recalculate();
const value=(name,address)=>sheets[name].getRange(address).values[0][0];
const tests=[];
function close(actual,expected,label){assert.equal(typeof actual,'number',`${label}: not numeric ${actual}`);assert(Math.abs(actual-expected)<Math.max(1e-7,Math.abs(expected)*1e-10),`${label}: ${actual} != ${expected}`);tests.push(label);}
for(const level of [1,3,4,7,14,15,35,36,120,121,900]){
  const row=level+6,rounds=context.getRoundsForLevel(level);
  const actual=context.snapshot.state;actual.level=level;actual.round=rounds;actual.maxRounds=rounds;
  let count=0,totalHp=0,gold=0,bossHp=0;
  for(let wave=1;wave<=rounds;wave++){
    const waveCount=Math.max(2,Math.round(data.LEVEL_SCALING.monsterTotalBase*Math.pow(level,data.LEVEL_SCALING.monsterTotalPower)/rounds*(.85+.3*(wave-1)/Math.max(1,rounds-1))));
    const lateHp=Math.min(data.LEVEL_SCALING.lateHpCap,1+Math.max(0,level-data.LEVEL_SCALING.lateHpStart)*data.LEVEL_SCALING.lateHpPerLevel);
    const base=Math.round(data.LEVEL_SCALING.hpBase*Math.pow(level,data.LEVEL_SCALING.hpPower)*lateHp*(36+wave*7)/(36+7*(rounds+1)/2));
    const profile=data.MONSTER_PROFILES[context.getWaveProfile(level,wave)],boss=wave===rounds;
    count+=waveCount;totalHp+=(waveCount-Number(boss))*Math.round(base*profile.hp)+(boss?Math.round(base*4*data.MONSTER_PROFILES.brute.hp):0);
    gold+=(waveCount-Number(boss))*profile.reward+(boss?data.BOSS_CONFIG.reward:0);
    if(boss)bossHp=Math.round(base*4*data.MONSTER_PROFILES.brute.hp);
  }
  for(const [column,expected] of [['D',rounds],['H',count],['I',totalHp],['J',bossHp],['K',gold],['N',context.getFullLevelReward()],['O',context.getFullYuanbaoReward()],['P',context.getFullForgeMaterialReward().enhance],['Q',context.getFullForgeMaterialReward().star]])close(value('关卡总表',`${column}${row}`),expected,`stage-${level}-${column}`);
}
for(const [name,maxLevel,costFunction] of [['强化消耗',300,'forgeEnhanceCost'],['升星消耗',30,'forgeStarCost']])for(let level=1;level<=maxLevel;level++){
  const cost=context[costFunction](level-1);close(value(name,`B${level+18}`),cost.stone,`${name}-${level}-stone`);close(value(name,`C${level+18}`),cost.gold,`${name}-${level}-gold`);
  if(name==='升星消耗')close(value(name,`F${level+18}`),context.forgeStarRate(level-1),`star-${level}-rate`);
}
for(let day=1;day<=30;day++){
  const column=col(day+1),get=row=>value('30天收支',`${column}${row}`);
  for(const [opening,income,cost,closing] of [[44,55,59,60],[62,68,73,74],[76,81,82,83],[86,91,92,93]])close(get(closing),get(opening)+get(income)-get(cost),`day-${day}-balance-${closing}`);
  assert(get(28)<=value('每日计划',`${column}7`)+.00001,`time budget day ${day}`);
  const expectedRaidCount=Array.from({length:10},(_,index)=>6+(index+1)*2+Math.ceil(get(7)*1.15)).reduce((total,count)=>total+count,0);
  close(get(112),expectedRaidCount,`day-${day}-raid-count`);
  assert(get(114)>=get(113),'Raid time must include configured spawns');
}
assert(value('广告成长对照','C7')>value('广告成长对照','B7'),'Full-ad players must have more daily runs');
assert(value('广告成长对照','C11')/value('广告成长对照','B11')>=2,'Full-ad equipment pace must be at least 2x');
assert(value('广告成长对照','C16')>value('广告成长对照','B16'),'Full-ad hero level must lead at day 30');
const currentSummary=sheets['使用说明'].getRange('A8:C23').values;
const currentStage900=value('关卡总表','H906');
set('使用说明','B4',1);wb.recalculate();
assert(value('关卡总表','H906')<currentStage900,'Scenario switch must reduce stage900 count');
close(value('经济参数',`E${parameterRows.staminaMinutes.row}`),18,'candidate-stamina');
close(value('升星消耗','F39'),.2,'candidate-star21');
const candidateSummary=sheets['使用说明'].getRange('A8:C23').values;
const dropEntry=parameterRows.dropChance;
set(dropEntry.name,`D${dropEntry.row}`,0);wb.recalculate();close(value('装备掉落','B38'),.25,'zero-drop-probability-pity');set(dropEntry.name,`D${dropEntry.row}`,data.EQUIPMENT_DROP_CHANCE);
set('每日计划','AE7',10000);wb.recalculate();assert(value('30天收支','AE25')<=900,'Model progress capped at covered content');assert(value('30天收支','AE24')<=900,'No duplicated new stage rewards');set('每日计划','AE7',90);
const beforeIncome=value('30天收支','AE80'),beforeEnhanceBudget=value('每日计划','AE42');set('每日计划','AE42',beforeEnhanceBudget+10);wb.recalculate();assert(value('30天收支','AE80')>beforeIncome,'later-day editable budget recalculates');set('每日计划','AE42',beforeEnhanceBudget);
set('关卡总表','E7',2);wb.recalculate();const doubledHp=value('关卡总表','J7');set('关卡总表','E7',1);wb.recalculate();assert(doubledHp>value('关卡总表','J7'),'single-stage HP override');
set('使用说明','B4',0);wb.recalculate();
set('关卡总表','E7',2);wb.recalculate();
const reorderedBossExpected=value('波次预览','H9');
const reorderedRewardExpected=value('30天收支','B32');
set('关卡总表','A7',2);set('关卡总表','A8',1);set('关卡总表','E7',1);set('关卡总表','E8',2);wb.recalculate();
close(value('波次预览','H9'),reorderedBossExpected,'level-key-lookup-after-row-reorder');
close(value('30天收支','B32'),reorderedRewardExpected,'reward-key-lookup-after-row-reorder');
set('关卡总表','A7',1);set('关卡总表','A8',2);set('关卡总表','E7',1);set('关卡总表','E8',1);wb.recalculate();
assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(root,'app.js'))).digest('hex'),sourceHash,'Source changed during workbook build');
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:50},summary:'Formula error scan',maxChars:12000});
console.log('ERROR_SCAN',errors.ndjson);
for(const name of sheetNames){
  const bound=bounds[name];
  for(const row of sheets[name].getRange(`A1:${col(bound.width)}${bound.endRow}`).values) for(const item of row) assert(!(/^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/.test(String(item))),`${name}: ${item}`);
}
await fs.writeFile(path.join(import.meta.dirname,'qa.json'),JSON.stringify({sourceHash,checks:tests.length,currentSummary,candidateSummary,errorScan:errors.ndjson},null,2));
console.log('QA checks:',tests.length);
const previewRanges={
 '使用说明':'A1:J40','广告成长对照':'A1:K18','经济参数':'A1:H13','材料与任务':'A1:H13','商店与兑换':'A20:H28','装备品质':`A${gearRow}:I${gearRow+6}`,'装备掉落':'A28:J46','强化消耗':'A18:L27','升星消耗':'A35:L45','难度参数':'A1:H13','章节与怪物':'A30:K37','关卡总表':'A1:M14','波次预览':'A1:O16','战斗压力':'A1:P23','每日计划':'A6:H18','30天收支':'A76:H94','产销全景':'A1:G12','主角与技能':'A1:J12','问题与建议':'A1:F11',
};
for(const [name,range] of Object.entries(previewRanges)){
  if(process.argv.includes('--final-pass')&&!['使用说明','广告成长对照','装备掉落','30天收支','每日计划','产销全景'].includes(name))continue;
  const preview=await wb.render({sheetName:name,range,scale:1,format:'png'});
  await fs.writeFile(path.join(previewDir,`${name}.png`),new Uint8Array(await preview.arrayBuffer()));
  console.log('Rendered',name);
}
const output=await SpreadsheetFile.exportXlsx(wb);
const outputPath=path.join(outputDir,'合战守格_产销与关卡调优.xlsx');
await output.save(outputPath);
console.log('EXPORTED',outputPath);
