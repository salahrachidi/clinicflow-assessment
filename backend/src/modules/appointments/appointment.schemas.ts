import { z } from "zod";

export const appointmentIdSchema = z.object({ id: z.uuid() });
export const createAppointmentSchema = z.object({
  patientId: z.uuid(),
  appointmentDate: z.iso.datetime({ offset: true }),
  status: z.enum(["pending", "confirmed", "cancelled"]).default("pending"),
  reason: z.string().trim().min(2).max(300),
  notes: z.string().trim().max(2000).nullable().optional()
});
export const updateStatusSchema = z.object({ status: z.enum(["pending", "confirmed", "cancelled"]) });
const optionalQuery = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => value === "" ? undefined : value, schema.optional());
export const appointmentListSchema = z.object({
  date: optionalQuery(z.iso.date()),
  status: optionalQuery(z.enum(["pending", "confirmed", "cancelled"])),
  patientId: optionalQuery(z.uuid()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
