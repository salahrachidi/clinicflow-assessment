import { z } from "zod";

const optionalQuery = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => value === "" ? undefined : value, schema.optional());

export const activityListSchema = z.object({
  entityType: optionalQuery(z.enum(["patient", "appointment"])),
  action: optionalQuery(z.enum([
    "patient.created",
    "patient.updated",
    "patient.archived",
    "appointment.created",
    "appointment.status_changed",
    "appointment.rescheduled"
  ])),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
