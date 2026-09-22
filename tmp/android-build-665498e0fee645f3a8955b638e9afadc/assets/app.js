const ASSET = "./public/assets/";
const DAMAGE_GLYPHS = Object.fromEntries([
  ...Array.from({ length: 10 }, (_, digit) => [String(digit), `ui/fonts/monster-damage/${digit}.png`]),
  ["-", "ui/fonts/monster-damage/minus.png"],
  ["+", "ui/fonts/monster-damage/plus.png"],
]);
const BOARD_SIZE = 6;
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
const STAMINA_PURCHASE_COST = 200;
const STAMINA_REGEN_INTERVAL = 18 * 60 * 1000;
const HERO_MAX_LEVEL = 40;
const HERO_LEVEL_COST_BASE = 80;
const HERO_LEVEL_COST_STEP = 20;
const HERO_BREAKTHROUGH_COST = 80;
const PROGRESS_STORAGE_KEY = "defend-merge-progress-v1";
const MAX_PIECE_TIER = 4;
const HERO_SKILLS = [
  {
    id: "meteor",
    name: "裂地重击",
    breakthrough: 0,
    cooldown: 18,
    description: "全场造成最大生命 30% 伤害（至少 55 点），禁锢 1.5 秒。",
    icon: "ui/skills/skill-smash.png",
  },
  {
    id: "shadow-lock",
    name: "幽影禁锢",
    breakthrough: 1,
    cooldown: 24,
    description: "全场怪物禁锢 5 秒，不造成伤害。",
    icon: "ui/skills/skill-shadow.png",
  },
  {
    id: "whirlwind",
    name: "青风横扫",
    breakthrough: 2,
    cooldown: 20,
    description: "全场造成最大生命 45% 伤害（至少 80 点），禁锢 1 秒。",
    icon: "ui/skills/skill-wind.png",
  },
  {
    id: "sacred-ward",
    name: "圣光护城",
    breakthrough: 3,
    cooldown: 32,
    description: "恢复 1 点防线，并禁锢怪物 2 秒。",
    icon: "ui/skills/skill-ward.png",
  },
  {
    id: "battle-drum",
    name: "破阵战鼓",
    breakthrough: 4,
    cooldown: 28,
    description: "全体武将伤害 +50%、攻速 +35%，持续 8 秒。",
    icon: "ui/theme/buff-war-cry.png",
  },
];
const HOME_STAGE_NAMES = ["荒骨峡谷", "风蚀前哨", "赤沙营地", "遗迹回廊", "龙骨隘口", "落日高台"];
const HOME_STAGE_ENEMIES = [
  "monsters/round-1-monster.gif",
  "monsters/round-2-monster.gif",
  "monsters/round-3-monster.gif",
];
const HOME_CHEST_OPEN = "./public/assets/home/reward-chest.png";
const HOME_CHEST_LOCKED = "./public/assets/home/reward-chest-locked.png";
const WARRIORS = [
  {
    type: "sword",
    name: "红剑",
    idleImage: "warriors/warrior-idle-transparent.gif",
    attackImage: "warriors/warrior-skill-transparent.gif",
  },
  {
    type: "fan",
    name: "羽扇",
    idleImage: "warriors/mage-idle-transparent.gif",
    attackImage: "warriors/mage-skill-transparent.gif",
  },
  {
    type: "rock",
    name: "岩甲",
    idleImage: "warriors/priest-idle-transparent.gif",
    attackImage: "warriors/priest-skill-transparent.gif",
  },
];

