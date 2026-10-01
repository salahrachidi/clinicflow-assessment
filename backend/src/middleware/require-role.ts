import type { RequestHandler } from "express";
import { ApiError } from "../lib/api-error.js";
import type { UserRole } from "../types.js";

export const requireRole = (...roles: UserRole[]): RequestHandler => (request, _response, next) => {
  if (!request.auth) return next(new ApiError(401, "AUTH_REQUIRED", "Authentification requise."));
  if (!roles.includes(request.auth.role)) return next(new ApiError(403, "FORBIDDEN", "Vous n'avez pas l'autorisation requise."));
  next();
};
