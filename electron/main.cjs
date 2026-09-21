const { app, BrowserWindow, dialog, shell, utilityProcess, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const net = require("net");
const fs = require("fs");

// The app runs its own Next server on localhost and talks to the same Supabase
// project as the website, so the data is identical but no click waits on the
// Cloudflare Worker (~1.5s per page when measured).
let mainWindow = null;
let server = null;
let appUrl = null;

const page = (title, body) =>
  "data:text/html;charset=utf-8," +
  encodeURIComponent(`<!DOCTYPE html><html><head><title>${title}</title><style>
    body{font-family:"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;
      height:100vh;margin:0;background:#faf9f6;color:#2c332d}
    .card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.06);
      text-align:center;max-width:420px}
    h2{margin-top:0;color:#54655b} p{color:#666;font-size:14px;line-height:1.5}
    button{background:#54655b;color:#fff;border:0;padding:10px 24px;font-size:14px;font-weight:600;
      border-radius:6px;cursor:pointer;margin-top:16px}
  </style></head><body><div class="card">${body}</div></body></html>`);

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () =>
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error("Local server did not start"));
          else setTimeout(attempt, 100);
        });
    attempt();
  });
}

function serverScript() {
  const packaged = path.join(process.resourcesPath, "standalone", "server.js");
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, "..", ".next", "standalone", "server.js");
}

async function startServer() {
  const port = await freePort();
  const script = serverScript();
  server = utilityProcess.fork(script, [], {
    cwd: path.dirname(script),
    env: { ...process.env, LATTICE_DESKTOP: "1", PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
  });
  server.on("exit", () => {
    server = null;
    if (!app.isQuitting) app.quit();
  });
  appUrl = `http://127.0.0.1:${port}`;
  await waitForServer(appUrl);
}

// Releases are published to the website (pnpm publish:desktop). On launch, and
// from "Check for updates", the app asks before downloading, shows progress,
// then offers Install now / Later — so nobody reinstalls by hand.
const UPDATE_SERVERS = [
  "https://hamper-builder.latticelane.workers.dev/updates/",
  "https://lattice-lane-hamper-builder.latticelane.workers.dev/updates/",
  "https://lattice-lane-hamper-builder.digital-9f6.workers.dev/updates/",
];

async function fetchFromUpdates(relPath) {
  for (const base of UPDATE_SERVERS) {
    try {
      const res = await fetch(base + relPath, { cache: "no-store" });
      if (res.ok) return { res, base };
    } catch {
      // try next server
    }
  }
  return null;
}

const isNewer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

// A downloaded-but-not-installed update waits here until the user picks
// "Install now"; every launch asks again until they do.
const UPDATE_DIR = () => path.join(app.getPath("userData"), "updates");
const PENDING = () => path.join(UPDATE_DIR(), "pending.json");

function readPending() {
  try {
    const p = JSON.parse(fs.readFileSync(PENDING(), "utf8"));
    if (isNewer(p.version, app.getVersion()) && fs.existsSync(p.file)) return p;
  } catch {
    // no pending update
  }
  // Already installed, or never downloaded: clear any leftover installer.
  fs.rmSync(UPDATE_DIR(), { recursive: true, force: true });
  return null;
}

async function askInstall(p) {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "info",
    buttons: ["Install now", "Later"],
    defaultId: 0,
    cancelId: 1,
    title: "Update ready",
    message: `Lattice Lane ${p.version} is downloaded and ready to install.`,
    detail: "Install now restarts the app on the new version. Later asks again the next time you open the app.",
  });
  if (response !== 0) return { status: "deferred", version: p.version };
  // Silent install over the existing one, then relaunch.
  spawn(p.file, ["/S", "--force-run"], { detached: true, stdio: "ignore" }).unref();
  app.quit();
  return { status: "updating", version: p.version };
}

