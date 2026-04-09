import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
await loadEnv(root);

const publicDir = path.join(root, "public");
const host = process.env.PREVIEW_HOST ?? "0.0.0.0";
const port = Number(process.env.PREVIEW_PORT ?? 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    let requestPath = decodeURIComponent(url.pathname);
    if (requestPath === "/") {
      requestPath = "/index.html";
    }

    const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(publicDir, safePath);

    const content = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": mimeTypes[ext] ?? "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(content);
  } catch (error) {
    if (String(error).includes("ENOENT")) {
      try {
        const fallback = await readFile(path.join(publicDir, "index.html"));
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        });
        res.end(fallback);
        return;
      } catch {
        // ignore
      }
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  const urls = getPreviewUrls(port);
  console.log("Preview server started.");
  for (const url of urls) {
    console.log(`- ${url}`);
  }
});

function getPreviewUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [`http://localhost:${port}`];

  for (const network of Object.values(interfaces)) {
    for (const item of network ?? []) {
      if (item.family === "IPv4" && !item.internal) {
        urls.push(`http://${item.address}:${port}`);
      }
    }
  }

  return [...new Set(urls)];
}
