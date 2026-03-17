import { ChildProcess, spawn } from "child_process";
import http from "http";

const DAEMON_HOST = "127.0.0.1";
const DAEMON_PORT = 52849;
const DAEMON_BASE_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;

interface SessionResponse {
  id: string;
  session_type: string;
  title: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
  word_count: number;
}

export class DaemonManager {
  private process: ChildProcess | null = null;
  private _isRecording = false;
  private _currentSessionId: string | null = null;

  get isRecording(): boolean {
    return this._isRecording;
  }

  get currentSessionId(): string | null {
    return this._currentSessionId;
  }

  start(): void {
    if (this.process) {
      console.log("Daemon already running");
      return;
    }

    console.log("Starting OmniScribe daemon...");

    // Try to connect to an already running daemon first
    this.healthCheck()
      .then(() => {
        console.log("Daemon already running externally");
      })
      .catch(() => {
        this.spawnDaemon();
      });
  }

  private spawnDaemon(): void {
    // Look for Python in common locations
    const pythonCommands = ["python", "python3", "py"];

    const trySpawn = (index: number): void => {
      if (index >= pythonCommands.length) {
        console.error("Could not find Python to start daemon");
        return;
      }

      const cmd = pythonCommands[index];
      const daemonProcess = spawn(
        cmd,
        ["-m", "omniscribe_daemon.main", "--host", DAEMON_HOST, "--port", String(DAEMON_PORT)],
        {
          stdio: ["pipe", "pipe", "pipe"],
          detached: false,
          env: { ...process.env },
        }
      );

      daemonProcess.on("error", () => {
        trySpawn(index + 1);
      });

      daemonProcess.stdout?.on("data", (data: Buffer) => {
        console.log(`[daemon] ${data.toString().trim()}`);
      });

      daemonProcess.stderr?.on("data", (data: Buffer) => {
        console.error(`[daemon] ${data.toString().trim()}`);
      });

      daemonProcess.on("exit", (code) => {
        console.log(`Daemon exited with code ${code}`);
        this.process = null;
      });

      this.process = daemonProcess;

      // Wait for daemon to be ready
      this.waitForReady(15_000).then(() => {
        console.log("Daemon is ready");
      }).catch((err) => {
        console.error("Daemon failed to start:", err);
      });
    };

    trySpawn(0);
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private async waitForReady(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        await this.healthCheck();
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    throw new Error("Daemon startup timeout");
  }

  async healthCheck(): Promise<{ status: string; recording: boolean }> {
    return this.request<{ status: string; recording: boolean }>("GET", "/health");
  }

  async startSession(
    type: "meeting" | "note",
    title?: string
  ): Promise<SessionResponse> {
    const body: Record<string, string> = { session_type: type };
    if (title) body.title = title;

    const session = await this.request<SessionResponse>("POST", "/sessions/start", body);
    this._isRecording = true;
    this._currentSessionId = session.id;
    return session;
  }

  async stopSession(): Promise<SessionResponse | null> {
    const session = await this.request<SessionResponse>("POST", "/sessions/stop");
    this._isRecording = false;
    this._currentSessionId = null;
    return session;
  }

  async getCurrentSession(): Promise<{
    recording: boolean;
    session?: SessionResponse;
  }> {
    return this.request("GET", "/sessions/current");
  }

  async listSessions(
    type?: string,
    limit = 20
  ): Promise<{ sessions: SessionResponse[]; count: number }> {
    let url = `/sessions?limit=${limit}`;
    if (type) url += `&session_type=${type}`;
    return this.request("GET", url);
  }

  async getSession(sessionId: string): Promise<SessionResponse | null> {
    try {
      return await this.request<SessionResponse>("GET", `/sessions/${sessionId}`);
    } catch {
      return null;
    }
  }

  async getTranscript(
    sessionId: string
  ): Promise<{ session_id: string; segments: unknown[] }> {
    return this.request("GET", `/sessions/${sessionId}/transcript`);
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const bodyStr = body ? JSON.stringify(body) : undefined;

      const options: http.RequestOptions = {
        hostname: DAEMON_HOST,
        port: DAEMON_PORT,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
        },
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              reject(new Error(`Invalid JSON response: ${data}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on("error", reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }
}
