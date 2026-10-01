import type { RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "../lib/api-error.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const csrf: RequestHandler = (request, _response, next) => {
  if (safeMethods.has(request.method) || request.headers.authorization?.startsWith("Bearer ")) return next();
  const cookie = request.cookies?.clinicflow_csrf;
  const header = request.header("x-csrf-token");
  if (!cookie || !header) return next(new ApiError(403, "CSRF_INVALID", "Jeton CSRF invalide."));
  const cookieBuffer = Buffer.from(cookie);
  const headerBuffer = Buffer.from(header);
  if (cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
    return next(new ApiError(403, "CSRF_INVALID", "Jeton CSRF invalide."));
  }
  next();
};
