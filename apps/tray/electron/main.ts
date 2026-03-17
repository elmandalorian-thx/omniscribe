import { app, BrowserWindow, globalShortcut } from "electron";
import path from "path";
import { TrayManager } from "./tray";
import { DaemonManager } from "./daemon";
import { createIpcHandlers } from "./ipc";

let mainWindow: BrowserWindow | null = null;
let trayManager: TrayManager | null = null;
let daemonManager: DaemonManager | null = null;

const GLOBAL_HOTKEY_QUICK_NOTE = "CommandOrControl+Shift+N";

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 640,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  // Hide instead of close
  win.on("close", (event) => {
    event.preventDefault();
    win.hide();
  });

  return win;
}

app.whenReady().then(() => {
  // Prevent multiple instances
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  // Start daemon
  daemonManager = new DaemonManager();
  daemonManager.start();

  // Create hidden window for settings/status UI
  mainWindow = createWindow();

  // Set up system tray
  trayManager = new TrayManager(daemonManager, mainWindow);
  trayManager.create();

  // Register global hotkey for Quick Note
  const registered = globalShortcut.register(GLOBAL_HOTKEY_QUICK_NOTE, () => {
    if (!daemonManager) return;

    if (daemonManager.isRecording) {
      daemonManager.stopSession();
      trayManager?.updateStatus("idle");
    } else {
      daemonManager.startSession("note");
      trayManager?.updateStatus("recording-note");
    }
  });

  if (!registered) {
    console.warn(`Failed to register global hotkey: ${GLOBAL_HOTKEY_QUICK_NOTE}`);
  }

  // Set up IPC handlers
  if (mainWindow) {
    createIpcHandlers(mainWindow, daemonManager);
  }

  // Hide dock icon on macOS (tray-only app)
  if (process.platform === "darwin") {
    app.dock?.hide();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  daemonManager?.stop();
});

// Prevent app from quitting when all windows are closed (tray app stays running)
app.on("window-all-closed", (event: Event) => {
  event.preventDefault();
});

app.on("second-instance", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});
