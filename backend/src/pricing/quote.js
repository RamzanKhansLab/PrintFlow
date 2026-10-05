import { z } from "zod";
import { Document, PricingRule } from "../models/index.js";
import { configSchema, idSchema } from "../middleware/validation.js";
import { assert } from "../middleware/errors.js";

const money = z.number().min(0).max(100000);
const multiplier = z.number().min(0.1).max(100);
export const pricingSchema = z
  .object({
    basePage: money,
    colorMultiplier: multiplier,
    duplexMultiplier: multiplier,
    paperMultipliers: z
      .object({ A4: multiplier, A3: multiplier, Letter: multiplier })
      .strict(),
    binding: z
      .object({ none: z.literal(0), staple: money, spiral: money })
      .strict(),
    rushMultiplier: z.number().min(1).max(100),
    taxPercent: z.number().min(0).max(100),
  })
  .strict();
export async function ensurePricing() {
  await PricingRule.updateOne(
    { key: "default" },
    {
      $setOnInsert: {
        key: "default",
        currency: "INR",
        basePage: 2,
        colorMultiplier: 5,
        duplexMultiplier: 1,
        paperMultipliers: { A4: 1, A3: 2, Letter: 1 },
        binding: { none: 0, staple: 5, spiral: 40 },
        rushMultiplier: 1.5,
        taxPercent: 0,
      },
    },
    { upsert: true },
  );
}
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
export async function createQuote(user, input, session = null) {
  const { documentId, config } = z
    .object({ documentId: idSchema, config: configSchema })
    .parse(input);
  const document = await Document.findById(documentId).session(session);
  assert(
    document && String(document.owner) === String(user._id),
    404,
    "Document not found",
  );
  const rules = await PricingRule.findOne({ key: "default" }).session(session);
  assert(rules, 503, "Pricing is unavailable");
  const pages = selectedPages(config.pageRange, document.pages);
  const impressions = pages * config.copies;
  const sheets = Math.ceil(pages / (config.duplex ? 2 : 1)) * config.copies;
  const printPaise = Math.round(
    rules.basePage *
      100 *
      impressions *
      (config.color ? rules.colorMultiplier : 1) *
      rules.paperMultipliers[config.paperSize] *
      (config.duplex ? rules.duplexMultiplier : 1),
  );
  const bindingPaise = Math.round(
    rules.binding[config.binding] * 100 * config.copies,
  );
  const rushPaise =
    config.urgency === "rush"
      ? Math.round((printPaise + bindingPaise) * (rules.rushMultiplier - 1))
      : 0;
  const subtotalPaise = printPaise + bindingPaise + rushPaise;
  const taxPaise = Math.round((subtotalPaise * rules.taxPercent) / 100);
  const totalPaise = subtotalPaise + taxPaise;
  assert(
    Number.isSafeInteger(totalPaise),
    400,
    "This quote is too large. Reduce the copies or review the pricing rules",
  );
  return {
    document,
    config,
    quote: {
      currency: "INR",
      pages,
      copies: config.copies,
      impressions,
      sheets,
      printPaise,
      bindingPaise,
      rushPaise,
      subtotalPaise,
      taxPaise,
      totalPaise,
      pricingUpdatedAt: rules.updatedAt,
    },
  };
}
