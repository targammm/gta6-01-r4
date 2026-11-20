// serve.ts — tiny static server for local play and screenshot capture.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(import.meta.dirname, "game");
let port = 8080;
const portArg = process.argv.indexOf("--port");
if (portArg >= 0) port = Number(process.argv[portArg + 1]) || port;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let path = normalize(decodeURIComponent(url.pathname));
    if (path === "/" || path === "\\") path = "/index.html";
    const file = join(root, path);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
server.listen(port, () => console.log(`Solmar Bay dev server: http://localhost:${port}`));
process.on("SIGINT", () => server.close(() => process.exit(0)));
