import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { validate } from "../../lib/validation.js";
import { appointmentAlternativesSchema, appointmentIdSchema, appointmentListSchema, createAppointmentSchema, rescheduleAppointmentSchema, updateStatusSchema } from "./appointment.schemas.js";
import { createAppointment, getAppointmentAlternatives, listAppointments, rescheduleAppointment, updateAppointmentStatus } from "./appointment.service.js";

const router = Router();

router.post("/", validate("body", createAppointmentSchema), asyncHandler(async (request, response) => {
  response.status(201).json({ data: await createAppointment(request.body, request.auth!.userId) });
}));
router.get("/", validate("query", appointmentListSchema), asyncHandler(async (request, response) => {
  response.json(await listAppointments(request.validatedQuery as never));
}));
router.get("/:id/alternatives", validate("params", appointmentIdSchema), validate("query", appointmentAlternativesSchema), asyncHandler(async (request, response) => {
  const query = request.validatedQuery as { count: number };
  response.json({ data: await getAppointmentAlternatives(String(request.params.id), query.count) });
}));
router.patch("/:id/status", validate("params", appointmentIdSchema), validate("body", updateStatusSchema), asyncHandler(async (request, response) => {
  response.json({ data: await updateAppointmentStatus(String(request.params.id), request.body.status, request.auth!.userId) });
}));
router.patch("/:id/reschedule", validate("params", appointmentIdSchema), validate("body", rescheduleAppointmentSchema), asyncHandler(async (request, response) => {
  response.json({ data: await rescheduleAppointment(String(request.params.id), request.body.appointmentDate, request.auth!.userId) });
}));

export { router as appointmentRouter };
