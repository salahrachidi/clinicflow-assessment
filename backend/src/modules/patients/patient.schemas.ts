import { z } from "zod";

const fields = {
  fullName: z.string().trim().min(2).max(120),
  cin: z.string().trim().min(3).max(30).transform((value) => value.toUpperCase()),
  phone: z.string().trim().min(6).max(30),
  birthDate: z.iso.date().refine((value) => new Date(`${value}T00:00:00Z`) <= new Date(), "La date de naissance ne peut pas être future."),
  address: z.string().trim().max(300).nullable().optional()
};

export const createPatientSchema = z.object(fields);
export const updatePatientSchema = createPatientSchema.partial().refine((value) => Object.keys(value).length > 0, "Au moins un champ est requis.");
export const patientIdSchema = z.object({ id: z.uuid() });
export const patientListSchema = z.object({
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
