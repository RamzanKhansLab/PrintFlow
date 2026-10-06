import { createServer } from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { readConfig } from "./config/env.js";
import * as models from "./models/index.js";
import { authentication } from "./middleware/auth.js";
import { configureSockets } from "./sockets/index.js";
import { PrintSchedulerService } from "./services/print-scheduler.js";
import { Workflow } from "./services/workflow.js";
import { createApp } from "./app.js";

let scheduler;

async function main() {
  const config = readConfig();
  mongoose.set("bufferCommands", false);
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "PrintFlow requires MongoDB Atlas or a replica set for transactions",
    );
  await Promise.all(Object.values(models).map((model) => model.init()));
  let app;
  const server = createServer((req, res) => app(req, res));
  const io = new Server(server, {
    serveClient: false,
    allowRequest(req, done) {
      const origin = req.headers.origin;
      try {
        done(null, !origin || new URL(origin).host === req.headers.host);
      } catch {
        done(null, false);
      }
    },
  });
  const auth = authentication(config);
  const events = configureSockets(io, auth);
  scheduler = new PrintSchedulerService(events);
  const workflow = new Workflow(scheduler, events);
  await scheduler.exclusive(async () => {});
  app = createApp({ config, auth, events, scheduler, workflow });
  mongoose.connection.on("disconnected", () => {
    scheduler.ready = false;
  });
  const recovery = setInterval(() => {
    if (!scheduler.ready)
      scheduler
        .exclusive(async () => {})
        .catch(() =>
          console.error("Scheduler recovery is waiting for the database"),
        );
  }, 30000);
  recovery.unref();
  server.on("error", (error) => {
    console.error(`HTTP server error: ${error.code || error.name}`);
    process.exit(1);
  });
  server.listen(config.port, "0.0.0.0", () =>
    console.log(`PrintFlow listening on port ${config.port}`),
  );
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(recovery);
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    scheduler.ready = false;
    await new Promise((resolve) => io.close(resolve));
    await scheduler.tail;
    await scheduler.close();
    await mongoose.disconnect();
    clearTimeout(timeout);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch(async (error) => {
  console.error(
    error.name === "Error"
      ? error.message
      : `Startup failed: ${error.name}. Check MongoDB access and Python availability.`,
  );
  await scheduler?.close();
  await mongoose.disconnect();
  process.exitCode = 1;
});
