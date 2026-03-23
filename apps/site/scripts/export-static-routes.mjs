import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const indexHtmlPath = path.join(distDir, "index.html");
const staticRoutes = ["/download", "/zh", "/zh/download"];

async function main() {
  const indexHtml = await readFile(indexHtmlPath, "utf8");

  for (const route of staticRoutes) {
    const routeDir = path.join(distDir, ...route.split("/").filter(Boolean));
    await mkdir(routeDir, { recursive: true });
    await writeFile(path.join(routeDir, "index.html"), indexHtml, "utf8");
  }

  await cp(indexHtmlPath, path.join(distDir, "404.html"));
}

main().catch((error) => {
  console.error("Failed to export static routes for GitHub Pages.");
  console.error(error);
  process.exitCode = 1;
});
