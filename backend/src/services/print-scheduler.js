import { PrintJob, Printer } from "../models/index.js";
import { assert } from "../middleware/errors.js";
import { PythonDsa } from "./python-dsa.js";

/** MongoDB/Socket.IO integration. Python owns every queue and routing decision. */
export class PrintSchedulerService {
  constructor(events) {
    this.events = events;
    this.restored = false;
    this.worker = new PythonDsa(() => { this.restored = false; });
    this.tail = Promise.resolve();
  }
  get ready() { return this.restored && this.worker.running; }
  set ready(value) { this.restored = value; }

  exclusive(operation) {
    const result = this.tail.then(async () => {
      try {
        if (!this.ready) await this.restore();
        const value = await operation();
        await this.dispatch();
        this.events.staff("queue:updated", await this.worker.request("snapshot"));
        return value;
      } catch (error) {
        this.ready = false;
        try { await this.restore(); }
        catch { /* The next operation or recovery timer retries. */ }
        throw error;
      }
    });
    this.tail = result.catch(() => {});
    return result;
  }

  async restore() {
    this.ready = false;
    await this.worker.start();
    const [printers, jobs, qcJobs] = await Promise.all([
      Printer.find().sort({ _id: 1 }).lean(),
      PrintJob.find({ status: { $in: ["QUEUED", "ASSIGNED", "PRINTING", "QUALITY_CHECK"] } })
        .sort({ assignedAt: 1, createdAt: 1, _id: 1 }).lean(),
      PrintJob.find({ status: "PRINTED" }).sort({ printedAt: 1, _id: 1 }).lean(),
    ]);
    const requeued = await this.worker.request("restore", { printers, jobs, qcJobs });
    if (requeued.length) await PrintJob.updateMany(
      { _id: { $in: requeued }, status: "ASSIGNED" },
      { $set: { status: "QUEUED", printer: null, assignedAt: null } },
    );
    this.ready = true;
  }

  async dispatch() {
    const assignments = await this.worker.request("plan_dispatch");
    for (const { jobId, printerId } of assignments) {
      const assigned = await PrintJob.findOneAndUpdate(
        { _id: jobId, status: "QUEUED" },
        { $set: { status: "ASSIGNED", printer: printerId, assignedAt: new Date() } },
        { new: true },
      ).lean();
      assert(assigned, 409, "A planned assignment changed; refresh the queue");
      await this.worker.request("confirm_assignment", { job: assigned });
      this.events.job("job:assigned", assigned);
    }
  }

  readSnapshot() {
    // Readers wait behind complete operations so they never see an uncommitted plan.
    const result = this.tail.then(() => {
      assert(this.ready, 503, "The scheduler is recovering");
      return this.worker.request("snapshot");
    });
    this.tail = result.catch(() => {});
    return result;
  }

  priorityFor(config, reprint = false) { return this.worker.request("priority", { config, reprint }); }
  enqueue(job) { return this.worker.request("enqueue", { job }); }
  removePending(id) { return this.worker.request("remove_pending", { id }); }
  addPrinter(printer) { return this.worker.request("add_printer", { printer }); }
  station(id) { return this.worker.request("station", { id }); }
  setPrinterStatus(printer) { return this.worker.request("set_printer_status", { printer }); }
  startPrint(job) { return this.worker.request("start_print", { job }); }
  progress(job) { return this.worker.request("progress", { job }); }
  finishPrint(job) { return this.worker.request("finish_print", { job }); }
  qualityCheck() { return this.worker.request("quality_check"); }
  startQualityCheck(job) { return this.worker.request("start_quality_check", { job }); }
  finishQualityCheck(job) { return this.worker.request("finish_quality_check", { job }); }
  inspectDemo(userId) { return this.worker.request("demo_inspect", { userId }); }
  operateDemo(userId, data) { return this.worker.request("demo_operate", { userId, data }); }
  async close() { this.ready = false; await this.worker.close(); }
}
