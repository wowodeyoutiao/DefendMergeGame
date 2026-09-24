(function (root) {
  const CAPSULE_GAP = 8;
  const FALLBACK_TOP = 96;

  function calculateInsets(metrics = {}, viewport = {}) {
    const width = Number(viewport.width) || 390;
    const height = Number(viewport.height) || 844;
    const sourceWidth = Number(metrics.windowWidth) || width;
    const scale = width / sourceWidth;
    const sourceHeight = Number(metrics.windowHeight) || height / scale;
    const offsetTop = Number(metrics.viewportOffsetTop) || 0;
    const safeArea = metrics.safeArea || {};
    const menu = metrics.menuButton || {};
    const validMenu = Number.isFinite(menu.top) && Number.isFinite(menu.bottom)
      && menu.top >= 0 && menu.bottom > menu.top && menu.bottom <= sourceHeight + offsetTop;
    const safeTop = Math.max(0, (Number(safeArea.top) || 0) - offsetTop) * scale;
    const menuTop = validMenu ? Math.max(0, menu.bottom - offsetTop) * scale + CAPSULE_GAP : 0;
    const fallbackTop = metrics.isMiniGame && !validMenu
      ? Math.max(FALLBACK_TOP, ((Number(metrics.statusBarHeight) || 0) - offsetTop) * scale + 48)
      : 0;
    const bottom = Number.isFinite(safeArea.bottom) && safeArea.bottom > offsetTop
      ? Math.max(0, sourceHeight - (safeArea.bottom - offsetTop)) * scale : 0;
    return { top: Math.ceil(Math.max(safeTop, menuTop, fallbackTop)), bottom: Math.ceil(bottom) };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { calculateInsets };
  if (!root.document) return;

  const query = new URLSearchParams(root.location.search);
  const preview = query.get("host-preview") === "1";
  let suppliedMetrics = null;
  const subscribed = new WeakSet();

  function readHostMetrics() {
    const platform = [root.wx, root.tt].find(api => api && (
      typeof api.getMenuButtonBoundingClientRect === "function"
      || typeof api.getWindowInfo === "function" || typeof api.getSystemInfoSync === "function"
    ));
    const isMiniGame = Boolean(platform || root.__wxjs_environment === "miniprogram"
      || ["wechat", "douyin"].includes(query.get("host")));
    let info = {};
    let menuButton = null;
    if (platform) {
      try {
        info = typeof platform.getWindowInfo === "function"
          ? platform.getWindowInfo() : platform.getSystemInfoSync?.() || {};
      } catch {}
      try { menuButton = platform.getMenuButtonBoundingClientRect?.(); } catch {}
      if (!subscribed.has(platform) && typeof platform.onWindowResize === "function") {
        platform.onWindowResize(refresh);
        subscribed.add(platform);
      }
    }
    return { ...info, menuButton, isMiniGame };
  }

  function refresh() {
    const metrics = suppliedMetrics || (preview
      ? { isMiniGame: true, windowWidth: root.innerWidth, menuButton: { top: 56, bottom: 88 } }
      : readHostMetrics());
    const insets = calculateInsets(metrics, { width: root.innerWidth, height: root.innerHeight });
    const element = root.document.documentElement;
    element.style.setProperty("--host-safe-top", `${insets.top}px`);
    element.style.setProperty("--host-safe-bottom", `${insets.bottom}px`);
    element.toggleAttribute("data-host-safe-area", insets.top > 0 || insets.bottom > 0);
    element.toggleAttribute("data-host-compact", insets.top > 0 && root.innerHeight - insets.top - insets.bottom < 560);
    element.toggleAttribute("data-host-preview", preview);
  }

  root.GameSafeArea = {
    setMetrics(metrics) { suppliedMetrics = metrics; refresh(); },
    refresh,
  };
  refresh();
  root.addEventListener("resize", refresh);
  root.addEventListener("pageshow", refresh);
  root.addEventListener("WeixinJSBridgeReady", refresh);
  root.document.addEventListener("WeixinJSBridgeReady", refresh);
  root.document.addEventListener("visibilitychange", () => {
    if (!root.document.hidden) refresh();
  });
  root.visualViewport?.addEventListener("resize", refresh);
})(typeof window === "undefined" ? globalThis : window);
