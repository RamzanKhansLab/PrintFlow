import { z } from "zod";

export const idSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Expected a MongoDB ObjectId");
export const roleSchema = z.enum(["customer", "operator", "admin"]);
export const paperSchema = z.enum(["A4", "A3", "Letter"]);
export const configSchema = z
  .object({
    copies: z.number().int().min(1).max(500),
    color: z.boolean(),
    duplex: z.boolean(),
    paperSize: paperSchema,
    pageRange: z.string().max(500).default(""),
    binding: z.enum(["none", "staple", "spiral"]),
    urgency: z.enum(["standard", "rush"]),
  })
  .strict();
export const printerSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    color: z.boolean(),
    duplex: z.boolean(),
    paperSizes: z.array(paperSchema).min(1).max(3),
    capacity: z.number().int().min(1).max(20),
  })
  .strict();
export function validateId(req, res, next) {
  for (const value of Object.values(req.params)) idSchema.parse(value);
  next();
}
export function pagination(query) {
  return z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .parse(query);
}
