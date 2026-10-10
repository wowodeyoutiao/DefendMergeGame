# 合战守格 · 项目长期约定

## 装备系统（超哥定案）

- 六个部位：武器、衣服、头盔、项链、戒指、靴子。**武器和衣服区分职业**（脚本里叫 warriorBound），其余 4 部位全职业通用。
- **装备绑定职业**：武器/衣服带 `warrior` 字段（sword/fan/rock），只有对应武将能穿。旧存档无该字段的装备保持通用可穿，不要改成硬性拒绝。
- 品质 7 档：白绿蓝紫橙红金（1~7），可 5 合 1 升品。
- 图标规则：`public/assets/equipment/{部位}[-{职业}]-{品质}.png`，职业段用 `WARRIORS.modelRole`（fan=warrior、sword=mage、rock=priest，注意不是 type 本身）。唯一查表入口 `getEquipmentIcon(slot, quality, warriorType)`；图标取职业的唯一出口 `equipmentArtType(item)`（带 warrior 取自身，老存档无该字段固定取 WARRIORS[0] 即男战士），五处渲染点必须全部走它，否则同一件装备在包裹/打造台会长得不一样。
- **品质只由底框表达，素材配色不参与品质表达**（超哥定案）。`art/Icon` 文件名里的颜色档位与图标实际配色并不一致（"白色头盔"是紫帽、"金色鞋子"是蓝靴），md5 已核对属素材本身问题——**不返修、不重排**，别再提这件事。对照图 `asset-contact-sheets/equipment-qualities.jpg`（脚本 `tools/build_equipment_sheet.py`）可复查。
- **武器/衣服的职业是纯随机**（三职业等概率），掉落/合成/升品都不指定。这是**故意设计、不是缺陷**：三职业武将从开局全部拥有（`warriorQuality` 初始 sword/fan/rock 均为 1，无解锁门槛），随机职业逼玩家三线并养，是装备养成深度的来源；且通用 4 部位可在三武将之间倒着穿、包裹无容量上限，结构上不会出现"用不上的死库存"。**不要**改成按当前培养武将投放或加本职业权重，也不要再把它当问题提出来。
- 三武将的切换入口：成长面板（`data-warrior-tab`）与打造面板（`forge-warriors`）都带页签，切换会写 `state.selectedWarriorType`，装备操作全部以它为当前武将。
- 素材源在 `art/Icon`（98 张，命名含中文），导入脚本 `tools/import-equipment-icons.mjs`，可重复执行。指环/腰带/饰品/裤子 28 张未接入。

## 棋盘规则（超哥定案，不要凭消除品类常识改）

