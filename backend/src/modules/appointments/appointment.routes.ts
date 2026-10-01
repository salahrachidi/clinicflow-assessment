import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { validate } from "../../lib/validation.js";
import { appointmentIdSchema, appointmentListSchema, createAppointmentSchema, updateStatusSchema } from "./appointment.schemas.js";
import { createAppointment, listAppointments, updateAppointmentStatus } from "./appointment.service.js";

const router = Router();

router.post("/", validate("body", createAppointmentSchema), asyncHandler(async (request, response) => {
  response.status(201).json({ data: await createAppointment(request.body, request.auth!.userId) });
}));
router.get("/", validate("query", appointmentListSchema), asyncHandler(async (request, response) => {
  response.json(await listAppointments(request.validatedQuery as never));
}));
router.patch("/:id/status", validate("params", appointmentIdSchema), validate("body", updateStatusSchema), asyncHandler(async (request, response) => {
  response.json({ data: await updateAppointmentStatus(String(request.params.id), request.body.status, request.auth!.userId) });
}));

export { router as appointmentRouter };
