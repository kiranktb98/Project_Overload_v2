import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const sourceDir = fileURLToPath(new URL("./marketing-client/", import.meta.url));
const outputDir = fileURLToPath(new URL("../.generated-marketing/", import.meta.url));

let activeBuild: Promise<void> | null = null;
let lastBuildStamp = 0;

async function getLatestSourceStamp(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true });
  let latest = 0;

  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, await getLatestSourceStamp(absolute));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const details = await stat(absolute);
    latest = Math.max(latest, details.mtimeMs);
  }

  return latest;
}

export function getMarketingAssetPath(fileName: string): string {
  return `/marketing-assets/${fileName}`;
}

export async function ensureMarketingBundle(): Promise<void> {
  const latestSourceStamp = await getLatestSourceStamp(sourceDir);
  if (lastBuildStamp >= latestSourceStamp) {
    return;
  }

  if (activeBuild) {
    return activeBuild;
  }

  activeBuild = (async () => {
    await mkdir(outputDir, { recursive: true });
    await build({
      entryPoints: {
        home: join(sourceDir, "home.tsx"),
        pricing: join(sourceDir, "pricing.tsx")
      },
      outdir: outputDir,
      bundle: true,
      format: "esm",
      target: "es2022",
      platform: "browser",
      jsx: "automatic",
      loader: {
        ".svg": "file",
        ".png": "file"
      },
      entryNames: "[name]",
      assetNames: "assets/[name]",
      sourcemap: false,
      minify: false,
      splitting: false,
      logLevel: "silent",
      define: {
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development")
      }
    });
    lastBuildStamp = Date.now();
  })().finally(() => {
    activeBuild = null;
  });

  return activeBuild;
}

export async function readMarketingAsset(fileName: string): Promise<{
  body: Buffer;
  contentType: string;
} | null> {
  const safeFileName = fileName.replace(/\\/g, "/");
  const resolved = join(outputDir, safeFileName);
  if (!resolved.startsWith(outputDir)) {
    return null;
  }

  try {
    const body = await readFile(resolved);
    return {
      body,
      contentType: getContentType(extname(fileName).toLowerCase())
    };
  } catch {
    return null;
  }
}

export function readStubMarketingAsset(fileName: string): {
  body: Buffer;
  contentType: string;
} | null {
  switch (fileName) {
    case "home.js":
      return {
        body: Buffer.from('console.log("HomeHeroScene stub");\n', "utf8"),
        contentType: "text/javascript; charset=utf-8"
      };
    case "pricing.js":
      return {
        body: Buffer.from('console.log("PricingHeroScene stub");\n', "utf8"),
        contentType: "text/javascript; charset=utf-8"
      };
    case "home.css":
      return {
        body: Buffer.from(".mk-home-root{display:block;}\n", "utf8"),
        contentType: "text/css; charset=utf-8"
      };
    case "pricing.css":
      return {
        body: Buffer.from(".mk-pricing-hero{display:grid;}\n", "utf8"),
        contentType: "text/css; charset=utf-8"
      };
    default:
      return null;
  }
}

function getContentType(extension: string): string {
  switch (extension) {
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}
