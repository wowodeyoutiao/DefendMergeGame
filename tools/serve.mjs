import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetRoot = resolve(join(root, "public", "assets"));
const entryFiles = new Set(["index.html", "app.js", "styles.css", "theme.css"]);
const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".woff", ".woff2", ".mp3", ".ogg", ".wav"]);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function isAllowed(target, pathname) {
  const rel = relative(root, target);
  const inAssets = target === assetRoot || target.startsWith(assetRoot + "\\") || target.startsWith(assetRoot + "/");
  return entryFiles.has(rel) || (inAssets && allowedExtensions.has(extname(pathname).toLowerCase()));
}

const port = Number(process.argv[process.argv.indexOf("--port") + 1]) || 5174;
createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const target = resolve(join(root, pathname === "/" ? "index.html" : normalize(pathname).replace(/^[/\\]+/, "")));
  if (!isAllowed(target, pathname) || !existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Type": mimeTypes[extname(target).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(target).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Game-only server: http://127.0.0.1:${port}`);
});
