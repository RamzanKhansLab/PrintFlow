import mongoose from "mongoose";
import { PDFDocument } from "pdf-lib";
import { Document } from "../models/index.js";
import { AppError, assert } from "../middleware/errors.js";

export const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "uploads",
  });
export async function uploadDocument(user, file) {
  assert(file, 400, "Choose a PDF, PNG or JPEG file");
  let mime;
  let pages;
  try {
    if (file.buffer.subarray(0, 5).toString() === "%PDF-") {
      const pdf = await PDFDocument.load(file.buffer);
      pages = pdf.getPageCount();
      mime = "application/pdf";
    } else if (
      file.buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      const pdf = await PDFDocument.create();
      await pdf.embedPng(file.buffer);
      pages = 1;
      mime = "image/png";
    } else if (
      file.buffer[0] === 255 &&
      file.buffer[1] === 216 &&
      file.buffer[2] === 255
    ) {
      const pdf = await PDFDocument.create();
      await pdf.embedJpg(file.buffer);
      pages = 1;
      mime = "image/jpeg";
    } else throw new Error("Unsupported format");
  } catch {
    throw new AppError(400, "Upload a readable, unencrypted PDF, PNG or JPEG");
  }
  assert(
    pages > 0 && pages <= 2000,
    400,
    "Documents must contain between 1 and 2000 pages",
  );
  const name = file.originalname.replace(/[\r\n\\/]/g, "_").slice(0, 150);
  const stream = bucket().openUploadStream(name, {
    metadata: { owner: String(user._id), mime },
  });
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
    stream.end(file.buffer);
  });
  try {
    return await Document.create({
      owner: user._id,
      fileId: stream.id,
      name,
      mime,
      bytes: file.size,
      pages,
    });
  } catch (error) {
    await bucket()
      .delete(stream.id)
      .catch(() => {});
    throw error;
  }
}
