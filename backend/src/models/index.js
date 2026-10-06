import mongoose from "mongoose";

const { Schema } = mongoose;
const ref = (model, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required,
});
const options = { timestamps: true, versionKey: false };
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["customer", "operator", "admin"],
      default: "customer",
    },
  },
  options,
);
export const User = mongoose.model("User", userSchema, "users");
export const Document = mongoose.model(
  "Document",
  new Schema(
    {
      owner: ref("User"),
      fileId: { type: Schema.Types.ObjectId, required: true },
      name: String,
      mime: String,
      bytes: Number,
      pages: Number,
    },
    options,
  ),
  "documents",
);
const orderSchema = new Schema(
  {
    customer: ref("User"),
    document: ref("Document"),
    reference: { type: String, required: true, unique: true },
    clientRequestId: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    printSummary: Schema.Types.Mixed,
    deadline: Date,
    status: {
      type: String,
      enum: [
        "QUEUED",
        "IN_PROGRESS",
        "QUALITY_CHECK",
        "READY",
        "ATTENTION",
        "CANCELLED",
      ],
      default: "QUEUED",
    },
  },
  options,
);
// Exclude legacy monetary snapshots without modifying existing database records.
orderSchema.pre(/^find/, function () {
  this.select("-quote");
});
orderSchema.index({ customer: 1, clientRequestId: 1 }, { unique: true });
orderSchema.index({ customer: 1, createdAt: -1 });
export const Order = mongoose.model("Order", orderSchema, "orders");
const jobSchema = new Schema(
  {
    order: ref("Order"),
    customer: ref("User"),
    document: ref("Document"),
    label: String,
    config: Schema.Types.Mixed,
    sheets: Number,
    priorityScore: Number,
    deadline: Date,
    status: {
      type: String,
      enum: [
        "QUEUED",
        "ASSIGNED",
        "PRINTING",
        "PRINTED",
        "QUALITY_CHECK",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
      ],
      default: "QUEUED",
    },
    printer: ref("Printer", false),
    progress: { type: Number, default: 0 },
    assignedAt: Date,
    startedAt: Date,
    printedAt: Date,
    qcStartedAt: Date,
    completedAt: Date,
    failureReason: String,
    qcNotes: String,
    reprintOf: ref("PrintJob", false),
    reprintJob: ref("PrintJob", false),
  },
  options,
);
jobSchema.index({ status: 1, createdAt: 1 });
jobSchema.index({ order: 1, createdAt: 1 });
export const PrintJob = mongoose.model("PrintJob", jobSchema, "printJobs");
export const Printer = mongoose.model(
  "Printer",
  new Schema(
    {
      name: { type: String, required: true, unique: true },
      color: Boolean,
      duplex: Boolean,
      paperSizes: [String],
      capacity: Number,
      status: {
        type: String,
        enum: ["online", "offline", "error"],
        default: "offline",
      },
    },
    options,
  ),
  "printers",
);
export const Inventory = mongoose.model(
  "Inventory",
  new Schema(
    {
      paperSize: {
        type: String,
        enum: ["A4", "A3", "Letter"],
        unique: true,
        required: true,
      },
      sheets: { type: Number, min: 0, default: 0 },
    },
    options,
  ),
  "inventory",
);
export const AuditLog = mongoose.model(
  "AuditLog",
  new Schema(
    {
      actor: ref("User", false),
      action: String,
      entity: String,
      detail: String,
    },
    options,
  ),
  "auditLogs",
);
