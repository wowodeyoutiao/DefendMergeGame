import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const option = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback;
const baseUrl = option("--url", "http://127.0.0.1:5173/");
const output = path.resolve(option("--output", "tmp/responsive-audit"));
const quick = process.argv.includes("--quick");
const cases = quick ? [[320, 568, 2], [360, 640, 3], [390, 844, 3], [844, 390, 3]] : [
  [320, 568, 2], [360, 560, 3], [360, 640, 3], [375, 667, 2], [375, 812, 3],
  [390, 844, 3], [393, 873, 3], [412, 915, 2.625], [430, 932, 3],
  [768, 1024, 2], [1024, 768, 2], [1366, 768, 1], [1920, 1080, 1], [2560, 1440, 1], [844, 390, 3],
  [390, 844, 3, 47, 34], [375, 667, 2, 24, 24],
];
const views = ["home", "home-report", "battle", "forge", "star", "equipment", "bag", "synthesis", "cards", "shop", "tasks", "hero", "victory"];
const browser = await chromium.launch({ headless: true, channel: option("--channel", "msedge") });
const results = [];
const pageErrors = [];
const resourceErrors = new Set();
await fs.mkdir(output, { recursive: true });
try {
  for (const [width, height, deviceScaleFactor, safeTop = 0, safeBottom = 0] of cases) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, reducedMotion: "reduce", isMobile: width <= 430, hasTouch: width <= 430 });
    const page = await context.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) resourceErrors.add(`${response.status()} ${response.url()}`); });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.evaluate(({ safeTop, safeBottom }) => {
      document.documentElement.style.setProperty("--safe-top", `${safeTop}px`);
      document.documentElement.style.setProperty("--safe-bottom", `${safeBottom}px`);
      state.tutorialStep = 5;
      state.tutorialActive = false;
      state.gold = 1234567;
      state.yuanbao = 765432;
      state.stamina = 500;
      state.heroLevel = 100;
      state.heroBreakthrough = 9;
      state.highestUnlockedLevel = 121;
      state.equipmentInventory = Array.from({ length: 36 }, (_, index) => createEquipment(EQUIPMENT_SLOTS[index % 6].id, 1));
      renderHud();
    }, { safeTop, safeBottom });
    for (const view of views) {
      await page.evaluate(viewName => {
        hideModal();
        stopLoop();
        state.phase = "setup";
        if (viewName.startsWith("home")) {
          showHome();
          if (viewName === "home-report") {
            document.getElementById("homeScreen").classList.add("has-report");
            document.getElementById("armyMarqueeHome").classList.add("visible");
          }
        }
        if (viewName === "battle") showBattle();
        if (viewName === "forge" || viewName === "star") { forgeUi.tab = viewName === "star" ? "star" : "enhance"; showForge(); }
        if (viewName === "equipment") showEquipmentGrowth();
        if (viewName === "bag") showEquipmentBag();
        if (viewName === "synthesis") showEquipmentSynthesis(showEquipmentBag);
        if (viewName === "cards") openCardChoice();
        if (viewName === "shop") showShop();
        if (viewName === "tasks") showDailyTasks();
        if (viewName === "hero") showHeroGrowthModal();
        if (viewName === "victory") showVictory();
        document.querySelectorAll(".modal-card,.modal-detail,.bag-grid").forEach(element => { element.scrollTop = 0; });
      }, view);
      await page.waitForTimeout(250);
      const measurement = await page.evaluate(({ viewName, safeTop, safeBottom }) => {
        const rect = selector => {
          const element = document.querySelector(selector);
          if (!element || !element.getClientRects().length) return null;
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
        };
        const issues = [];
        const warnings = [];
        const modalOpen = !document.getElementById("modal").classList.contains("hidden");
        const root = modalOpen ? document.querySelector(".modal-card") : document.getElementById(viewName.startsWith("home") ? "homeScreen" : "gameScreen");
        const rootBox = root.getBoundingClientRect();
        if (rootBox.left < -1 || rootBox.right > innerWidth + 1) issues.push("panel-horizontal-clipping");
        if (rootBox.top < safeTop - 1 || rootBox.bottom > innerHeight - safeBottom + 1) {
          if (!modalOpen && innerHeight - safeTop - safeBottom < 560) warnings.push("short-landscape-requires-vertical-scroll");
          else issues.push("panel-taller-than-safe-viewport");
        }
        if (root.scrollWidth > root.clientWidth + 2) issues.push("panel-horizontal-overflow");
        const scrolling = [...root.querySelectorAll(".modal-detail,.bag-grid,.equipment-compatible-list")].map(element => ({ className: element.className, height: element.clientHeight, scrollHeight: element.scrollHeight, width: element.clientWidth, scrollWidth: element.scrollWidth, overflowY: getComputedStyle(element).overflowY }));
        for (const item of scrolling) if (item.scrollWidth > item.width + 2) issues.push(`content-horizontal-overflow:${item.className}`);
        const textOverflow = [...root.querySelectorAll(".home-currency b,.home-stamina b,.profile-copy,.hud-pill b,.forge-warrior strong,.shop-wallet b")].filter(element => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2).map(element => ({ text: element.textContent, className: element.className || element.id, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
        for (const item of textOverflow) issues.push(`text-overflow:${item.className}`);
        const homeStart = rect("#homeStartBtn"), homeNav = rect(".home-bottom-nav"), board = rect("#board"), defense = rect(".defense-status"), approach = rect(".approach-zone"), cell = rect(".cell");
        if (viewName.startsWith("home") && homeStart.bottom > homeNav.top + 1) issues.push("home-start-overlaps-navigation");
        if (viewName === "battle" && board.bottom > defense.top + 2) issues.push("board-overlaps-defense");
        if (viewName === "battle" && cell.width < 28) issues.push("board-cells-below-28px");
        const piece = rect(".piece"), pieceImage = rect(".piece img");
        if (viewName === "battle" && piece.width < cell.width * 0.65) issues.push("piece-too-small-for-cell");
        const missingImages = [...root.querySelectorAll("img")].filter(element => element.getAttribute("src") && element.complete && element.naturalWidth === 0).map(element => element.getAttribute("src"));
        return { issues, warnings, panel: { width: rootBox.width, height: rootBox.height }, page: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, textOverflow, scrolling, board, defense, approach, cell, piece, pieceImage, missingImages };
      }, { viewName: view, safeTop, safeBottom });
      const result = { viewport: `${width}x${height}`, dpr: deviceScaleFactor, safeTop, safeBottom, view, ...measurement };
      results.push(result);
      if (quick || [320, 390, 1024].includes(width)) {
        const screenshotPath = path.join(output, `${width}x${height}${safeTop ? "-safe" : ""}-${view}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false, scale: "css", animations: "disabled" });
      }
    }
    await context.close();
    console.log(`Checked ${width}x${height} DPR ${deviceScaleFactor}`);
  }
} finally {
  await browser.close();
}
const summary = { cases: results.length, failing: results.filter(result => result.issues.length || result.missingImages.length), warnings: results.filter(result => result.warnings.length), pageErrors, resourceErrors: [...resourceErrors], results };
await fs.writeFile(path.join(output, "report.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ cases: summary.cases, failing: summary.failing.map(result => ({ viewport: result.viewport, view: result.view, issues: result.issues })), warnings: summary.warnings.map(result => ({ viewport: result.viewport, view: result.view, warnings: result.warnings })), pageErrors, resourceErrors: [...resourceErrors] }, null, 2));
if (summary.failing.length || pageErrors.length || resourceErrors.size) process.exitCode = 1;
