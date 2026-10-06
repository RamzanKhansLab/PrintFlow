import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AuditLog,
  Order,
  PrintJob,
  Printer,
  Inventory,
} from "../models/index.js";
import { assert } from "../middleware/errors.js";
import {
  idSchema,
  configSchema,
  printerSchema,
  paperSchema,
} from "../middleware/validation.js";
import { preparePrint } from "../printing/plan.js";

export async function transaction(actor, action, operation) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const result = await operation(session);
      await AuditLog.create(
        [
          {
            actor: actor._id,
            action,
            entity: String(
              result.job?._id || result.order?._id || result._id || "",
            ),
            detail: action,
          },
        ],
        { session },
      );
      return result;
    });
  } finally {
    await session.endSession();
  }
}

const orderInput = z
  .object({
    documentId: idSchema,
    config: configSchema,
    deadline: z.iso.datetime({ offset: true }).nullable().optional(),
    clientRequestId: z.uuid(),
  })
  .strict();

export class Workflow {
  constructor(scheduler, events) {
    this.scheduler = scheduler;
    this.events = events;
  }
  notify(event, result) {
    if (result.job) this.events.job(event, result.job);
    if (result.order) this.events.order(result.order);
    return result;
  }
  createOrder(user, input) {
    const data = orderInput.parse(input);
    return this.scheduler.exclusive(async () => {
      const existing = await Order.findOne({
        customer: user._id,
        clientRequestId: data.clientRequestId,
      }).lean();
      if (existing)
        return {
          order: existing,
          job: await PrintJob.findOne({ order: existing._id }).lean(),
        };
      assert(
        !data.deadline || new Date(data.deadline) > new Date(),
        400,
        "The deadline must be in the future",
      );
      const result = await transaction(
        user,
        "order.created",
        async (session) => {
          const { document, config, printSummary } = await preparePrint(
            user,
            data,
            session,
          );
          const [order] = await Order.create(
            [
              {
                customer: user._id,
                document: document._id,
                config,
                printSummary,
                deadline: data.deadline,
                clientRequestId: data.clientRequestId,
                reference: `PF-${randomUUID().slice(0, 8).toUpperCase()}`,
              },
            ],
            { session },
          );
          const [job] = await PrintJob.create(
            [
              {
                order: order._id,
                customer: user._id,
                document: document._id,
                label: order.reference,
                config,
                sheets: printSummary.sheets,
                priorityScore: await this.scheduler.priorityFor(config),
                deadline: data.deadline,
              },
            ],
            { session },
          );
          return { order: order.toObject(), job: job.toObject() };
        },
      );
      await this.scheduler.enqueue(result.job);
      this.events.job("job:created", result.job);
      return this.notify("job:queued", result);
    });
  }
  cancelOrder(user, id) {
    return this.scheduler.exclusive(async () => {
      const result = await transaction(
        user,
        "order.cancelled",
        async (session) => {
          const order = await Order.findById(id).session(session);
          assert(
            order &&
              (user.role !== "customer" ||
                String(order.customer) === String(user._id)),
            404,
            "Print request not found",
          );
          assert(
            order.status === "QUEUED",
            409,
            "Only a print request that has not started can be cancelled",
          );
          const job = await PrintJob.findOneAndUpdate(
            { order: id, status: { $in: ["QUEUED", "ASSIGNED"] } },
            { $set: { status: "CANCELLED" } },
            { new: true, session },
          );
          assert(job, 409, "This job can no longer be cancelled");
          order.status = "CANCELLED";
          await order.save({ session });
          return { job: job.toObject(), order: order.toObject() };
        },
      );
      await this.scheduler.removePending(result.job._id);
      return this.notify("job:cancelled", result);
    });
  }
  addPrinter(user, input) {
    const data = printerSchema.parse(input);
    return this.scheduler.exclusive(async () => {
      const printer = await transaction(
        user,
        "printer.created",
        async (session) => {
          const [record] = await Printer.create([data], { session });
          return record.toObject();
        },
      );
      await this.scheduler.addPrinter(printer);
      this.events.staff("printer:offline", printer);
      return printer;
    });
  }
  setPrinterStatus(user, id, input) {
    const { status } = z
      .object({ status: z.enum(["online", "offline", "error"]) })
      .strict()
      .parse(input);
    return this.scheduler.exclusive(async () => {
      await this.scheduler.station(id);
      const printer = await transaction(
        user,
        `printer.${status}`,
        async (session) => {
          const updated = await Printer.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true, session },
          ).lean();
          if (status !== "online")
            await PrintJob.updateMany(
              { printer: id, status: "ASSIGNED" },
              {
                $set: { status: "QUEUED", printer: null, assignedAt: null },
              },
              { session },
            );
          return updated;
        },
      );
      const requeued = await this.scheduler.setPrinterStatus(printer);
      for (const job of requeued) this.events.job("job:queued", job);
      this.events.staff(`printer:${status}`, printer);
      return printer;
    });
  }
  startPrinter(user, id) {
    return this.scheduler.exclusive(async () => {
      const station = await this.scheduler.station(id);
      assert(
        station.printer.status === "online",
        409,
        "Bring this printer online before starting",
      );
      assert(!station.active, 409, "This printer already has an active job");
      const next = station.next;
      assert(next, 409, "The printer buffer is empty");
      const result = await transaction(user, "job.started", async (session) => {
        const job = await PrintJob.findOneAndUpdate(
          { _id: next._id, status: "ASSIGNED" },
          {
            $set: { status: "PRINTING", startedAt: new Date(), progress: 0 },
          },
          { new: true, session },
        ).lean();
        assert(job, 409, "Job state changed. Refresh the station");
        const stock = await Inventory.findOneAndUpdate(
          { paperSize: job.config.paperSize, sheets: { $gte: job.sheets } },
          { $inc: { sheets: -job.sheets } },
          { new: true, session },
        );
        assert(
          stock,
          409,
          `Insufficient ${job.config.paperSize} paper. ${job.sheets} sheets are required`,
        );
        const order = await Order.findByIdAndUpdate(
          job.order,
          { $set: { status: "IN_PROGRESS" } },
          { new: true, session },
        ).lean();
        return { job, order };
      });
      await this.scheduler.startPrint(result.job);
      return this.notify("job:started", result);
    });
  }
  progress(user, id, input) {
    const { progress } = z
      .object({ progress: z.number().int().min(0).max(99) })
      .strict()
      .parse(input);
    return this.scheduler.exclusive(async () => {
      const job = await transaction(user, "job.progress", async (session) => {
        const updated = await PrintJob.findOneAndUpdate(
          { _id: id, status: "PRINTING", progress: { $lte: progress } },
          { $set: { progress } },
          { new: true, session },
        ).lean();
        assert(updated, 409, "Progress must increase on an active print job");
        return updated;
      });
      await this.scheduler.progress(job);
      this.events.job("job:progress", job);
      return job;
    });
  }
  finishPrinting(user, id, input, failed = false) {
    const { reason } = failed
      ? z
          .object({ reason: z.string().trim().min(3).max(500) })
          .strict()
          .parse(input)
      : { reason: null };
    return this.scheduler.exclusive(async () => {
      const result = await transaction(
        user,
        failed ? "job.failed" : "job.printed",
        async (session) => {
          const changes = failed
            ? { status: "FAILED", failureReason: reason }
            : { status: "PRINTED", printedAt: new Date(), progress: 100 };
          const job = await PrintJob.findOneAndUpdate(
            { _id: id, status: "PRINTING" },
            { $set: changes },
            { new: true, session },
          ).lean();
          assert(job, 409, "Only a printing job can be finished or failed");
          const order = await Order.findByIdAndUpdate(
            job.order,
            { $set: { status: failed ? "ATTENTION" : "QUALITY_CHECK" } },
            { new: true, session },
          ).lean();
          return { job, order };
        },
      );
      await this.scheduler.finishPrint(result.job);
      return this.notify(failed ? "job:failed" : "job:printed", result);
    });
  }
  startQualityCheck(user) {
    return this.scheduler.exclusive(async () => {
      const qualityCheck = await this.scheduler.qualityCheck();
      assert(
        !qualityCheck.active,
        409,
        "Finish the active quality check first",
      );
      const next = qualityCheck.next;
      assert(next, 409, "The quality check queue is empty");
      const job = await transaction(user, "qc.started", async (session) => {
        const updated = await PrintJob.findOneAndUpdate(
          { _id: next._id, status: "PRINTED" },
          { $set: { status: "QUALITY_CHECK", qcStartedAt: new Date() } },
          { new: true, session },
        ).lean();
        assert(updated, 409, "Quality check state changed");
        return updated;
      });
      await this.scheduler.startQualityCheck(job);
      this.events.job("job:quality-check", job);
      return job;
    });
  }
  finishQualityCheck(user, id, input) {
    const { passed, notes } = z
      .object({
        passed: z.boolean(),
        notes: z.string().trim().max(500).default(""),
      })
      .strict()
      .parse(input);
    assert(
      passed || notes.length >= 3,
      400,
      "Explain why quality control failed",
    );
    return this.scheduler.exclusive(async () => {
      const qualityCheck = await this.scheduler.qualityCheck();
      assert(
        String(qualityCheck.active?._id) === id,
        409,
        "This is not the active quality check",
      );
      const result = await transaction(
        user,
        passed ? "qc.passed" : "qc.failed",
        async (session) => {
          const job = await PrintJob.findOneAndUpdate(
            { _id: id, status: "QUALITY_CHECK" },
            {
              $set: {
                status: passed ? "COMPLETED" : "FAILED",
                qcNotes: notes,
                ...(passed
                  ? { completedAt: new Date() }
                  : { failureReason: notes }),
              },
            },
            { new: true, session },
          ).lean();
          assert(job, 409, "This quality check has already been completed");
          const order = await Order.findByIdAndUpdate(
            job.order,
            { $set: { status: passed ? "READY" : "ATTENTION" } },
            { new: true, session },
          ).lean();
          return { job, order };
        },
      );
      await this.scheduler.finishQualityCheck(result.job);
      return this.notify(passed ? "job:completed" : "job:failed", result);
    });
  }
  reprint(user, id) {
    return this.scheduler.exclusive(async () => {
      const result = await transaction(user, "job.reprint", async (session) => {
        const original = await PrintJob.findOne({
          _id: id,
          status: "FAILED",
          reprintJob: null,
        }).session(session);
        assert(
          original,
          409,
          "Only a failed job without an existing reprint can be retried",
        );
        const [job] = await PrintJob.create(
          [
            {
              order: original.order,
              customer: original.customer,
              document: original.document,
              label: original.label,
              config: original.config,
              sheets: original.sheets,
              priorityScore: await this.scheduler.priorityFor(
                original.config,
                true,
              ),
              deadline: original.deadline,
              reprintOf: original._id,
            },
          ],
          { session },
        );
        original.reprintJob = job._id;
        await original.save({ session });
        const order = await Order.findByIdAndUpdate(
          original.order,
          { $set: { status: "QUEUED" } },
          { new: true, session },
        ).lean();
        return { job: job.toObject(), order };
      });
      await this.scheduler.enqueue(result.job);
      this.events.job("job:created", result.job);
      return this.notify("job:queued", result);
    });
  }
  restock(user, input) {
    const { paperSize, sheets } = z
      .object({
        paperSize: paperSchema,
        sheets: z.number().int().min(1).max(1000000),
      })
      .strict()
      .parse(input);
    return this.scheduler.exclusive(async () => {
      const inventory = await transaction(
        user,
        `inventory.restock.${paperSize}.${sheets}`,
        async (session) =>
          Inventory.findOneAndUpdate(
            { paperSize },
            { $inc: { sheets } },
            { upsert: true, new: true, session, setDefaultsOnInsert: false },
          ).lean(),
      );
      this.events.staff("inventory:updated", inventory);
      return inventory;
    });
  }
}
