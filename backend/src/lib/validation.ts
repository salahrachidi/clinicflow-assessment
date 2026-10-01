import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ApiError } from "./api-error.js";

export const validate = (
  target: "body" | "query" | "params",
  schema: ZodType
): RequestHandler => (request, _response, next) => {
  const result = schema.safeParse(request[target]);
  if (!result.success) {
    return next(new ApiError(400, "VALIDATION_ERROR", "Les données fournies sont invalides.", result.error.flatten()));
  }
  if (target === "query") request.validatedQuery = result.data;
  else Object.assign(request[target], result.data);
  next();
};
