import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { config } from "../../config.js";
import { pool } from "../../db/pool.js";
import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { validate } from "../../lib/validation.js";
import { auth } from "../../middleware/auth.js";
import { csrf } from "../../middleware/csrf.js";

const router = Router();
const loginSchema = z.object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string().min(8).max(128) });

router.post("/login", validate("body", loginSchema), asyncHandler(async (request, response) => {
  const { email, password } = request.body as z.infer<typeof loginSchema>;
  const result = await pool.query("SELECT id, email, password_hash, role FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email ou mot de passe incorrect.");
  }

  const token = jwt.sign(
    { role: user.role, email: user.email },
    config.JWT_SECRET,
    { algorithm: "HS256", subject: user.id, expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"] }
  );
  const csrfToken = randomBytes(24).toString("base64url");
  const secure = config.NODE_ENV === "production";
  response
    .cookie("clinicflow_token", token, { httpOnly: true, secure, sameSite: "strict", maxAge: 2 * 60 * 60 * 1000, path: "/" })
    .cookie("clinicflow_csrf", csrfToken, { httpOnly: false, secure, sameSite: "strict", maxAge: 2 * 60 * 60 * 1000, path: "/" })
    .json({ user: { id: user.id, email: user.email, role: user.role }, csrfToken });
}));

router.post("/logout", csrf, (request, response) => {
  response.clearCookie("clinicflow_token", { path: "/" }).clearCookie("clinicflow_csrf", { path: "/" }).status(204).send();
});

router.get("/me", auth, (request, response) => response.json({ user: request.auth }));

export { router as authRouter };
