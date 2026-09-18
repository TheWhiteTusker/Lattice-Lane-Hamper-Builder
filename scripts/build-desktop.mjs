import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

console.log("\n=== [1/2] Ensuring build/icon.ico exists ===");
const iconIco = path.join(ROOT, "build", "icon.ico");
if (!fs.existsSync(iconIco)) {
  fs.mkdirSync(path.join(ROOT, "build"), { recursive: true });
  execSync(
    'python -c "from PIL import Image; img=Image.open(\'src/app/icon.png\'); img.save(\'build/icon.ico\', format=\'ICO\', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])"',
    { cwd: ROOT, stdio: "inherit" }
  );
}
console.log("✓ Icon verified");

console.log("\n=== [2/2] Packaging Windows Executable with electron-builder ===");
execSync("pnpm exec electron-builder --win", {
  cwd: ROOT,
  stdio: "inherit",
});
console.log("\n✨ Windows executable packaging complete! Check the dist/ folder.");
