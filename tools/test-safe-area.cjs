const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { calculateInsets } = require("../safe-area.js");

assert.deepEqual(calculateInsets(), { top: 0, bottom: 0 });
assert.deepEqual(calculateInsets({ isMiniGame: true }), { top: 96, bottom: 0 });
assert.deepEqual(calculateInsets({ isMiniGame: true, menuButton: { top: 0, bottom: 0 } }), { top: 96, bottom: 0 });
assert.deepEqual(calculateInsets({
  windowWidth: 390, windowHeight: 844, safeArea: { top: 47, bottom: 810 },
  menuButton: { top: 56, bottom: 88 }, isMiniGame: true,
}), { top: 96, bottom: 34 });
assert.deepEqual(calculateInsets({
  windowWidth: 780, windowHeight: 1688, menuButton: { top: 112, bottom: 176 },
}), { top: 96, bottom: 0 });
assert.deepEqual(calculateInsets({
  windowWidth: 390, windowHeight: 756, viewportOffsetTop: 88,
  safeArea: { top: 47, bottom: 810 }, menuButton: { top: 56, bottom: 88 },
}), { top: 8, bottom: 34 });
assert.deepEqual(calculateInsets({
  isMiniGame: true, menuButton: { top: 56, bottom: 99999 },
}), { top: 96, bottom: 0 });

const styles = {};
const attributes = {};
const events = {};
let menuBottom = 88;
let resizeCallback;
const windowMock = {
  innerWidth: 390, innerHeight: 844,
  location: { search: "" },
  document: {
    documentElement: {
      style: { setProperty(name, value) { styles[name] = value; } },
      toggleAttribute(name, value) { attributes[name] = value; },
    },
    addEventListener(name, callback) { events[name] = callback; },
  },
  addEventListener(name, callback) { events[name] = callback; },
  wx: {
    getWindowInfo() { return { windowWidth: 390, windowHeight: 844, safeArea: { top: 47, bottom: 810 } }; },
    getMenuButtonBoundingClientRect() { return { top: 56, bottom: menuBottom }; },
    onWindowResize(callback) { resizeCallback = callback; },
  },
};
const source = fs.readFileSync(require.resolve("../safe-area.js"), "utf8");
vm.runInNewContext(source, { window: windowMock, URLSearchParams });
assert.equal(styles["--host-safe-top"], "96px");
assert.equal(styles["--host-safe-bottom"], "34px");
assert.equal(attributes["data-host-safe-area"], true);
assert.equal(attributes["data-host-compact"], false);
windowMock.innerHeight = 568;
events.resize();
assert.equal(attributes["data-host-compact"], true);
windowMock.innerHeight = 844;
menuBottom = 104;
resizeCallback();
assert.equal(styles["--host-safe-top"], "112px");
windowMock.GameSafeArea.setMetrics({ windowWidth: 390, menuButton: { top: 48, bottom: 80 } });
assert.equal(styles["--host-safe-top"], "88px");
windowMock.wx.getMenuButtonBoundingClientRect = () => { throw new Error("unavailable"); };
windowMock.GameSafeArea.setMetrics(null);
assert.equal(styles["--host-safe-top"], "96px");
delete windowMock.wx;
events.pageshow();
assert.equal(styles["--host-safe-top"], "0px");
assert.equal(attributes["data-host-safe-area"], false);
assert.equal(attributes["data-host-compact"], false);
console.log("PASS: browser defaults, capsule exclusion, safe bottom, coordinate scaling, viewport offset, invalid API data, resize, host bridge, SDK failure and recovery.");
