const { app, BrowserWindow, utilityProcess } = require("electron");
const path = require("path");
const http = require("http");
const net = require("net");
const fs = require("fs");

let mainWindow = null;
let serverProcess = null;

// Find an available TCP port on localhost
function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

// Check if HTTP server is responsive
function waitForServer(url, timeoutMs = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      http
        .get(url, (res) => {
          clearInterval(interval);
          resolve(true);
        })
        .on("error", () => {
          if (Date.now() - startTime > timeoutMs) {
            clearInterval(interval);
            reject(new Error("Timeout waiting for internal server to start"));
          }
        });
    }, 150);
  });
}

// Locate Next.js standalone server.js
function getServerPath() {
  const possiblePaths = [
    path.join(app.getAppPath(), "standalone", "server.js"),
    path.join(app.getAppPath(), ".next", "standalone", "server.js"),
    path.join(process.resourcesPath, "standalone", "server.js"),
    path.join(process.resourcesPath, "app", "standalone", "server.js"),
    path.join(process.resourcesPath, "app", ".next", "standalone", "server.js"),
    path.join(__dirname, "..", ".next", "standalone", "server.js"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error("Could not find Next.js standalone server.js. Checked: " + possiblePaths.join(", "));
}

async function startApp() {
  const port = await getAvailablePort();
  const serverScript = getServerPath();
  const serverDir = path.dirname(serverScript);

  console.log(`[Lattice Lane Desktop] Starting server on port ${port}...`);
  console.log(`[Lattice Lane Desktop] Server script: ${serverScript}`);

  const serverEnv = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
  };

  // Launch Next.js standalone server using Electron's utilityProcess
  serverProcess = utilityProcess.fork(serverScript, [], {
    cwd: serverDir,
    env: serverEnv,
  });

  serverProcess.on("exit", (code) => {
    console.log(`[Lattice Lane Desktop] Server exited with code ${code}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  const appUrl = `http://127.0.0.1:${port}`;
  await waitForServer(appUrl);

  const iconPath = fs.existsSync(path.join(__dirname, "..", "build", "icon.ico"))
    ? path.join(__dirname, "..", "build", "icon.ico")
    : path.join(__dirname, "..", "src", "app", "icon.png");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Lattice Lane - Hamper Builder",
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(appUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function cleanUp() {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // ignore
    }
    serverProcess = null;
  }
}

app.whenReady().then(startApp).catch((err) => {
  console.error("[Lattice Lane Desktop] Failed to start:", err);
  cleanUp();
  app.quit();
});

app.on("window-all-closed", () => {
  cleanUp();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", cleanUp);
app.on("will-quit", cleanUp);
