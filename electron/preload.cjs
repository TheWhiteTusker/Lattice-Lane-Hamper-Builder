// Preload script for Lattice Lane Desktop
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  isDesktop: true,
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
});
