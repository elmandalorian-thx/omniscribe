import { BrowserWindow, ipcMain } from "electron";
import { DaemonManager } from "./daemon";

export function createIpcHandlers(
  window: BrowserWindow,
  daemon: DaemonManager
): void {
  // Session controls
  ipcMain.handle("session:start", async (_event, type: string, title?: string) => {
    const session = await daemon.startSession(type as "meeting" | "note", title);
    window.webContents.send("session:updated", session);
    return session;
  });

  ipcMain.handle("session:stop", async () => {
    const session = await daemon.stopSession();
    window.webContents.send("session:updated", session);
    return session;
  });

  ipcMain.handle("session:current", async () => {
    return daemon.getCurrentSession();
  });

  ipcMain.handle("session:list", async (_event, type?: string, limit?: number) => {
    return daemon.listSessions(type, limit);
  });

  ipcMain.handle("session:transcript", async (_event, sessionId: string) => {
    return daemon.getTranscript(sessionId);
  });

  // Daemon status
  ipcMain.handle("daemon:status", async () => {
    try {
      const health = await daemon.healthCheck();
      return { running: true, ...health };
    } catch {
      return { running: false, status: "offline", recording: false };
    }
  });

  ipcMain.handle("daemon:restart", async () => {
    daemon.stop();
    daemon.start();
    return { restarting: true };
  });

  // Window controls
  ipcMain.on("window:hide", () => {
    window.hide();
  });
}
