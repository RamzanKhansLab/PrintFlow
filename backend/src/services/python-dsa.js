import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { AppError } from "../middleware/errors.js";

/** Transport only. All queue data and algorithms live in the Python worker. */
export class PythonDsa {
  constructor(onFailure = () => {}) {
    this.command =
      process.env.PYTHON_BIN ||
      (process.platform === "win32" ? "python" : "python3");
    this.onFailure = onFailure;
    this.child = null;
    this.starting = null;
    this.requests = new Map();
    this.sequence = 0;
    this.closed = false;
  }

  get running() {
    return Boolean(this.child && !this.child.killed);
  }

  async start() {
    if (this.closed) throw new AppError(503, "The DSA worker is shutting down");
    if (this.starting) return this.starting;
    if (this.running) return;
    const child = spawn(this.command, ["-u", "-B", "-m", "dsa.worker"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    this.child = child;
    const fail = (message) => {
      if (this.child !== child) return;
      this.child = null;
      for (const request of this.requests.values()) {
        clearTimeout(request.timer);
        request.reject(new AppError(503, message));
      }
      this.requests.clear();
      this.onFailure();
      if (!child.killed) child.kill();
    };
    this.fail = fail;
    child.on("error", () =>
      fail(
        `Cannot start Python DSA worker. Install Python 3.10+ and check PYTHON_BIN (${this.command})`,
      ),
    );
    child.on("exit", () =>
      fail(
        "The Python DSA worker stopped. The scheduler will restore from MongoDB",
      ),
    );
    child.stdin.on("error", () => fail("The Python DSA connection failed"));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (message) =>
      process.stderr.write(`[Python DSA] ${message}`),
    );
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      if (this.child !== child) return;
      let response;
      try {
        response = JSON.parse(line);
      } catch {
        fail("Invalid response from the Python DSA worker");
        return;
      }
      const request = this.requests.get(response.id);
      if (!request) return;
      this.requests.delete(response.id);
      clearTimeout(request.timer);
      if (response.error)
        request.reject(new AppError(response.status || 503, response.error));
      else request.resolve(response.result);
    });
    child.on("close", () => lines.close());
    this.starting = this.request("ping").finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  request(operation, payload = {}) {
    if (!this.running || this.closed)
      return Promise.reject(
        new AppError(
          503,
          "Python DSA is unavailable; scheduler recovery is required",
        ),
      );
    const child = this.child;
    const id = ++this.sequence;
    const line = JSON.stringify({ id, operation, payload }) + "\n";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.child === child)
          this.fail("Python DSA timed out; scheduler recovery is required");
      }, 15000);
      this.requests.set(id, { resolve, reject, timer });
      child.stdin.write(line, (error) => {
        if (error && this.child === child)
          this.fail("Could not send a request to Python DSA");
      });
    });
  }

  async close() {
    this.closed = true;
    const child = this.child;
    this.child = null;
    for (const request of this.requests.values()) {
      clearTimeout(request.timer);
      request.reject(new AppError(503, "The DSA worker is shutting down"));
    }
    this.requests.clear();
    if (!child) return;
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, 2000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
      child.stdin.end();
    });
  }
}