- **换位只允许横向或纵向相邻**：同行且列差 1，或同列且行差 1。斜向（对角）一律不生效、不消耗步数。跨行首尾（如第 1 行末格与第 2 行首格）也不算相邻。
- **递补方向是"从下向上"**：消除产生空位后，该列**下方**棋子逐格上顶，缺口留在**列底部**，由棋盘底部生成新棋子补入。上方棋子必须原地不动。**不是重力下沉**——第一版按品类常识做成了下沉，被推翻过。
- 实现要点：`refillBoardFromBottom` 每列自上而下收集幸存棋子再自上而下写回（保证列内相对顺序不变）；上顶棋子标 `rising` + `riseDistance`（原行 − 新行），`styles.css` 用 `riseToVacancy` 做自下往上滑动。
- **成簇（消除）只认横向 / 纵向直线（超哥 2026-10-10 定案，已改）**：同种同阶棋子在同一行或同一列相连 ≥3 才消除，**斜线一律不成簇**。`findLineMatch` 的 `directions` 现为 `[[1,0],[0,1]]`（原含 `[1,1]/[1,-1]` 两个斜向，是工程 2026-09-22 首次上传就带进来的原始行为，不是回归）。**注意与"换位规则"是两条独立的规则**：换位只准横纵相邻，成簇以前曾被误以为也只能横纵，实为两者混记；现在两者统一为横纵。
- 成簇的保留行为（别当 bug）：L / T 形（横三连 + 纵三连共用一格）仍合并为**同一个簇**（Union 后长度 5）；同类型但 `tier` 不同不成簇。这两条 + 斜线不成簇已写进 `tools/verify/verify-board-rules.mjs` 第六节做永久断言。
- ⚠️ **去斜向的难度影响与已落地的补偿（2026-10-10 实测 6000 局随机 6×6）**：平均每盘成簇数 1.51→1.11（-26%）、平均最大簇长 3.89→2.75（-29%）、可消除换位步数 52.3→43.8（-16%）、偶发无解棋盘 0%→约 0.2%（已有广告洗牌兜底）。返步收益一度从基线 0.890/回合 掉到 0.514（-42%）。
- **普通消除返步档位最终定案（超哥 2026-10-10）**：4连→1、5连→2、6连→3、**7连及以上→4（封顶 4）**，门槛簇长 ≥4 且 100% 必返（非概率）。代码抽为纯函数 `regularRefundSteps(clusterSize) = Math.min(4, size - 3)`，`tools/verify/verify-board-rules.mjs` 第七节有 8 条数值断言锁死（含 8/12 连仍封顶、非法输入返回 0）。**这是终稿，不要再据此建议改成「簇长-2」做补偿。**（历史过程：去斜向后先按「簇长-2」补偿过一版，超哥随后改回这套更陡的档位。）
- 该档位实测 0.484/回合，对比今天开工前基线 0.889 约 **-46%**（去斜向 + 陡档位叠加的结果）。**已确认为超哥有意收紧**，不要再当作 bug 汇报；若日后要回调，唯一旋钮是这个 `regularRefundSteps` 函数，别动成簇方向。
- 只当朋友闲聊提及再说明：以上难度数字来自随机棋盘蒙特卡洛（`tmp/difficulty-check.mjs` / `tmp/refund-tune.mjs`），真实玩家会主动做大连杆，绝对值偏高，但**相对变化幅度**是可信的。

## 界面风格（超哥定案）

- **主界面语言**：弹窗卡片白→奶白 + 金圈 `#ffcf6f` + 橙厚底 `#e0863a`，主按钮橙红 `#ff9a56→#ff5b5b`，次按钮蓝 `#8fc7ff→#5a9eff`，白内容块描边 `#a9cdfb` + 厚底 `#b7d6f0`。
- **装备打造界面已改成深冰蓝底板（2026-09-27 超哥确认）**：底板 `linear-gradient(180deg,#f5fbff,#d5e8fa 24%,#a9cef2 58%,#8dbce8)`，冰饰（雪花 / 冰凌 / 波浪）全部是**内联 SVG**（变量 `--ice-flake` / `--ice-icicle` / `--ice-wave` 定义在 `.modal-card.forge-modal` 上供子元素继承），零素材请求。原来的墨青内胆 + 棕木框已废。
  - **装饰层叠序是坑**：`.forge-panel::before/::after` 用 absolute z-index 0 做装饰时，必须配 `.forge-panel > * { position:relative; z-index:1 }`，否则伪元素会盖在内容上面；负 z-index 不行（panel 不是 stacking context，会沉到卡片背景之后）。
  - 装饰要放在**内容缝隙和深色区**才看得见：面板顶部会被钱包条遮满，最显眼的是炉台（`forge-craft`，深色插画）顶部的白色冰檐。
  - 已废弃（CSS `display:none`，文件保留未删）：`slot-round.png` / `slot-round-active.png` / `power-banner.png` / `cost-ribbon.png`。炉台 `forge-hearth.png`、分隔 `forge-divider.png`、升级箭头、品质底框保留。
- 商店界面仍是棕木 / 土金风格（超哥没提，未动）—— 若要统一请先问。

## 工程约定

