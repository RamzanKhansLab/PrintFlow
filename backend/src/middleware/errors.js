import { ZodError } from "zod";

export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function assert(condition, status, message) {
  if (!condition) throw new AppError(status, message);
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message;
  if (error instanceof ZodError) {
    status = 400;
    message = error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
  }
  if (error.name === "CastError" || error.name === "ValidationError") {
    status = 400;
    message = "Invalid data or identifier";
  }
  if (error.code === 11000) {
    status = 409;
    message = "This record already exists";
  }
  if (error.code === "LIMIT_FILE_SIZE") {
    status = 413;
    message = "Files must be 10 MB or smaller";
  } else if (error.name === "MulterError") {
    status = 400;
    message = "Upload one file using the file field";
  }
  if (status >= 500) {
    console.error(`${req.method} ${req.path}: ${error.name}`);
    message =
      "Server could not complete this request. Refresh before retrying.";
  }
  res.status(status).json({ error: message });
}
