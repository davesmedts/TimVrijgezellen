import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, relative, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("../docs/", import.meta.url));
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export function createSiteServer() {
  return createServer(async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }

    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const filename = resolve(siteRoot, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
      const relativePath = relative(siteRoot, filename);
      if (relativePath.startsWith(`..${sep}`) || relativePath === ".." || pathname.includes("\\")) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      const contents = await readFile(filename);
      response.writeHead(200, {
        "Content-Type": contentTypes[extname(filename)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : contents);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 404).end("Not found");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const server = createSiteServer();
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Website: http://127.0.0.1:${server.address().port}`);
  });
}
