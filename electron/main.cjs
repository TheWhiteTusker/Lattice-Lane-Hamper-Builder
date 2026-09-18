const { app, BrowserWindow, shell, session, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const DEFAULT_URL = "https://lattice-lane-hamper-builder.digital-9f6.workers.dev";
const TARGET_URL = process.env.LATTICE_LANE_URL || DEFAULT_URL;

let mainWindow = null;

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, "..", "build", "icon.ico"))
    ? path.join(__dirname, "..", "build", "icon.ico")
    : path.join(__dirname, "..", "src", "app", "icon.png");

  mainWindow = new BrowserWindow({
    width: 1440,
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
      spellcheck: true,
    },
  });

  // External links open in default web browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(TARGET_URL) && !url.includes("supabase.co")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Load the live cloud app
  mainWindow.loadURL(TARGET_URL);

  // Friendly retry page if offline or connection drops
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // Ignore user abort / redirects

    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lattice Lane - Offline</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #faf9f6;
              color: #2c332d;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.06);
              text-align: center;
              max-width: 420px;
            }
            h2 { margin-top: 0; color: #54655b; }
            p { color: #666; font-size: 14px; line-height: 1.5; }
            button {
              background: #54655b;
              color: white;
              border: none;
              padding: 10px 24px;
              font-size: 14px;
              font-weight: 600;
              border-radius: 6px;
              cursor: pointer;
              margin-top: 16px;
            }
            button:hover { background: #44534a; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Connection Unavailable</h2>
            <p>Could not connect to Lattice Lane. Please check your internet connection and try again.</p>
            <button onclick="window.location.href='${TARGET_URL}'">Retry Connection</button>
          </div>
        </body>
      </html>
    `);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Ensure single instance running
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
