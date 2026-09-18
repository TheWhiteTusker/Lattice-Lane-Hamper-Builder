import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

console.log("\n=== [1/4] Ensuring build/icon.ico exists ===");
const iconIco = path.join(ROOT, "build", "icon.ico");
if (!fs.existsSync(iconIco)) {
  fs.mkdirSync(path.join(ROOT, "build"), { recursive: true });
  execSync(
    'python -c "from PIL import Image; img=Image.open(\'src/app/icon.png\'); img.save(\'build/icon.ico\', format=\'ICO\', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])"',
    { cwd: ROOT, stdio: "inherit" }
  );
}
console.log("✓ Icon verified");

console.log("\n=== [2/4] Building Next.js in Standalone Mode ===");
execSync("pnpm run build", {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    BUILD_STANDALONE: "true",
  },
});
console.log("✓ Next.js standalone build complete");

console.log("\n=== [3/4] Copying Static Assets into Standalone Bundle ===");
const standaloneDir = path.join(ROOT, ".next", "standalone");
const publicSrc = path.join(ROOT, "public");
const publicDest = path.join(standaloneDir, "public");
const staticSrc = path.join(ROOT, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");

// Copy public/ -> .next/standalone/public/
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
}

// Copy .next/static/ -> .next/standalone/.next/static/
if (fs.existsSync(staticSrc)) {
  fs.cpSync(staticSrc, staticDest, { recursive: true });
}

// Copy .env and .env.production if not already copied
for (const envFile of [".env", ".env.production"]) {
  const src = path.join(ROOT, envFile);
  const dest = path.join(standaloneDir, envFile);
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
  }
}
console.log("✓ Static assets copied to standalone");

console.log("\n=== [4/4] Packaging Windows Executable with electron-builder ===");
execSync("pnpm exec electron-builder --win", {
  cwd: ROOT,
  stdio: "inherit",
});
console.log("\n✨ Windows executable packaging complete! Check the dist/ folder.");
