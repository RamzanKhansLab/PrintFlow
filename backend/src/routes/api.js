import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import mongoose from "mongoose";
import {
  User,
  Document,
  Order,
  PrintJob,
  Printer,
  Inventory,
  AuditLog,
} from "../models/index.js";
import { assert } from "../middleware/errors.js";
import { publicUser, roles } from "../middleware/auth.js";
import {
  validateId,
  pagination,
  roleSchema,
} from "../middleware/validation.js";
import { preparePrint } from "../printing/plan.js";
import { bucket, uploadDocument } from "../services/files.js";
import { inspectDemo, operateDemo } from "../services/dsa-demo.js";
import { transaction } from "../services/workflow.js";

const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(10)
    .max(72)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password must be at most 72 UTF-8 bytes",
    ),
});
const limited = (limit, windowMs) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later" },
  });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
});
const staff = roles("admin", "operator");
const admin = roles("admin");

async function list(model, filter, query, populate) {
  const { page, limit } = pagination(query);
  let cursor = model
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  if (populate) cursor = cursor.populate(populate);
  const [data, total] = await Promise.all([
    cursor.lean(),
    model.countDocuments(filter),
  ]);
  return {
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export function apiRoutes({ auth, scheduler, workflow, events }) {
  const api = Router();
  api.get("/health", (req, res) => {
    const healthy = mongoose.connection.readyState === 1 && scheduler.ready;
    res
      .status(healthy ? 200 : 503)
      .json({ status: healthy ? "ok" : "unavailable" });
  });
  api.use(limited(600, 15 * 60 * 1000));
  const authLimit = limited(20, 15 * 60 * 1000);
  api.post("/auth/register", authLimit, async (req, res) => {
    const input = credentials
      .extend({ name: z.string().trim().min(2).max(80) })
      .strict()
      .parse(req.body);
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
    });
    auth.setSession(res, user);
    res.status(201).json({ data: publicUser(user) });
  });
  api.post("/auth/login", authLimit, async (req, res) => {
    const { email, password } = credentials.strict().parse(req.body);
    const user = await User.findOne({ email }).select("+passwordHash");
    assert(
      user && (await bcrypt.compare(password, user.passwordHash)),
      401,
      "Email or password is incorrect",
    );
    auth.setSession(res, user);
    res.json({ data: publicUser(user) });
  });
  api.post("/auth/logout", auth.required, (req, res) => {
    auth.clearSession(res);
    events.disconnectUser(req.user._id);
    res.json({ data: { signedOut: true } });
  });
  api.get("/auth/me", auth.required, (req, res) =>
    res.json({ data: publicUser(req.user) }),
  );
  api.post("/print/preview", auth.required, async (req, res) => {
    const { printSummary } = await preparePrint(req.user, req.body);
    res.json({ data: printSummary });
  });
  api.post(
    "/files",
    auth.required,
    limited(15, 60 * 1000),
    upload.single("file"),
    async (req, res) => {
      res.status(201).json({ data: await uploadDocument(req.user, req.file) });
    },
  );
  api.get("/files", auth.required, async (req, res) =>
    res.json(await list(Document, { owner: req.user._id }, req.query)),
  );
  api.get(
    "/files/:id/download",
    auth.required,
    validateId,
    async (req, res, next) => {
      const document = await Document.findById(req.params.id);
      assert(
        document &&
          (req.user.role !== "customer" ||
            String(document.owner) === String(req.user._id)),
        404,
        "Document not found",
      );
      res.type(document.mime);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="document.${document.mime === "application/pdf" ? "pdf" : document.mime === "image/png" ? "png" : "jpg"}"; filename*=UTF-8''${encodeURIComponent(document.name)}`,
      );
      res.setHeader("Cache-Control", "private, no-store");
      const stream = bucket().openDownloadStream(document.fileId);
      stream.on("error", next);
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    },
  );
  api.post("/orders", auth.required, async (req, res) =>
    res
      .status(201)
      .json({ data: await workflow.createOrder(req.user, req.body) }),
  );
  api.get("/orders", auth.required, async (req, res) => {
    const filter =
      req.user.role === "customer" ? { customer: req.user._id } : {};
    res.json(
      await list(Order, filter, req.query, {
        path: "document",
        select: "name pages",
      }),
    );
  });
  api.get("/orders/track/:reference", auth.required, async (req, res) => {
    const reference = z
      .string()
      .regex(/^PF-[A-F0-9]{8}$/)
      .parse(req.params.reference.toUpperCase());
    const filter = {
      reference,
      ...(req.user.role === "customer" ? { customer: req.user._id } : {}),
    };
    const order = await Order.findOne(filter)
      .populate("document", "name pages")
      .lean();
    assert(order, 404, "Print request not found");
    res.json({
      data: {
        order,
        jobs: await PrintJob.find({ order: order._id })
          .sort({ createdAt: 1 })
          .lean(),
      },
    });
  });
  api.get("/orders/:id", auth.required, validateId, async (req, res) => {
    const order = await Order.findById(req.params.id)
      .populate("document", "name pages")
      .lean();
    assert(
      order &&
        (req.user.role !== "customer" ||
          String(order.customer) === String(req.user._id)),
      404,
      "Print request not found",
    );
    res.json({
      data: {
        order,
        jobs: await PrintJob.find({ order: order._id })
          .sort({ createdAt: 1 })
          .lean(),
      },
    });
  });
  api.post("/orders/:id/cancel", auth.required, validateId, async (req, res) =>
    res.json({ data: await workflow.cancelOrder(req.user, req.params.id) }),
  );
  api.get("/queue", auth.required, staff, async (req, res) => {
    res.json({ data: await scheduler.readSnapshot() });
  });
  api.post("/queue/schedule", auth.required, staff, async (req, res) => {
    await scheduler.exclusive(async () => {});
    res.json({ data: await scheduler.readSnapshot() });
  });
  api.post("/queue/qc/start", auth.required, staff, async (req, res) =>
    res.json({ data: await workflow.startQualityCheck(req.user) }),
  );
  api.get("/printers", auth.required, staff, async (req, res) =>
    res.json({ data: await Printer.find().sort({ name: 1 }).lean() }),
  );
  api.post("/printers", auth.required, admin, async (req, res) =>
    res
      .status(201)
      .json({ data: await workflow.addPrinter(req.user, req.body) }),
  );
  api.patch(
    "/printers/:id/status",
    auth.required,
    staff,
    validateId,
    async (req, res) =>
      res.json({
        data: await workflow.setPrinterStatus(
          req.user,
          req.params.id,
          req.body,
        ),
      }),
  );
  api.post(
    "/printers/:id/start",
    auth.required,
    staff,
    validateId,
    async (req, res) =>
      res.json({ data: await workflow.startPrinter(req.user, req.params.id) }),
  );
  api.get("/jobs", auth.required, staff, async (req, res) => {
    const status = z
      .enum([
        "QUEUED",
        "ASSIGNED",
        "PRINTING",
        "PRINTED",
        "QUALITY_CHECK",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
      ])
      .optional()
      .parse(req.query.status);
    res.json(await list(PrintJob, status ? { status } : {}, req.query));
  });
  api.patch(
    "/jobs/:id/progress",
    auth.required,
    staff,
    validateId,
    async (req, res) =>
      res.json({
        data: await workflow.progress(req.user, req.params.id, req.body),
      }),
  );
  api.post(
    "/jobs/:id/printed",
    auth.required,
    staff,
    validateId,
    async (req, res) =>
      res.json({
        data: await workflow.finishPrinting(req.user, req.params.id, {}),
      }),
  );
  api.post(
    "/jobs/:id/fail",
    auth.required,
    staff,
    validateId,
    async (req, res) =>
      res.json({
        data: await workflow.finishPrinting(
          req.user,
          req.params.id,
          req.body,
          true,
        ),
      }),
  );
  api.post("/jobs/:id/qc", auth.required, staff, validateId, async (req, res) =>
    res.json({
      data: await workflow.finishQualityCheck(
        req.user,
        req.params.id,
        req.body,
      ),
    }),
  );
  api.post(
    "/jobs/:id/reprint",
    auth.required,
    staff,
    validateId,
    async (req, res) =>
      res
        .status(201)
        .json({ data: await workflow.reprint(req.user, req.params.id) }),
  );
  api.get("/inventory", auth.required, staff, async (req, res) =>
    res.json({ data: await Inventory.find().sort({ paperSize: 1 }).lean() }),
  );
  api.post("/inventory/restock", auth.required, staff, async (req, res) =>
    res.json({ data: await workflow.restock(req.user, req.body) }),
  );
  api.get("/dsa", auth.required, staff, async (req, res) =>
    res.json({ data: await inspectDemo(scheduler, req.user._id) }),
  );
  api.post("/dsa/operate", auth.required, staff, async (req, res) =>
    res.json({ data: await operateDemo(scheduler, req.user._id, req.body) }),
  );
  api.get("/users", auth.required, admin, async (req, res) =>
    res.json(await list(User, {}, req.query)),
  );
  api.patch(
    "/users/:id/role",
    auth.required,
    admin,
    validateId,
    async (req, res) => {
      const { role } = z.object({ role: roleSchema }).strict().parse(req.body);
      assert(
        String(req.user._id) !== req.params.id,
        409,
        "Change another account; self-demotion is disabled",
      );
      const user = await transaction(
        req.user,
        `user.role.${role}`,
        async (session) => {
          const updated = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { role } },
            { new: true, session },
          );
          assert(updated, 404, "User not found");
          return publicUser(updated);
        },
      );
      events.disconnectUser(req.params.id);
      res.json({ data: user });
    },
  );
  api.get("/audit", auth.required, admin, async (req, res) =>
    res.json(
      await list(AuditLog, {}, req.query, {
        path: "actor",
        select: "name email",
      }),
    ),
  );
  return api;
}
