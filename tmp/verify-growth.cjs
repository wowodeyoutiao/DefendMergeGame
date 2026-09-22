const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const storage = new Map();
const element = () => ({
  classList: { add() {}, remove() {}, toggle() {} },
  style: { setProperty() {} },
  appendChild() {}, replaceChildren() {}, remove() {},
  querySelector: element, querySelectorAll: () => [],
  setAttribute() {}, getAttribute() {}, dataset: {},
});
const context = vm.createContext({
  console, document: { getElementById: element, querySelector: element, createElement: element },
  localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  setTimeout: () => 0, clearInterval() {}, requestAnimationFrame() {},
});
vm.runInContext(source.slice(0, source.indexOf('startWaveBtn.addEventListener')), context);
vm.runInContext(`
  renderHud = renderMonsters = renderBoard = render = hideModal = () => {};
  damageBurstAtMonster = burstAt = triggerWarriorAttack = attackEffectAt = () => {};
  let modalActionsForTest = [];
  showModal = (title, body, actions) => { modalActionsForTest = actions; };
`, context);
const run = (script) => vm.runInContext(script, context);
const check = (script, expected, label) => assert.equal(run(script), expected, label);

check('upgradeHero()', false, 'insufficient gold');
run('state.gold = 100000; state.yuanbao = 100000;');
for (let level = 1; level < 40; level += 1) {
  if (level % 10 === 0) {
    check('upgradeHero()', false, 'level gate');
    const before = run('state.yuanbao');
    const cost = run('getHeroBreakthroughCost()');
    check('breakthroughHero()', true, 'breakthrough');
    check('state.yuanbao', before - cost, 'breakthrough debit');
    check('getUnlockedHeroSkills().length', level / 10 + 1, 'one skill per breakthrough');
    check('breakthroughHero()', false, 'no duplicate breakthrough');
  }
  check('upgradeHero()', true, 'upgrade');
  check('state.maxHp', 4 + level, 'exactly one HP per level');
  check('state.heroLevel', level + 1, 'level increment');
}
check('upgradeHero()', false, 'MVP level cap');
check('breakthroughHero()', true, 'level 40 still unlocks its skill');
check('getUnlockedHeroSkills().length', 5, 'five total skills');
check('breakthroughHero()', false, 'final breakthrough not repeatable');
run('state.heroLevel = 10; state.heroBreakthrough = 0; state.yuanbao = 79;');
check('breakthroughHero()', false, 'insufficient yuanbao');
run('state.yuanbao = 80; state.levelStaminaSpent = true;');
check('upgradeHero()', false, 'home cannot upgrade active run');
check('breakthroughHero()', false, 'home cannot break active run');
run('state.phase = "settle";');
check('breakthroughHero()', true, 'settlement permits growth');

run('currentView = "battle"; state.heroLevel = 40; state.heroBreakthrough = 4; resetGame();');
check('state.heroSkillIndex', 0, 'new run starts first skill');
check('state.heroSkillCooldowns.meteor', 0, 'first skill starts ready');
check('state.heroSkillCooldowns["sacred-ward"]', 0, 'skills start ready');
run('state.phase = "combat"; state.cardsOffered = 6; state.waveConfig = {count:100,hp:100,interval:1000,killed:0}; state.board = [];');
run('tick(0.1)');
check('state.heroSkillCooldowns.meteor', 0, 'ready skill stays ready before cast');
run('state.phase = "card"; tick(2)');
check('state.heroSkillCooldowns.meteor', 0, 'card pause freezes skill');
run('releaseHeroSkill()');
check('state.heroSkillIndex', 0, 'cannot release during pause');
run('state.phase = "combat"; HERO_SKILLS.forEach(skill => { state.heroSkillCooldowns[skill.id] = 0; }); state.monsters = [{id:1,c:0,y:0,hp:1000,maxHp:1000,rootRemaining:0,reward:18}];');
run('releaseHeroSkill()');
check('state.monsters[0].hp', 700, 'smash damage');
check('state.monsters[0].rootRemaining', 1.5, 'smash root');
check('getCurrentHeroSkill().id', 'shadow-lock', 'ordered next skill');
run('releaseHeroSkill()');
check('state.monsters[0].hp', 700, 'root skill does no damage');
check('state.monsters[0].rootRemaining', 5, 'root duration');
run('releaseHeroSkill()');
check('state.monsters[0].hp', 250, 'wind damage');
run('state.hp = state.maxHp - 2; releaseHeroSkill()');
check('state.hp', run('state.maxHp - 1'), 'ward heals one');
run('releaseHeroSkill()');
check('state.heroRallyRemaining', 8, 'rally duration');
check('getCurrentHeroSkill().id', 'meteor', 'wrap order');
run('releaseHeroSkill()');
check('state.monsters[0].hp', 250, 'cooldown blocks repeated cast');
run('state.heroRallyRemaining = 8; state.board = [{type:"sword",tier:1,attackCooldown:0}]; attackMonsters(0.1);');
check('state.monsters[0].hp', 235, 'rally damage multiplier');
check('state.board[0].attackCooldown', 0.8 / 1.35, 'rally attack speed');
run('state.phase = "card"; tick(9)');
check('state.heroRallyRemaining', 8, 'rally freezes during card');
run('state.phase = "combat"; state.board = []; tick(9);');
check('state.heroRallyRemaining', 0, 'rally expires');
run('resetGame();');
check('state.heroRallyRemaining', 0, 'new run clears rally');

run('state.phase = "settle"; state.gold = 1000; state.yuanbao = 300; state.level = 1; state.maxRounds = 3; state.round = 1; showDefeat();');
check('state.gold', 1025, 'failure coin formula');
check('state.yuanbao', 305, 'failure yuanbao formula');
run('showDefeat();');
check('state.gold', 1025, 'failure reward idempotent');
run('showVictory();');
check('state.gold', 1125, 'victory only pays difference');
check('state.yuanbao', 325, 'victory yuanbao only pays difference');
run('showVictory(); modalActionsForTest[0].onClick();');
check('state.gold', 1250, 'double only this level, after reopening');
check('state.yuanbao', 350, 'double yuanbao only this level');
run('showVictory();');
check('state.gold', 1250, 'double not repeatable');
run('state.heroLevel = 20; state.heroBreakthrough = 2; saveProgress(); state.heroLevel = 1; state.gold = 0; loadProgress();');
check('state.heroLevel', 20, 'saved level restores');
check('state.heroBreakthrough', 2, 'saved breakthrough restores');
check('state.gold', 1250, 'saved wallet restores');
check('state.maxHp', 23, 'HP derives from restored level');
run('localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({heroLevel:40,heroBreakthrough:0,gold:-10})); loadProgress();');
check('state.heroLevel', 10, 'malformed progress cannot skip gate');
check('state.gold', 0, 'invalid wallet clamped');

console.log('PASS: levels 1-40, four breakthroughs, five skills, CDs, pause, rewards and saved progress.');
