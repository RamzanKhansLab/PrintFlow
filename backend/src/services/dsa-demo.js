import { z } from "zod";

// HTTP input validation only. Sandbox state and algorithms live in dsa/demo.py.
const requestSchema = z
  .object({
    structure: z.enum(["fifo", "priority", "circular"]),
    operation: z.enum(["enqueue", "dequeue", "peek", "clear"]),
    job: z
      .object({
        id: z.string().trim().min(1).max(30),
        priorityScore: z.number().int().min(0).max(1000),
        deadline: z.iso.datetime({ offset: true }).nullable().optional(),
      })
      .optional(),
  })
  .strict();

export function inspectDemo(scheduler, id) {
  return scheduler.inspectDemo(String(id));
}
export function operateDemo(scheduler, id, input) {
  return scheduler.operateDemo(String(id), requestSchema.parse(input));
}
