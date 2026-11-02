import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PORT = Number(process.env.PORT || 8790);
const CT = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const filePath = normalize(join(ROOT, relative));
  if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(filePath)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": CT[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`static http://127.0.0.1:${PORT}/`);
});
