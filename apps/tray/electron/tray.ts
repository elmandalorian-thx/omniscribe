import {
  Tray,
  Menu,
  nativeImage,
  Notification,
  BrowserWindow,
  shell,
} from "electron";
import path from "path";
import { DaemonManager } from "./daemon";

type TrayStatus = "idle" | "recording-meeting" | "recording-note" | "transcribing" | "syncing" | "error";

export class TrayManager {
  private tray: Tray | null = null;
  private daemon: DaemonManager;
  private window: BrowserWindow;
  private status: TrayStatus = "idle";

  constructor(daemon: DaemonManager, window: BrowserWindow) {
    this.daemon = daemon;
    this.window = window;
  }

  create(): void {
    const iconPath = this.getIconPath("idle");
    const icon = nativeImage.createFromPath(iconPath);

    this.tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    this.tray.setToolTip("OmniScribe — Ready");
    this.updateContextMenu();

    this.tray.on("click", () => {
      this.toggleWindow();
    });
  }

  updateStatus(status: TrayStatus): void {
    this.status = status;
    if (!this.tray) return;

    const tooltips: Record<TrayStatus, string> = {
      idle: "OmniScribe — Ready",
      "recording-meeting": "OmniScribe — Recording Meeting",
      "recording-note": "OmniScribe — Recording Note",
      transcribing: "OmniScribe — Transcribing...",
      syncing: "OmniScribe — Syncing...",
      error: "OmniScribe — Error",
    };

    this.tray.setToolTip(tooltips[status] || "OmniScribe");

    // Update icon
    const iconPath = this.getIconPath(status);
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      this.tray.setImage(icon);
    }

    this.updateContextMenu();
  }

  private updateContextMenu(): void {
    if (!this.tray) return;

    const isRecording = this.status.startsWith("recording");

    const menu = Menu.buildFromTemplate([
      {
        label: isRecording ? "⏹ Stop Recording" : "🎙 Start Meeting",
        click: () => {
          if (isRecording) {
            this.handleStopRecording();
          } else {
            this.handleStartMeeting();
          }
        },
      },
      {
        label: "📝 Quick Note",
        accelerator: "CommandOrControl+Shift+N",
        enabled: !isRecording,
        click: () => {
          this.handleStartNote();
        },
      },
      { type: "separator" },
      {
        label: this.getStatusLabel(),
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Open Dashboard",
        click: () => {
          this.toggleWindow();
        },
      },
      {
        label: "Open Web Dashboard",
        click: () => {
          shell.openExternal("http://localhost:3000");
        },
      },
      { type: "separator" },
      {
        label: "Settings...",
        click: () => {
          this.window.show();
          this.window.webContents.send("navigate", "settings");
        },
      },
      {
        label: "Quit OmniScribe",
        click: () => {
          this.daemon.stop();
          this.tray?.destroy();
          process.exit(0);
        },
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  private getStatusLabel(): string {
    switch (this.status) {
      case "idle":
        return "● Ready";
      case "recording-meeting":
        return "🔴 Recording Meeting...";
      case "recording-note":
        return "🔴 Recording Note...";
      case "transcribing":
        return "⏳ Transcribing...";
      case "syncing":
        return "🔄 Syncing...";
      case "error":
        return "⚠ Error";
      default:
        return "● Ready";
    }
  }

  private async handleStartMeeting(): Promise<void> {
    try {
      await this.daemon.startSession("meeting");
      this.updateStatus("recording-meeting");
      this.showNotification("Recording Started", "Meeting recording is active.");
    } catch (err) {
      this.showNotification("Error", `Failed to start: ${err}`);
      this.updateStatus("error");
    }
  }

  private async handleStartNote(): Promise<void> {
    try {
      await this.daemon.startSession("note");
      this.updateStatus("recording-note");
      this.showNotification("Quick Note", "Recording voice note... Press Ctrl+Shift+N to stop.");
    } catch (err) {
      this.showNotification("Error", `Failed to start: ${err}`);
      this.updateStatus("error");
    }
  }

  private async handleStopRecording(): Promise<void> {
    try {
      const session = await this.daemon.stopSession();
      this.updateStatus("transcribing");
      this.showNotification(
        "Recording Stopped",
        session?.title
          ? `Transcribing "${session.title}"...`
          : "Transcribing..."
      );

      // Poll for completion
      this.pollTranscriptionStatus(session?.id);
    } catch (err) {
      this.showNotification("Error", `Failed to stop: ${err}`);
      this.updateStatus("error");
    }
  }

  private async pollTranscriptionStatus(sessionId?: string): Promise<void> {
    if (!sessionId) {
      this.updateStatus("idle");
      return;
    }

    const poll = setInterval(async () => {
      try {
        const session = await this.daemon.getSession(sessionId);
        if (session?.status === "completed") {
          clearInterval(poll);
          this.updateStatus("idle");
          this.showNotification(
            "Transcription Complete",
            session.title || "Session ready for review."
          );
        } else if (session?.status === "failed") {
          clearInterval(poll);
          this.updateStatus("error");
          this.showNotification("Transcription Failed", "Check logs for details.");
        }
      } catch {
        // Daemon might be busy, keep polling
      }
    }, 3000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(poll), 300_000);
  }

  private showNotification(title: string, body: string): void {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  }

  private toggleWindow(): void {
    if (this.window.isVisible()) {
      this.window.hide();
    } else {
      // Position window near tray
      const trayBounds = this.tray?.getBounds();
      if (trayBounds) {
        const windowBounds = this.window.getBounds();
        const x = Math.round(
          trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2
        );
        const y = trayBounds.y - windowBounds.height - 8;
        this.window.setPosition(x, Math.max(y, 0));
      }
      this.window.show();
      this.window.focus();
    }
  }

  private getIconPath(status: TrayStatus): string {
    // Map status to icon file
    const iconMap: Record<TrayStatus, string> = {
      idle: "tray-idle.png",
      "recording-meeting": "tray-recording.png",
      "recording-note": "tray-recording.png",
      transcribing: "tray-processing.png",
      syncing: "tray-syncing.png",
      error: "tray-error.png",
    };
    const filename = iconMap[status] || "tray-idle.png";
    return path.join(__dirname, "..", "..", "assets", filename);
  }
}
