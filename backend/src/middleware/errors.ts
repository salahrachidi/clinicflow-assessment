import type { ErrorRequestHandler, RequestHandler } from "express";
import { ApiError } from "../lib/api-error.js";

type PgError = Error & { code?: string; constraint?: string };

export const notFound: RequestHandler = (_request, _response, next) =>
  next(new ApiError(404, "ROUTE_NOT_FOUND", "Route introuvable."));

export const errorHandler: ErrorRequestHandler = (error: PgError, request, response, _next) => {
  let resolved: ApiError;
  if (error instanceof ApiError) resolved = error;
  else if (error.code === "23505" && error.constraint === "patients_cin_key") {
    resolved = new ApiError(409, "CIN_ALREADY_EXISTS", "Un patient avec ce CIN existe déjà.");
  } else if (error.code === "23P01" && error.constraint === "appointments_patient_confirmed_window_excl") {
    resolved = new ApiError(409, "APPOINTMENT_CONFLICT", "Ce patient a déjà un rendez-vous confirmé dans cette fenêtre de 30 minutes.");
  } else {
    request.log?.error({ err: error }, "Unhandled request error");
    resolved = new ApiError(500, "INTERNAL_ERROR", "Une erreur interne est survenue.");
  }

  response.status(resolved.status).json({
    error: {
      code: resolved.code,
      message: resolved.message,
      ...(resolved.details === undefined ? {} : { details: resolved.details }),
      requestId: request.id
    }
  });
};
