import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
ASSETS = (ROOT / "public" / "assets").resolve()
ENTRY_FILES = {ROOT / name for name in ("index.html", "app.js", "styles.css", "theme.css")}
ASSET_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".woff", ".woff2", ".mp3", ".ogg", ".wav"}


class GameHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        request_path = unquote(urlsplit(self.path).path)
        target = (ROOT / request_path.lstrip("/")).resolve()
        if request_path == "/":
            target = ROOT / "index.html"
        allowed = target in ENTRY_FILES or (
            target.is_relative_to(ASSETS) and target.suffix.lower() in ASSET_EXTENSIONS
        )
        if not allowed or not target.is_file():
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Share only playable game files, not the project archive.")
    parser.add_argument("--port", type=int, default=5174)
    args = parser.parse_args()
    handler = partial(GameHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Game-only server: http://127.0.0.1:{args.port}", flush=True)
    server.serve_forever()
