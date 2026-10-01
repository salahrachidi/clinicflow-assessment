import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { ApiError } from "../lib/api-error.js";
import type { UserRole } from "../types.js";

type Claims = jwt.JwtPayload & { sub: string; role: UserRole; email: string };

export const auth: RequestHandler = (request, _response, next) => {
  const bearer = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice(7)
    : undefined;
  const token = request.cookies?.clinicflow_token ?? bearer;
  if (!token) return next(new ApiError(401, "AUTH_REQUIRED", "Authentification requise."));

  try {
    const claims = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] }) as Claims;
    if (!claims.sub || !claims.role || !claims.email) throw new Error("Missing claims");
    request.auth = { userId: claims.sub, role: claims.role, email: claims.email };
    next();
  } catch {
    next(new ApiError(401, "INVALID_TOKEN", "Session invalide ou expirée."));
  }
};
