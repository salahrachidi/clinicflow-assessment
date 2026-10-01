import type { UserRole } from "../types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole; email: string };
      validatedQuery?: unknown;
    }
  }
}

export {};
