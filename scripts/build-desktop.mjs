import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");

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

console.log("\n=== [2/4] Building Next.js in standalone mode ===");
fs.rmSync(STANDALONE, { recursive: true, force: true });
execSync("pnpm run build:next", {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, BUILD_STANDALONE: "true" },
});

console.log("\n=== [3/4] Copying static assets into the standalone server ===");
fs.cpSync(path.join(ROOT, "public"), path.join(STANDALONE, "public"), { recursive: true });
fs.cpSync(path.join(ROOT, ".next", "static"), path.join(STANDALONE, ".next", "static"), { recursive: true });
// Only the public anon key ships. Next may have traced .env (local overrides,
// possibly secrets) into the bundle, so remove it.
fs.copyFileSync(path.join(ROOT, ".env.production"), path.join(STANDALONE, ".env.production"));
fs.rmSync(path.join(STANDALONE, ".env"), { force: true });
console.log("✓ Standalone server ready");

console.log("\n=== [4/4] Packaging Windows installer with electron-builder ===");
// --publish never: in CI electron-builder otherwise tries GitHub Releases and
// fails without GH_TOKEN. Releases go to R2 via `pnpm publish:desktop`.
execSync("pnpm exec electron-builder --win --publish never", { cwd: ROOT, stdio: "inherit" });
console.log("\n✨ Done. Installer is in dist/.");

// The installed app compares its version with this on launch (electron/updater.cjs).
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
fs.writeFileSync(path.join(ROOT, "dist", "latest.json"), JSON.stringify({ version }));
console.log(`Version ${version}. Run \`pnpm publish:desktop\` to release it.`);
