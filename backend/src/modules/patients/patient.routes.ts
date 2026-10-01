import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { validate } from "../../lib/validation.js";
import { requireRole } from "../../middleware/require-role.js";
import { createPatientSchema, patientIdSchema, patientListSchema, updatePatientSchema } from "./patient.schemas.js";
import { archivePatient, createPatient, getPatient, listPatients, updatePatient } from "./patient.service.js";

const router = Router();

router.get("/", validate("query", patientListSchema), asyncHandler(async (request, response) => {
  const { search, page, limit } = request.validatedQuery as { search: string; page: number; limit: number };
  response.json(await listPatients(search, page, limit));
}));
router.post("/", validate("body", createPatientSchema), asyncHandler(async (request, response) => response.status(201).json({ data: await createPatient(request.body) })));
router.get("/:id", validate("params", patientIdSchema), asyncHandler(async (request, response) => response.json({ data: await getPatient(String(request.params.id)) })));
router.put("/:id", validate("params", patientIdSchema), validate("body", updatePatientSchema), asyncHandler(async (request, response) => response.json({ data: await updatePatient(String(request.params.id), request.body) })));
router.delete("/:id", validate("params", patientIdSchema), requireRole("admin"), asyncHandler(async (request, response) => {
  await archivePatient(String(request.params.id), request.auth!.userId);
  response.status(204).send();
}));

export { router as patientRouter };