const TYPES = {
  sword: {
    name: "红剑",
    desc: "等级提升同列射程、攻击力与攻速",
    icon: "icon-sword.png",
    kind: "unit",
    color: "#cf3d2c",
    dps: 10,
  },
  fan: {
    name: "羽扇",
    desc: "等级提升同行射程、攻击力与攻速",
    icon: "icon-fan.png",
    kind: "unit",
    color: "#3c8f74",
    dps: 8,
  },
  rock: {
    name: "岩甲",
    desc: "攻击与控制半径 0.5/1/1.5/2 格",
    icon: "icon-rock.png",
    kind: "unit",
    color: "#5676aa",
    dps: 7,
  },
  gourd: {
    name: "葫芦",
    desc: "消除时回复防线",
    icon: "icon-revive.png",
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
    icon: "icon-chest.png",
    kind: "item",
    color: "#c7952c",
    dps: 0,
  },
  trap: {
    name: "陷阱",
    desc: "消除数量决定禁锢时长",
    icon: "icon-trap.png",
    kind: "device",
    color: "#3f9b53",
    dps: 0,
  },
  mine: {
    name: "地雷",
    desc: "消除数量决定触发伤害",
    icon: "icon-mine.png",
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
  levelStaminaSpent: false,
  heroLevel: 1,
  heroBreakthrough: 0,
  yuanbao: 0,
  heroSkillIndex: 0,
  heroRallyRemaining: 0,
  heroSkillCooldowns: Object.fromEntries(HERO_SKILLS.map((skill) => [skill.id, 0])),
  rewardGranted: 0,
  paidReward: 0,
  paidYuanbao: 0,
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
const resetBtn = document.getElementById("resetBtn");
const homeScreen = document.getElementById("homeScreen");
const gameScreen = document.getElementById("gameScreen");
const homeGoldText = document.getElementById("homeGoldText");
const homeYuanbaoText = document.getElementById("homeYuanbaoText");
const homeStaminaText = document.getElementById("homeStaminaText");
const homeGrowthText = document.getElementById("homeGrowthText");
const homeLevelText = document.getElementById("homeLevelText");
const homeStageName = document.getElementById("homeStageName");
const homeRecordText = document.getElementById("homeRecordText");
const homeEnemy = document.getElementById("homeEnemy");
const homeRewardRow = document.getElementById("homeRewardRow");
const homeStartBtn = document.getElementById("homeStartBtn");
const homeStaminaBtn = document.getElementById("homeStaminaBtn");
const homePrevLevelBtn = document.getElementById("homePrevLevelBtn");
const homeNextLevelBtn = document.getElementById("homeNextLevelBtn");
const homeStageFocus = document.querySelector(".home-stage-focus");
const homeStageCast = document.querySelector(".home-stage-cast");
const battleHomeBtn = document.getElementById("battleHomeBtn");
const legend = document.getElementById("legend");
const modal = document.getElementById("modal");
const modalCard = document.querySelector(".modal-card");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalActions = document.getElementById("modalActions");
const modalArt = document.getElementById("modalArt");
const modalDetail = document.getElementById("modalDetail");
let currentView = "home";
let lastSavedProgress = "";
let progressStorageUnavailable = false;

function saveProgress() {
  if (progressStorageUnavailable) return;
  const progress = JSON.stringify({
    heroLevel: state.heroLevel,
    heroBreakthrough: state.heroBreakthrough,
    gold: state.gold,
    yuanbao: state.yuanbao,
    highestUnlockedLevel: state.highestUnlockedLevel,
    stamina: state.stamina,
    staminaLastRegenAt: state.staminaLastRegenAt,
    staminaRefillDate: state.staminaRefillDate,
    staminaPurchaseUsed: state.staminaPurchaseUsed,
    staminaAdUsed: state.staminaAdUsed,
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
      state.staminaAdUsed = state.staminaPurchaseUsed && progress.staminaAdUsed === true;
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

function getRoundsForLevel(level) {
  return Math.min(7, Math.max(3, level));
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
      const warrior = WARRIORS.find(({ type: warriorType }) => warriorType === piece.type);
      const item = document.createElement("div");
      item.className = `piece tier-${level}${warrior ? " warrior-piece" : ""}`;
      item.dataset.type = piece.type;
      item.dataset.level = String(level);
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
        <img src="${ASSET}${warrior ? warrior.idleImage : type.icon}" alt="${type.name}"${warrior ? ' data-action="idle"' : ""} />
      `;
      item.style.boxShadow = `inset 0 0 0 2px ${type.color}66`;
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
}

function getHeroLevelCost() {
  return HERO_LEVEL_COST_BASE + (state.heroLevel - 1) * HERO_LEVEL_COST_STEP;
}

function getHeroBreakthroughCost() {
  return HERO_BREAKTHROUGH_COST + state.heroBreakthrough * 40;
}

function canManageHero() {
  return !state.resolving && (state.phase === "settle"
    || (currentView === "home" && !state.levelStaminaSpent && state.phase === "setup"));
}

function needsHeroBreakthrough() {
  return state.heroLevel >= (state.heroBreakthrough + 1) * 10
    && state.heroBreakthrough < HERO_SKILLS.length - 1;
}

function formatCurrency(amount) {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}亿`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万`;
  return String(amount);
}

function getUnlockedHeroSkills() {
  return HERO_SKILLS.filter((skill) => skill.breakthrough <= state.heroBreakthrough);
}

function getCurrentHeroSkill() {
  const skills = getUnlockedHeroSkills();
  return skills[state.heroSkillIndex % skills.length] || HERO_SKILLS[0];
}

function getFullLevelReward() {
  return 100 + state.level * 25;
}

function getFailureReward() {
  return Math.floor(getFullLevelReward() * state.round * 3 / (state.maxRounds * 5));
}

function refreshStamina() {
  const now = Date.now();
  if (state.staminaRefillDate !== getDayKey()) {
    state.staminaRefillDate = getDayKey();
    state.staminaPurchaseUsed = false;
    state.staminaAdUsed = false;
  }
  if (state.stamina >= STAMINA_OVERFLOW_LIMIT) {
    state.staminaLastRegenAt = now;
    return;
  }
  const recovered = Math.floor((now - state.staminaLastRegenAt) / STAMINA_REGEN_INTERVAL);
  if (recovered <= 0) return;
  state.stamina = Math.min(STAMINA_OVERFLOW_LIMIT, state.stamina + recovered);
  state.staminaLastRegenAt += recovered * STAMINA_REGEN_INTERVAL;
}

function renderHud() {
  refreshStamina();
  stepsText.textContent = state.steps;
  goldText.textContent = formatCurrency(state.gold);
  yuanbaoText.textContent = formatCurrency(state.yuanbao);
  staminaText.textContent = `${state.stamina}/${state.maxStamina}`;
  levelText.textContent = `关卡 ${state.level}`;
  phaseText.textContent = state.phase === "setup"
    ? "操作期"
    : state.phase === "card" ? "选卡暂停" : "出怪期";
  roundText.textContent = `第 ${state.round}/${state.maxRounds} 波`;
  cardProgressText.textContent = `卡牌 ${state.cardsOffered}/6`;
  const hpPercent = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100));
  defenseHpText.textContent = `${state.hp} / ${state.maxHp}`;
  defenseHpFill.style.width = `${hpPercent}%`;
  defenseHpTrack.setAttribute("aria-valuemax", String(state.maxHp));
  defenseHpTrack.setAttribute("aria-valuenow", String(state.hp));
  defenseHpTrack.classList.toggle("critical", hpPercent <= 25);
  const needsStamina = state.round === 1 && !state.levelStaminaSpent;
  startWaveBtn.disabled = state.phase !== "setup"
    || state.resolving
    || (needsStamina && state.stamina < STAMINA_COST_PER_LEVEL);
  startWaveBtn.textContent = "出怪";
  adStepsBtn.disabled = state.phase !== "setup" || state.resolving || state.steps >= 11;
  staminaBtn.disabled = state.phase === "combat" || state.phase === "card" || state.resolving;
  const currentSkill = getCurrentHeroSkill();
  const currentCooldown = state.heroSkillCooldowns[currentSkill.id] || 0;
  const skillReady = currentView === "battle" && state.phase === "combat" && currentCooldown <= 0;
  const skillProgress = Math.max(0, Math.min(1, 1 - currentCooldown / currentSkill.cooldown));
  heroSkillBtn.disabled = !skillReady;
  heroSkillBtn.classList.toggle("ready", skillReady);
  heroSkillBtn.style.setProperty("--skill-progress", `${skillProgress * 100}%`);
  heroSkillTimer.textContent = currentCooldown > 0 ? `${Math.ceil(currentCooldown)}s` : "释放";
  heroSkillBtn.title = `${currentSkill.name}：${currentSkill.description}`;
  heroSkillBtn.setAttribute("aria-label", currentSkill.name);
  if (heroSkillIcon.getAttribute("src") !== `${ASSET}${currentSkill.icon}`) {
    heroSkillIcon.src = `${ASSET}${currentSkill.icon}`;
    heroSkillIcon.alt = currentSkill.name;
  }
  heroSkillName.textContent = currentSkill.name;
  if (heroSkillStrip.dataset.breakthrough !== String(state.heroBreakthrough)) {
    heroSkillStrip.replaceChildren();
    getUnlockedHeroSkills().forEach((skill) => {
      const preview = document.createElement("span");
      preview.className = "skill-preview";
      preview.dataset.skill = skill.id;
      preview.title = `${skill.name} · CD ${skill.cooldown}秒`;
      preview.innerHTML = `<img src="${ASSET}${skill.icon}" alt="${skill.name}" /><small></small>`;
      heroSkillStrip.appendChild(preview);
    });
    heroSkillStrip.dataset.breakthrough = String(state.heroBreakthrough);
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
  const levelInProgress = state.levelStaminaSpent && state.phase !== "settle";
  const selectedLevel = levelInProgress ? state.level : state.selectedLevel;
  const selectedLocked = selectedLevel > state.highestUnlockedLevel;
  const stageNameIndex = (selectedLevel - 1) % HOME_STAGE_NAMES.length;
  const enemyIndex = (selectedLevel - 1) % HOME_STAGE_ENEMIES.length;
  homeGoldText.textContent = formatCurrency(state.gold);
  homeGoldText.title = `${state.gold} 金币`;
  homeStaminaText.textContent = `${state.stamina}/${state.maxStamina}`;
  homeGrowthText.textContent = state.heroLevel;
  homeYuanbaoText.textContent = formatCurrency(state.yuanbao);
  homeYuanbaoText.title = `${state.yuanbao} 元宝`;
  homeLevelText.textContent = selectedLevel;
  homeStageName.textContent = HOME_STAGE_NAMES[stageNameIndex];
  const enemySource = `${ASSET}${HOME_STAGE_ENEMIES[enemyIndex]}`;
  if (homeEnemy.getAttribute("src") !== enemySource) homeEnemy.src = enemySource;
  const completed = selectedLevel < state.highestUnlockedLevel;
  homeRewardRow.querySelectorAll("[data-reward]").forEach((reward) => {
    const achieved = completed && reward.dataset.reward === "complete";
    reward.classList.toggle("achieved", achieved);
    reward.classList.toggle("locked", !achieved);
    reward.querySelector("img").src = achieved ? HOME_CHEST_OPEN : HOME_CHEST_LOCKED;
    reward.setAttribute("aria-label", achieved ? "奖励已达成" : "奖励未达成");
  });
  if (levelInProgress) {
    homeRecordText.textContent = "战局进行中";
  } else if (selectedLocked) {
    homeRecordText.textContent = "完成前一关后解锁";
  } else if (selectedLevel < state.highestUnlockedLevel) {
    homeRecordText.textContent = "已通关，可重复挑战";
  } else {
    homeRecordText.textContent = "当前挑战关卡";
  }
  homeStartBtn.disabled = selectedLocked || (!levelInProgress && state.stamina < STAMINA_COST_PER_LEVEL);
  homeStartBtn.querySelector("span").textContent = levelInProgress
    ? "继续守城"
    : selectedLocked ? "尚未解锁" : "开始守城";
  homeStartBtn.querySelector("small").lastChild.textContent = levelInProgress
    ? "返回当前战局"
    : selectedLocked ? `先通关第 ${selectedLevel - 1} 关` : `消耗 ${STAMINA_COST_PER_LEVEL}`;
  homePrevLevelBtn.disabled = levelInProgress || selectedLevel <= 1;
  homeNextLevelBtn.disabled = levelInProgress || selectedLevel >= state.highestUnlockedLevel + 1;
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

function showHome() {
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
  if (state.phase === "combat") runLoop();
}

function startLevelFromHome() {
  refreshStamina();
  if (state.phase === "settle") resetGame();
  const levelInProgress = state.levelStaminaSpent && state.phase !== "settle";
  if (!levelInProgress && state.selectedLevel > state.highestUnlockedLevel) return;
  if (!levelInProgress) {
    if (state.stamina < STAMINA_COST_PER_LEVEL) {
      showModal("体力不足", `进入本关需要 ${STAMINA_COST_PER_LEVEL} 点体力。`, [
        { label: "补充体力", onClick: showStaminaRefill },
        { label: "稍后再来", secondary: true, onClick: () => {} },
      ]);
      return;
    }
    state.stamina -= STAMINA_COST_PER_LEVEL;
    if (state.level !== state.selectedLevel) {
      state.level = state.selectedLevel;
      resetGame(false);
    }
    state.levelStaminaSpent = true;
  }
  showBattle();
}

function showHomeFeature(feature) {
  if (feature === "角色成长") {
    showGrowthModal(showHome);
    return;
  }
  const details = {
    "边塞商店": "边塞商店筹备中。",
    "武将名册": `已集结 3 名武将，主角当前等级 ${state.heroLevel}。`,
    "角色成长": `主角等级 ${state.heroLevel}，每次升级提升 1 点防线血量。`,
    "行军包裹": "行军包裹暂未开放。",
    "每日任务": "每日任务暂未开放。",
    "边塞军报": "荒骨峡谷出现敌军踪迹，请少主尽快整备防线。",
    "挑战难度": "挑战难度暂未开放。",
  };
  showModal(feature, details[feature] || "该功能将在后续版本开放。", [
    { label: "返回", secondary: true, onClick: () => {} },
  ]);
  if (feature === "武将名册") {
    const preview = document.createElement("div");
    preview.className = "roster-preview";
    WARRIORS.forEach((warrior) => {
      const portrait = document.createElement("img");
      portrait.src = `${ASSET}${warrior.idleImage}`;
      portrait.alt = warrior.name;
      preview.appendChild(portrait);
    });
    modalDetail.appendChild(preview);
  }
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
      const y = boardTop + monster.y * cell + cell * 0.11;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.dataset.renderX = String(monster.c);
      el.dataset.renderY = String(monster.y);
      monsterLayer.appendChild(el);
    }
    el.classList.toggle("rooted", monster.rootRemaining > 0);
    el.classList.toggle("boss", monster.isBoss);
    el.style.setProperty("--monster-move-duration", `${MONSTER_MOVE_INTERVAL * 1000 / state.speed}ms`);
    const image = el.querySelector("img");
    const imageSrc = `${ASSET}${monster.icon}`;
    if (!image.dataset.fallbackBound) {
      image.dataset.fallbackBound = "true";
      image.addEventListener("error", () => {
        const fallbackSrc = `${ASSET}${monster.isBoss ? "boss.png" : "monsters/round-1-monster.png"}`;
        if (image.getAttribute("src") !== fallbackSrc) image.src = fallbackSrc;
      });
    }
    if (image.getAttribute("src") !== imageSrc) image.src = imageSrc;
    const x = monster.c * cell + cell * 0.11;
    const y = boardTop + monster.y * cell + cell * 0.11;
    if (el.dataset.renderX !== String(monster.c) || el.dataset.renderY !== String(monster.y)) {
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.dataset.renderX = String(monster.c);
      el.dataset.renderY = String(monster.y);
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

function render() {
  renderHud();
  renderBoard();
  renderMonsters();
  renderLegend();
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

async function tryMove(from, to) {
  if (state.phase !== "setup" || state.resolving || from === to) {
    state.selected = null;
    renderBoard();
    return;
  }
  const dragged = state.board[from];
  if (!dragged) return;
  const target = state.board[to];

  if (!target) {
    state.board[to] = dragged;
    state.board[from] = null;
    state.selected = null;
    state.steps = Math.max(0, state.steps - 1);
    await resolveBoardAfterMove(to);
    return;
  }

  state.board[from] = target;
  state.board[to] = dragged;
  state.selected = null;
  state.steps = Math.max(0, state.steps - 1);

  await resolveBoardAfterMove(to);
}

function collectLine(index, dc, dr) {
  const anchor = state.board[index];
  if (!anchor) return [];
  const { c, r } = indexToPos(index);
  const line = [index];

  [-1, 1].forEach((direction) => {
    let nextC = c + dc * direction;
    let nextR = r + dr * direction;
    while (nextC >= 0 && nextC < BOARD_SIZE && nextR >= 0 && nextR < BOARD_SIZE) {
      const nextIndex = posToIndex(nextC, nextR);
      const piece = state.board[nextIndex];
      if (!piece || piece.type !== anchor.type || (piece.tier || 1) !== (anchor.tier || 1)) break;
      line.push(nextIndex);
      nextC += dc * direction;
      nextR += dr * direction;
    }
  });
  return line.length >= 3 ? line : [];
}

function findLineMatch(index) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  return directions
    .flatMap(([dc, dr]) => collectLine(index, dc, dr))
    .filter((value, itemIndex, values) => values.indexOf(value) === itemIndex);
}

function collectAllMatches(preferredTarget = null) {
  const groups = [];
  state.board.forEach((piece, index) => {
    if (!piece) return;
    const cluster = findLineMatch(index);
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

function eliminateMatches(matches, { chain = 1 } = {}) {
  const results = matches.map(({ type, cluster, targetIndex }) => ({
    type,
    cluster,
    targetIndex,
    highestTier: Math.max(...cluster.map((index) => state.board[index].tier || 1)),
  }));

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
    };
  }
  const boardRect = boardEl.getBoundingClientRect();
  const cell = boardRect.width / BOARD_SIZE || 56;
  return {
    x: boardRect.left - parentRect.left + monster.c * cell + cell / 2,
    y: boardRect.top - parentRect.top + monster.y * cell + cell * 0.11 - headOffset,
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

function damageBurstAtMonster(monster, text, critical = false) {
  const { x, y } = getMonsterFxPosition(monster);
  const fx = document.createElement("div");
  fx.className = `damage-fx${critical ? " critical" : ""}`;
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  const popupIndex = monster.damagePopupIndex || 0;
  monster.damagePopupIndex = (popupIndex + 1) % 3;
  fx.style.setProperty("--damage-drift", `${(popupIndex - 1) * 12}px`);
  fx.innerHTML = `
    <span class="damage-ring"></span>
    <span class="damage-spark spark-1"></span>
    <span class="damage-spark spark-2"></span>
    <span class="damage-spark spark-3"></span>
  `;
  const number = document.createElement("strong");
  number.className = "damage-number";
  number.setAttribute("aria-label", String(text));
  if ([...String(text)].every((character) => DAMAGE_GLYPHS[character])) {
    number.classList.add("bitmap-number");
    [...String(text)].forEach((character) => {
      const glyph = document.createElement("img");
      glyph.src = `${ASSET}${DAMAGE_GLYPHS[character]}`;
      glyph.alt = "";
      glyph.width = 30;
      glyph.height = 34;
      number.appendChild(glyph);
    });
  } else {
    number.textContent = text;
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
  const skill = getCurrentHeroSkill();
  if (currentView !== "battle" || state.phase !== "combat"
    || (state.heroSkillCooldowns[skill.id] || 0) > 0) return;
  state.heroSkillCooldowns[skill.id] = skill.cooldown;
  state.heroSkillIndex = (state.heroSkillIndex + 1) % getUnlockedHeroSkills().length;
  state.monsters.forEach((monster) => {
    let damage = 0;
    if (skill.id === "meteor") damage = Math.max(55, monster.maxHp * 0.3) * state.damageMultiplier;
    if (skill.id === "whirlwind") damage = Math.max(80, monster.maxHp * 0.45) * state.damageMultiplier;
    if (damage > 0) {
      monster.hp -= damage;
      damageBurstAtMonster(monster, `-${Math.round(damage)}`, true);
    }
    if (skill.id === "meteor") monster.rootRemaining = Math.max(monster.rootRemaining || 0, 1.5);
    if (skill.id === "shadow-lock") monster.rootRemaining = Math.max(monster.rootRemaining || 0, 5);
    if (skill.id === "whirlwind") monster.rootRemaining = Math.max(monster.rootRemaining || 0, 1);
    if (skill.id === "sacred-ward") monster.rootRemaining = Math.max(monster.rootRemaining || 0, 2);
  });
  if (skill.id === "sacred-ward") {
    const healing = Math.min(1, state.maxHp - state.hp);
    state.hp += healing;
    if (healing > 0) burstAt(33, `+${healing}`);
  }
  if (skill.id === "battle-drum") state.heroRallyRemaining = 8;
  const fx = document.createElement("div");
  fx.className = `card-screen-fx hero-skill-fx skill-fx-${skill.id}`;
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 620);
  removeDefeatedMonsters();
  tipText.textContent = `主角释放「${skill.name}」。`;
  renderHud();
  renderMonsters();
}

function triggerWarriorAttack(index) {
  const warrior = boardEl.querySelector(`.cell[data-index="${index}"] .warrior-piece`);
  if (!warrior) return;
  const animation = WARRIORS.find(({ type }) => type === warrior.dataset.type);
  const image = warrior.querySelector("img");
  if (!animation || !image) return;

  if (image.dataset.action !== "attack") {
    image.src = `${ASSET}${animation.attackImage}`;
    image.dataset.action = "attack";
  }
  clearTimeout(warrior.attackAnimationTimeout);
  warrior.classList.remove("attacking");
  void warrior.offsetWidth;
  warrior.classList.add("attacking");
  warrior.attackAnimationTimeout = setTimeout(() => {
    warrior.classList.remove("attacking");
    image.src = `${ASSET}${animation.idleImage}`;
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
  const needsStamina = state.round === 1 && !state.levelStaminaSpent;
  if (needsStamina) {
    if (state.stamina < STAMINA_COST_PER_LEVEL) {
      showModal("体力不足", `本关需要 ${STAMINA_COST_PER_LEVEL} 点体力，补充体力后再继续守城。`, [
        { label: "知道了", secondary: true, onClick: () => {} },
      ]);
      return;
    }
    state.stamina -= STAMINA_COST_PER_LEVEL;
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
    if (piece) piece.attackCooldown = 0;
  });
  const count = 5 + state.round * 2 + Math.ceil(state.level * 1.15);
  const difficultyScale = 1 + (state.level - 1) * 0.14;
  const hp = Math.round((28 + state.level * 8 + state.round * 7) * 2 * difficultyScale);
  state.waveConfig = { count, hp, interval: 0.72, killed: 0, fullReward: getFullLevelReward() };
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
  HERO_SKILLS.forEach((skill) => {
    state.heroSkillCooldowns[skill.id] = Math.max(0, (state.heroSkillCooldowns[skill.id] || 0) - dt);
  });
  state.monsters.forEach((monster) => {
    monster.rootRemaining = Math.max(0, (monster.rootRemaining || 0) - dt);
  });
  state.spawnTimer += dt;
  state.moveTimer += dt;

  if (state.spawned < state.waveConfig.count && state.spawnTimer >= state.waveConfig.interval) {
    state.spawnTimer = 0;
    spawnMonster();
  }
  attackMonsters(dt);
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
  const isBoss = state.round === state.maxRounds && state.spawned === state.waveConfig.count - 1;
  const c = Math.floor(Math.random() * 6);
  const maxHp = isBoss ? state.waveConfig.hp * 4 : state.waveConfig.hp;
  state.monsters.push({
    id: state.nextMonsterId++,
    c,
    y: -5.45,
    hp: maxHp,
    maxHp,
    stop: 0,
    rootRemaining: 0,
    triggeredDevices: [],
    isBoss,
    icon: isBoss ? "boss.png" : `monsters/round-${Math.min(state.round, 3)}-monster.png`,
    reward: isBoss ? 90 : 18,
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
    if (piece.attackCooldown > 0) return;

    const type = TYPES[piece.type];
    const level = piece.tier || 1;
    const dps = type.dps
      * Math.pow(1.8, level - 1)
      * state.damageMultiplier
      * (state.heroRallyRemaining > 0 ? 1.5 : 1);
    const attackRange = ATTACK_RANGE_BY_TIER[level];
    let attacked = false;
    state.monsters.forEach((monster) => {
      const row = Math.round(monster.y);
      const axisDistance = piece.type === "sword"
        ? Math.abs(monster.y - unit.r)
        : Math.abs(monster.c - unit.c);
      const wideMode = state.attackMode === "wide";
      const hit = piece.type === "rock"
        ? Math.hypot(monster.c - unit.c, monster.y - unit.r) <= AREA_RADIUS_BY_TIER[level] + (wideMode ? 0.5 : 0)
        : piece.type === "sword"
        ? (monster.c === unit.c || (wideMode && Math.abs(monster.c - unit.c) <= 1)) && axisDistance <= attackRange
        : (row === unit.r || (wideMode && Math.abs(row - unit.r) <= 1)) && axisDistance <= attackRange;
      if (!hit) return;
      const executionBonus = state.executionReady && monster.hp > monster.maxHp * 0.5 ? 1.35 : 1;
      monster.hp -= dps * executionBonus;
      attacked = true;
      damageBurstAtMonster(monster, `-${Math.round(dps * executionBonus)}`, dps * executionBonus >= 24);
    });
    if (attacked) {
      piece.attackCooldown = ATTACK_INTERVAL_BY_TIER[level]
        / (state.attackSpeedMultiplier * (state.heroRallyRemaining > 0 ? 1.35 : 1));
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
    if (monster.rootRemaining > 0 || monster.hp <= 0) return;
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
            state.board[deviceIndex] = null;
            boardChanged = true;
            damageBurstAtMonster(monster, `-${damage}`, true);
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
    monster.y += 1;
  });

  removeDefeatedMonsters();

  const leaked = state.monsters.filter((monster) => monster.y > 5.2);
  if (leaked.length) {
    state.hp = Math.max(0, state.hp - leaked.length);
    state.monsters = state.monsters.filter((monster) => monster.y <= 5.2);
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
  return 20 + state.level * 5;
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

function upgradeHero() {
  if (!canManageHero() || state.heroLevel >= HERO_MAX_LEVEL) return false;
  if (needsHeroBreakthrough()) return false;
  const cost = getHeroLevelCost();
  if (state.gold < cost) return false;
  state.gold -= cost;
  state.heroLevel += 1;
  state.maxHp = 4 + state.heroLevel - 1;
  state.hp = state.maxHp;
  tipText.textContent = `主角升至 ${state.heroLevel} 级，防线血量上限 +1。`;
  renderHud();
  return true;
}

function breakthroughHero() {
  const requiredLevel = (state.heroBreakthrough + 1) * 10;
  if (!canManageHero() || state.heroLevel < requiredLevel
    || state.heroBreakthrough >= HERO_SKILLS.length - 1) return false;
  const cost = getHeroBreakthroughCost();
  if (state.yuanbao < cost) return false;
  state.yuanbao -= cost;
  state.heroBreakthrough += 1;
  tipText.textContent = `突破成功，解锁「${HERO_SKILLS[state.heroBreakthrough].name}」。`;
  renderHud();
  return true;
}

function checkCombatEnd() {
  if (state.hp <= 0) {
    stopLoop();
    state.phase = "settle";
    render();
    showDefeat();
    return;
  }
  if (state.spawned >= state.waveConfig.count && state.monsters.length === 0) {
    stopLoop();
    if (state.round >= state.maxRounds) {
      state.phase = "settle";
      render();
      showVictory();
    } else {
      state.round += 1;
      state.phase = "setup";
      state.steps = 8;
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
    "局外养成": "home/nav-growth.png",
    "行军包裹": "home/nav-bag.png",
    "每日任务": "home/quest.png",
    "边塞军报": "home/notice.png",
    "挑战难度": "home/nav-battle.png",
    "胜利结算": "home/reward-chest.png",
    "防线失守": "home/nav-battle.png",
    "本关失败": "home/nav-battle.png",
    "命运三选一": "ui/theme/buff-thunder.png",
  };
  modalArt.src = `${ASSET}${artwork[title] || "hero.png"}`;
  modalDetail.replaceChildren();
  let stats = [];
  if (title === "补充体力") stats = [[`${state.stamina}/${state.maxStamina}`, "当前体力"], ["+60", "单次补充"]];
  if (title === "局外养成" || title === "角色成长") stats = [[`Lv.${state.heroLevel}`, "主角等级"], [state.gold, "金币"], [state.yuanbao, "元宝"]];
  if (title === "胜利结算") stats = [[`+${state.paidReward}`, "通关金币"], [`+${state.paidYuanbao}`, "通关元宝"], [state.totalKills, "本局击败"]];
  if (title === "防线失守" || title === "本关失败") stats = [[`+${state.paidReward}`, "本局金币"], [`+${state.paidYuanbao}`, "本局元宝"], [`${state.round}/${state.maxRounds}`, "到达波次"]];
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

function showModal(title, body, actions) {
  modalCard.classList.remove("card-draft", "growth-modal");
  renderModalArtwork(title);
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalActions.className = "modal-actions";
  modalActions.innerHTML = "";
  actions.forEach((action) => {
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
}

function refillStamina(source) {
  refreshStamina();
  if (state.stamina >= STAMINA_OVERFLOW_LIMIT) return;
  if (source === "coin") {
    if (state.staminaPurchaseUsed || state.gold < STAMINA_PURCHASE_COST) return;
    state.gold -= STAMINA_PURCHASE_COST;
    state.staminaPurchaseUsed = true;
    state.stamina = Math.min(STAMINA_OVERFLOW_LIMIT, state.stamina + STAMINA_REFILL_AMOUNT);
    tipText.textContent = `已用金币补充 ${STAMINA_REFILL_AMOUNT} 点体力，今日广告补充已解锁。`;
  } else {
    if (!state.staminaPurchaseUsed || state.staminaAdUsed) return;
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
    `当前体力 ${state.stamina}/${state.maxStamina}，每关消耗 ${STAMINA_COST_PER_LEVEL} 点。自然恢复：每 18 分钟 +1，最多可溢出至 ${STAMINA_OVERFLOW_LIMIT}。`,
    [
      {
        label: state.staminaPurchaseUsed ? "今日金币购买已用" : `金币购买满体力（${STAMINA_PURCHASE_COST}G）`,
        disabled: state.staminaPurchaseUsed || state.gold < STAMINA_PURCHASE_COST || atLimit,
        onClick: () => refillStamina("coin"),
      },
      {
        label: state.staminaAdUsed ? "今日广告补充已用" : state.staminaPurchaseUsed ? "观看广告补充满体力" : "请先完成金币购买",
        disabled: !state.staminaPurchaseUsed || state.staminaAdUsed || atLimit,
        onClick: () => refillStamina("ad"),
      },
      { label: "关闭", secondary: true, onClick: () => {} },
    ],
  );
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
      damageBurstAtMonster(monster, `-${Math.round(damage)}`, true);
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
  modalCard.classList.add("card-draft");
  renderModalArtwork("命运三选一");
  const choices = shuffled(CARD_DEFINITIONS).slice(0, 3);
  modalTitle.textContent = "命运三选一";
  modalBody.textContent = `击杀 ${state.totalKills} 个怪物，选择一张卡牌加入本局。`;
  modalActions.className = "modal-actions card-options";
  modalActions.innerHTML = "";
  choices.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-choice";
    button.innerHTML = `
      <span class="card-mark"><img src="./public/assets/ui/theme/buff-${card.id}.png" alt="" /></span>
      <strong>${card.title}</strong>
      <small>${card.tag}</small>
      <em>${card.description}</em>
    `;
    button.addEventListener("click", () => chooseCard(card));
    modalActions.appendChild(button);
  });
  modal.classList.remove("hidden");
}

function showDefeat() {
  payLevelReward(getFailureReward());
  payYuanbaoReward(getFailureYuanbaoReward());
  renderHud();
  const rewardText = `本关累计奖励 ${state.paidReward} 金币、${state.paidYuanbao} 元宝（全额奖励 × 到达波次比例 × 60%）。`;
  if (!state.revived) {
    showModal("防线失守", `${rewardText} 模拟激励广告复活：回满防线 HP，并重新挑战当前波。`, [
      { label: "看广告复活", onClick: revive },
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
  state.highestUnlockedLevel = Math.max(state.highestUnlockedLevel, state.level + 1);
  const rewardMultiplier = state.doubled ? 2 : 1;
  payLevelReward(getFullLevelReward() * rewardMultiplier);
  payYuanbaoReward(getFullYuanbaoReward() * rewardMultiplier);
  renderHud();
  const body = `本关结算 ${state.paidReward} 金币、${state.paidYuanbao} 元宝。`;
  showModal("胜利结算", body, [
    {
      label: state.doubled ? "已双倍，下一关" : "看广告双倍结算",
      onClick: () => {
        if (!state.doubled) {
          state.doubled = true;
          showVictory();
        } else {
          nextLevel();
        }
      },
    },
    { label: "局外养成", secondary: true, onClick: () => showGrowthModal(showVictory) },
    { label: "下一关", secondary: true, onClick: nextLevel },
    { label: "返回主界面", secondary: true, onClick: completeLevelToHome },
  ]);
}

function showGrowthModal(onBack = showHome) {
  const levelCost = getHeroLevelCost();
  const breakthroughLevel = (state.heroBreakthrough + 1) * 10;
  const breakthroughCost = getHeroBreakthroughCost();
  const nextSkill = HERO_SKILLS[state.heroBreakthrough + 1];
  const editable = canManageHero();
  const atCap = state.heroLevel >= HERO_MAX_LEVEL;
  const needsBreakthrough = needsHeroBreakthrough();
  showModal(
    currentView === "home" ? "角色成长" : "局外养成",
    `Lv.${state.heroLevel} · 防线 ${state.maxHp} · 突破 ${state.heroBreakthrough}阶${editable ? "" : " · 战局进行中"}`,
    [
      {
        label: needsBreakthrough ? "请先突破" : atCap ? "当前版本满级" : `升级 +1生命 · ${levelCost}金币`,
        disabled: !editable || atCap || needsBreakthrough || state.gold < levelCost,
        onClick: () => {
          upgradeHero();
          showGrowthModal(onBack);
        },
      },
      {
        label: !nextSkill ? "技能已全部解锁" : needsBreakthrough
          ? `突破 · ${breakthroughCost}元宝` : `${breakthroughLevel}级可突破`,
        disabled: !editable || !nextSkill || !needsBreakthrough || state.yuanbao < breakthroughCost,
        onClick: () => {
          breakthroughHero();
          showGrowthModal(onBack);
        },
      },
      { label: currentView === "home" ? "返回" : "返回结算", secondary: true, onClick: onBack },
    ],
  );
  modalCard.classList.add("growth-modal");
  const skills = document.createElement("div");
  skills.className = "growth-skill-list";
  HERO_SKILLS.forEach((skill) => {
    const unlocked = skill.breakthrough <= state.heroBreakthrough;
    const row = document.createElement("div");
    row.className = `growth-skill-row${unlocked ? " unlocked" : " locked"}`;
    row.innerHTML = `<img src="${ASSET}${skill.icon}" alt="" />
      <div><strong>${skill.name}</strong><span>${skill.description}</span></div>
      <small>CD ${skill.cooldown}s<br>${unlocked ? "已解锁" : `${skill.breakthrough * 10}级突破`}</small>`;
    skills.appendChild(row);
  });
  modalDetail.appendChild(skills);
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

function resetGame(keepLevel = true) {
  stopLoop();
  hideModal();
  state.resolutionId += 1;
  state.resolving = false;
  if (!keepLevel) {
    // level was already advanced by nextLevel
  }
  state.phase = "setup";
  state.round = 1;
  state.maxRounds = getRoundsForLevel(state.level);
  state.steps = 8;
  state.hp = state.maxHp;
  state.monsters = [];
  state.spawned = 0;
  state.speed = 1;
  state.levelStaminaSpent = false;
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
  state.heroSkillIndex = 0;
  state.heroRallyRemaining = 0;
  HERO_SKILLS.forEach((skill) => { state.heroSkillCooldowns[skill.id] = 0; });
  state.damageMultiplier = 1;
  state.attackSpeedMultiplier = 1;
  state.attackMode = "standard";
  state.executionReady = false;
  state.nextPieceId = 1;
  seedBoard();
  render();
  tipText.textContent = "交换棋子，让 3 个以上同类棋子在横、竖或斜线上连续排列即可消除。";
}

startWaveBtn.addEventListener("click", startWave);
staminaBtn.addEventListener("click", showStaminaRefill);
heroSkillBtn.addEventListener("click", releaseHeroSkill);
speedBtn.addEventListener("click", () => {
  state.speed = state.speed === 1 ? 2 : 1;
  renderHud();
});
adStepsBtn.addEventListener("click", () => {
  state.steps += 3;
  tipText.textContent = "模拟激励广告完成，获得 3 步。";
  renderHud();
});
resetBtn.addEventListener("click", () => resetGame());
homeStartBtn.addEventListener("click", startLevelFromHome);
homeStaminaBtn.addEventListener("click", showStaminaRefill);
battleHomeBtn.addEventListener("click", showHome);
homePrevLevelBtn.addEventListener("click", () => selectHomeLevel(-1));
homeNextLevelBtn.addEventListener("click", () => selectHomeLevel(1));
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
WARRIORS.forEach(({ attackImage }) => {
  const image = new Image();
  image.src = `${ASSET}${attackImage}`;
});
Object.values(DAMAGE_GLYPHS).forEach((source) => {
  const glyph = new Image();
  glyph.src = `${ASSET}${source}`;
});
