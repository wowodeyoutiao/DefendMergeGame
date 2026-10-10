import fs from "node:fs";

const src = fs.readFileSync(new URL("../../app.js", import.meta.url), "utf8");

function extract(fnName) {
  const head = `function ${fnName}(`;
  const start = src.indexOf(head);
  if (start < 0) throw new Error(`未找到 ${fnName}`);
  const lines = src.slice(start).split(/\r?\n/);
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trimEnd() === "}") {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error(`${fnName} 结束位置解析失败`);
  return lines.slice(0, end + 1).join("\n");
}

const BOARD_SIZE = 6;
const WARRIORS = [{ type: "sword" }];
let pieceSeq = 0;
const newPiece = () => ({ id: ++pieceSeq, type: "coin", tier: 1 });
const state = { board: [] };

const fn = new Function(
  "BOARD_SIZE",
  "WARRIORS",
  "newPiece",
  "state",
  `${extract("refillBoardFromBottom")}\n${extract("areAdjacentCells")}\nreturn { refillBoardFromBottom, areAdjacentCells };`
);
const { refillBoardFromBottom, areAdjacentCells } = fn(BOARD_SIZE, WARRIORS, newPiece, state);

let failed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  通过  ${name}`);
  } else {
    failed += 1;
    console.log(`  失败  ${name} ${detail}`);
  }
}
const make = (tier) => ({ id: ++pieceSeq, type: "coin", tier });
const colOf = (c) => [0, 1, 2, 3, 4, 5].map((r) => state.board[r * BOARD_SIZE + c]);

console.log("一、相邻换位规则（6x6，index = 行 * 6 + 列）");
check("横向相邻 (0,1) 可换", areAdjacentCells(0, 1) === true);
check("纵向相邻 (0,6) 可换", areAdjacentCells(0, 6) === true);
check("斜向 (0,7) 不可换", areAdjacentCells(0, 7) === false);
check("斜向反向 (7,0) 不可换", areAdjacentCells(7, 0) === false);
check("斜向 (14,21) 不可换", areAdjacentCells(14, 21) === false);
check("跨行首尾 (5,6) 不可换", areAdjacentCells(5, 6) === false);
check("同格 (12,12) 不可换", areAdjacentCells(12, 12) === false);
check("隔一格横向 (0,2) 不可换", areAdjacentCells(0, 2) === false);
check("越界 (-1,0) 不可换", areAdjacentCells(-1, 0) === false);
check("越界 (0,36) 不可换", areAdjacentCells(0, 36) === false);
check("最后一列与下行首列 (11,12) 不可换", areAdjacentCells(11, 12) === false);

console.log("\n二、递补方向：第 0 列顶部 3 格消除，下方棋子向上顶");
state.board = new Array(36).fill(null);
for (let i = 0; i < 36; i += 1) state.board[i] = make(1);
const lowA = state.board[18];
const lowB = state.board[24];
const lowC = state.board[30];
state.board[0] = null;
state.board[6] = null;
state.board[12] = null;
refillBoardFromBottom();
check("原第 4 行棋子上顶到第 1 行", state.board[0] === lowA);
check("原第 5 行棋子上顶到第 2 行", state.board[6] === lowB);
check("原第 6 行棋子上顶到第 3 行", state.board[12] === lowC);
check("上顶后列内相对顺序不变", [0, 6, 12].map((i) => state.board[i].id).join() === [lowA, lowB, lowC].map((p) => p.id).join());
check("上顶棋子带 rising 标记", lowA.rising === true);
check("上顶距离正确（3 行）", lowA.riseDistance === 3, `实际 ${lowA.riseDistance}`);
check("列底部 3 格由新棋子补入", [18, 24, 30].every((i) => state.board[i].entering === true));
check("新棋子是新生成的", colOf(0).slice(3).every((p) => ![lowA, lowB, lowC].includes(p)));

console.log("\n三、递补方向：中间格消除，只有下方棋子动");
state.board = new Array(36).fill(null);
for (let i = 0; i < 36; i += 1) state.board[i] = make(1);
const topPiece = state.board[0];
const above = state.board[6];
const belowA = state.board[18];
const belowB = state.board[24];
const belowC = state.board[30];
state.board[12] = null;
refillBoardFromBottom();
check("空位上方的棋子原地不动", state.board[0] === topPiece && state.board[6] === above);
check("下方第 4 行棋子上顶 1 行", state.board[12] === belowA);
check("下方第 5 行棋子上顶 1 行", state.board[18] === belowB);
check("下方第 6 行棋子上顶 1 行", state.board[24] === belowC);
check("上顶距离均为 1 行", [belowA, belowB, belowC].every((p) => p.riseDistance === 1));
check("最底部由新棋子补入", state.board[30].entering === true);

console.log("\n四、整列清空：全部由底部新棋子补入");
state.board = new Array(36).fill(null);
for (let i = 0; i < 36; i += 1) state.board[i] = make(1);
const neighbour = state.board[35];
for (let row = 0; row < 6; row += 1) state.board[row * 6 + 4] = null;
refillBoardFromBottom();
check("第 5 列满盘", colOf(4).every(Boolean));
check("整列均为补入的新棋子", colOf(4).every((p) => p.entering === true));
check("其它列棋子不被移动", state.board[35] === neighbour);
check("全盘 36 格无一为空", state.board.every(Boolean));

console.log("\n五、无空位时不产生新棋子");
state.board = new Array(36).fill(null);
for (let i = 0; i < 36; i += 1) state.board[i] = make(1);
const before = state.board.map((p) => p.id);
refillBoardFromBottom();
check("棋盘内容不变", state.board.map((p) => p.id).join() === before.join());
check("不留下 rising 标记", state.board.every((p) => !p.rising));

console.log("\n六、成簇规则：只认横向 / 纵向直线，斜线不成簇");
// 从 app.js 源码抽出成簇相关函数做纯数据断言（注意 collectAllMatches 形参顺序是 (preferredTarget, board)）
const matchFn = new Function(
  "BOARD_SIZE",
  "indexToPos",
  "posToIndex",
  `${extract("collectLine")}\n${extract("findLineMatch")}\n${extract("collectAllMatches")}\nreturn { findLineMatch, collectAllMatches };`
);
const { findLineMatch, collectAllMatches } = matchFn(
  BOARD_SIZE,
  (index) => ({ c: index % BOARD_SIZE, r: Math.floor(index / BOARD_SIZE) }),
  (c, r) => r * BOARD_SIZE + c
);
// 基底：5 类循环铺满，横纵相邻永不同类 → 天然不存在任何三连，避免干扰
const NOISE = ["n1", "n2", "n3", "n4", "n5"];
const base = () => Array.from({ length: 36 }, (_, i) => {
  const c = i % BOARD_SIZE;
  const r = Math.floor(i / BOARD_SIZE);
  return { id: 10000 + i, type: NOISE[(r * 2 + c) % 5], tier: 1 };
});
const put = (board, cells, type) => cells.forEach(([c, r]) => {
  board[r * BOARD_SIZE + c] = { id: 20000 + r * BOARD_SIZE + c, type, tier: 1 };
});
const groupsOf = (board) => collectAllMatches(null, board);

check("基底棋盘本身无三连（测试前提成立）", groupsOf(base()).length === 0);

const horiz = base();
put(horiz, [[1, 2], [2, 2], [3, 2]], "sword");
const horizGroups = groupsOf(horiz);
check("横向三连成簇", horizGroups.length === 1 && horizGroups[0].cluster.length === 3,
  JSON.stringify(horizGroups.map((g) => g.cluster.length)));

const vert = base();
put(vert, [[4, 0], [4, 1], [4, 2]], "fan");
const vertGroups = groupsOf(vert);
check("纵向三连成簇", vertGroups.length === 1 && vertGroups[0].cluster.length === 3,
  JSON.stringify(vertGroups.map((g) => g.cluster.length)));

const diagDown = base();
put(diagDown, [[0, 0], [1, 1], [2, 2]], "rock");
check("右下斜三连【不】成簇", groupsOf(diagDown).length === 0);

const diagUp = base();
put(diagUp, [[5, 0], [4, 1], [3, 2]], "rock");
check("右上斜三连【不】成簇", groupsOf(diagUp).length === 0);

const diagLong = base();
put(diagLong, [[0, 1], [1, 2], [2, 3], [3, 4]], "rock");
check("斜四连【不】成簇", groupsOf(diagLong).length === 0);

const pair = base();
put(pair, [[1, 1], [2, 1]], "sword");
check("仅两个相同不消除", groupsOf(pair).length === 0);

// L 形：横三连 + 纵三连共用一格，应为同一个簇（长度 5）
const ell = base();
put(ell, [[0, 4], [1, 4], [2, 4], [0, 3], [0, 2]], "coin");
const ellGroups = groupsOf(ell);
check("L 形（横+纵共用一格）合成一个簇且长度为 5",
  ellGroups.length === 1 && ellGroups[0].cluster.length === 5,
  JSON.stringify(ellGroups.map((g) => g.cluster.length)));

// 不同 tier 的同类棋子不算一簇
const mixedTier = base();
put(mixedTier, [[1, 2], [2, 2], [3, 2]], "sword");
mixedTier[2 * BOARD_SIZE + 2].tier = 2;
check("同类型但等级不同不成簇", groupsOf(mixedTier).length === 0);

console.log("\n七、普通消除返步档位：4连→1 / 5连→2 / 6连→3 / 7连及以上→4（封顶 4）");
const refundFn = new Function(`${extract("regularRefundSteps")}\nreturn regularRefundSteps;`);
const regularRefundSteps = refundFn();
check("3 连不返步", regularRefundSteps(3) === 0, `实际 ${regularRefundSteps(3)}`);
check("4 连返 1 步", regularRefundSteps(4) === 1, `实际 ${regularRefundSteps(4)}`);
check("5 连返 2 步", regularRefundSteps(5) === 2, `实际 ${regularRefundSteps(5)}`);
check("6 连返 3 步", regularRefundSteps(6) === 3, `实际 ${regularRefundSteps(6)}`);
check("7 连返 4 步", regularRefundSteps(7) === 4, `实际 ${regularRefundSteps(7)}`);
check("8 连仍封顶 4 步", regularRefundSteps(8) === 4, `实际 ${regularRefundSteps(8)}`);
check("12 连仍封顶 4 步", regularRefundSteps(12) === 4, `实际 ${regularRefundSteps(12)}`);
check("非法输入返回 0", regularRefundSteps(null) === 0 && regularRefundSteps(undefined) === 0);

console.log(failed ? `\n结论：${failed} 项失败` : "\n结论：全部通过");
process.exit(failed ? 1 : 0);