- 纯静态工程，零构建零 npm 依赖；`node tools/serve.mjs --port 5173` 起本地试玩。
- **每次代码调整后，都要确认该本地服务保持常驻，并主动把试玩链接发给超哥**（超哥 2026-09-28 明确要求）。发链接前先 curl `--noproxy '*'` 探活，挂了就重启。
- **链接必须用 `http://localhost:5173/`，不要用 127.0.0.1**（2026-10-09 定案）。本机有全局代理 `http://127.0.0.1:4210`，代理**绕过 localhost 但不绕过 127.0.0.1**——超哥用 127.0.0.1 会被浏览器代理拦掉、表现为"打不开"，而服务其实是好的（curl 需加 `--noproxy` 也说明这点）。排查时别误判成服务挂了。
- 公网部署（`workbuddy_sites_deploy`）在本机代理环境下会 `fetch failed`，暂不可行；若超哥要远程/手机试玩，需先解决代理或让他改浏览器代理例外。
- 访问 127.0.0.1 时 curl 要加 `--noproxy '*'`，否则走代理返回 502。
- **回归三件套**（改完任何逻辑都跑一遍），脚本都在 `tools/verify/`（已入库）：
  - `node --check app.js` 语法；
  - `node tools/verify/static-scan.mjs` 静态扫描（未定义符号 / 残留引用 / DOM 引用落空 / state 字段 / CSS 关键帧 / JS 类名无 CSS 规则）；
  - `NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" node tools/verify/regression-dom.mjs` 整体回归（把页面注入 jsdom 真跑，90 项断言，含"把每个界面所有按钮点一遍"）。注意：文档里旧的 `C:/Users/MC/...` 路径已失效（2026-10-10 起环境用户为 Administrator），jsdom 已装到受管 workspace；跑之前若报 `Cannot find module 'jsdom'`，先 `npm install jsdom` 装到该 workspace（**不要 -g**）。
  - 另有两个专项：`tools/verify/verify-board-rules.mjs`（棋盘换位与递补，从 app.js 源码抽函数做纯数据断言，注意 app.js 是 CRLF）、`tools/verify/verify-equipment-icons.mjs`（装备图标与职业绑定）。
  - 脚本用 `import.meta.url` 上溯两级定位仓库根（从 `tmp/` 迁到 `tools/verify/` 时改过，再挪目录要同步改）。
- **改任何 CSS/JS 后必须同步 bump `index.html` 里的资源版本参数**（`styles.css?v=` / `theme.css?v=`，2026-10-09 教训）：超哥端浏览器会拿旧缓存，表现为"改动不生效/旧样式盖住内容"，且本地复现永远正常、极难排查。版本参数用日期+改动主题，如 `?v=20261009-battle-v2`。
- 存档在 localStorage（键 `defend-merge-progress-v1`），换浏览器/域名/端口会丢档。
- **存档读入必须做清洗**：`loadProgress` 里装备相关字段走 `sanitizeEquipmentItem` + `isPlainObject`，id 去重且 `equipmentNextId` 严格大于所有已用 id。不要退回"直接赋值 / 展开覆盖"的旧写法——存档被外部改过或写入中断时，脏数据会被原样写回，玩家永远恢复不了。
- 激励广告仍是本地模拟，未接微信/抖音 SDK。
- **超哥是靠 IDE 的「变更 / Source Control」列表核对改动的**：直接 `git commit` 之后工作区变干净，他会以为"工程里没有任何改动"。所以**提交前先明确告知要提交哪些文件、或者先让他过一眼 diff**，提交后再主动给出 `git show <hash> --stat` 之类的证据，别让他自己去猜。2026-09-27 封版时就踩过一次。
- **金色（第 7 档）装备：已定案不改（超哥，2026-09-27 封版）**。金色装备主线第 61 关起 / 挑战模式可掉落（权重 0.005），但武将品质上限是 6（`MAX_WARRIOR_QUALITY`），穿戴又要求品质完全相等，合成也显式拒绝第 7 档，所以金色装备当前只能卖 40 金币。**这是刻意留作后续版本，不是缺陷——不要再提议改 `MAX_WARRIOR_QUALITY`，也不要再把它当问题提出来。** `docs/equipment-growth.md` 已写明该约定；`tools/verify/regression-dom.mjs` 的「已定案设计：金色（第 7 档）」段落有断言锁定当前行为，日后放开品质上限会立刻被测出来。
