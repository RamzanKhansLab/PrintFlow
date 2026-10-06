import { z } from "zod";
import { Document } from "../models/index.js";
import { configSchema, idSchema } from "../middleware/validation.js";
import { assert } from "../middleware/errors.js";

export function selectedPages(range, pageCount) {
  if (!range.trim()) return pageCount;
  const selected = new Set();
  for (const part of range.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    assert(match, 400, "Use a page range such as 1-3,5");
    const first = Number(match[1]);
    const last = Number(match[2] || match[1]);
    assert(
      first >= 1 && last >= first && last <= pageCount,
      400,
      `Pages must be between 1 and ${pageCount}`,
    );
    for (let page = first; page <= last; page += 1) selected.add(page);
  }
  return selected.size;
}

export async function preparePrint(user, input, session = null) {
  const { documentId, config } = z
    .object({ documentId: idSchema, config: configSchema })
    .parse(input);
  const document = await Document.findById(documentId).session(session);
  assert(
    document && String(document.owner) === String(user._id),
    404,
    "Document not found",
  );
  const pages = selectedPages(config.pageRange, document.pages);
  return {
    document,
    config,
    printSummary: {
      pages,
      copies: config.copies,
      impressions: pages * config.copies,
      sheets: Math.ceil(pages / (config.duplex ? 2 : 1)) * config.copies,
    },
  };
}
