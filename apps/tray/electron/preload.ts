import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("omniscribe", {
  // Session controls
  startSession: (type: string, title?: string) =>
    ipcRenderer.invoke("session:start", type, title),
  stopSession: () => ipcRenderer.invoke("session:stop"),
  getCurrentSession: () => ipcRenderer.invoke("session:current"),
  listSessions: (type?: string, limit?: number) =>
    ipcRenderer.invoke("session:list", type, limit),
  getTranscript: (sessionId: string) =>
    ipcRenderer.invoke("session:transcript", sessionId),

  // Daemon status
  getDaemonStatus: () => ipcRenderer.invoke("daemon:status"),
  restartDaemon: () => ipcRenderer.invoke("daemon:restart"),

  // Events from main process
  onStatusChange: (callback: (status: string) => void) => {
    ipcRenderer.on("status:changed", (_event, status) => callback(status));
  },
  onSessionUpdate: (callback: (session: unknown) => void) => {
    ipcRenderer.on("session:updated", (_event, session) => callback(session));
  },

  // Window controls
  hideWindow: () => ipcRenderer.send("window:hide"),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke("settings:update", settings),
});