async function download(base, version) {
  const res = await fetch(base + "Lattice-Lane-Setup.exe", { cache: "no-store" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;

  fs.mkdirSync(UPDATE_DIR(), { recursive: true });
  const file = path.join(UPDATE_DIR(), `Lattice-Lane-Setup-${version}.exe`);
  const win = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 440,
    height: 220,
    frame: false,
    resizable: false,
    minimizable: false,
  });
  await win.loadURL(
    page(
      "Downloading update",
      `<h2>Downloading update</h2><p>Lattice Lane ${version}</p>
       <div style="background:#e8e6e1;border-radius:4px;height:8px;overflow:hidden">
         <div id="bar" style="background:#54655b;height:8px;width:0"></div></div>
       <p id="pct">0%</p>`,
    ),
  );

  const out = fs.createWriteStream(file);
  let got = 0;
  let shown = null;
  try {
    for await (const chunk of res.body) {
      got += chunk.length;
      if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
      const label = total ? `${Math.floor((got / total) * 100)}%` : `${Math.round(got / 1e6)} MB`;
      if (label !== shown) {
        shown = label;
        mainWindow?.setProgressBar(total ? got / total : 2);
        win.webContents
          .executeJavaScript(
            `document.getElementById("pct").textContent=${JSON.stringify(label)};` +
              (total ? `document.getElementById("bar").style.width=${JSON.stringify(label)};` : ""),
          )
          .catch(() => {});
      }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    if (total && got !== total) throw new Error("Download was incomplete");
  } catch (error) {
    out.destroy();
    fs.rmSync(file, { force: true });
    throw error;
  } finally {
    win.destroy();
    mainWindow?.setProgressBar(-1);
  }

  const p = { version, file };
  fs.writeFileSync(PENDING(), JSON.stringify(p));
  return p;
}

let checking = false;

async function checkForUpdate(manual = false) {
  if (!app.isPackaged && !manual) return { status: "dev" };
  if (checking) return { status: "busy" };
  checking = true;
  try {
    const pending = readPending();
    if (pending) return await askInstall(pending);

    const updateResult = await fetchFromUpdates("latest.json");
    if (!updateResult) {
      if (manual) {
        await dialog.showMessageBox(mainWindow, {
          type: "error",
          title: "Update Check Failed",
          message: "Could not reach update server. Please check your internet connection.",
        });
      }
      return { status: "error", message: "Could not reach update server" };
    }
    const { version } = await updateResult.res.json();
    if (!isNewer(version, app.getVersion())) {
      if (manual) {
        await dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Up to date",
          message: `You are on the latest version of Lattice Lane (v${app.getVersion()}).`,
        });
      }
      return { status: "up-to-date", version };
    }

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Update", "Not now"],
      defaultId: 0,
      cancelId: 1,
      title: "Update available",
      message: `Lattice Lane ${version} is available (you have ${app.getVersion()}).`,
      detail: "Would you like to update?",
    });
    if (response !== 0) return { status: "deferred", version };

    return await askInstall(await download(updateResult.base, version));
  } catch (error) {
    // Offline or a bad download: keep working, try again next launch.
    console.error("Update failed:", error);
    if (manual) {
      await dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "Update failed",
        message: `The update could not be completed: ${error.message}`,
        detail: "Check your internet connection and try again.",
      });
    }
    return { status: "error", message: error.message };
  } finally {
    checking = false;
  }
}

ipcMain.handle("check-for-updates", async () => checkForUpdate(true));

function createWindow() {
  const ico = path.join(__dirname, "..", "build", "icon.ico");
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Lattice Lane - Hamper Builder",
    icon: fs.existsSync(ico) ? ico : path.join(__dirname, "..", "src", "app", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // Anything that isn't the app itself opens in the default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (appUrl && url.startsWith(appUrl)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-fail-load", (_e, code, _desc, url) => {
    if (code === -3 || !url.startsWith("http")) return; // aborted / redirected
    mainWindow.loadURL(
      page(
        "Lattice Lane - Offline",
        `<h2>Connection Unavailable</h2>
         <p>Could not reach the Lattice Lane database. Check your internet connection and try again.</p>
         <button onclick="location.href='${url}'">Retry</button>`,
      ),
    );
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Show something at once; the local server takes a moment on first launch.
  mainWindow.loadURL(page("Lattice Lane", "<h2>Lattice Lane</h2><p>Starting…</p>"));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    createWindow();
    try {
      await startServer();
      mainWindow?.loadURL(appUrl);
      checkForUpdate();
    } catch (error) {
      mainWindow?.loadURL(page("Lattice Lane - Error", `<h2>Could not start</h2><p>${error.message}</p>`));
    }
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
    server?.kill();
  });

  app.on("window-all-closed", () => app.quit());
}
