import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { auth } from "./middleware/auth.js";
import { csrf } from "./middleware/csrf.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { activityRouter } from "./modules/activity/activity.routes.js";
import { appointmentRouter } from "./modules/appointments/appointment.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { patientRouter } from "./modules/patients/patient.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(pinoHttp({ genReqId: (request, response) => {
  const id = request.headers["x-request-id"]?.toString() ?? randomUUID();
  response.setHeader("x-request-id", id);
  return id;
},
redact: {
  paths: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
  censor: "[REDACTED]"
},
serializers: { req: (request) => ({ id: request.id, method: request.method, url: request.url }) } }));

app.get("/health/live", (_request, response) => response.json({ status: "ok" }));
app.get("/health/ready", async (_request, response) => {
  try { await pool.query("SELECT 1"); response.json({ status: "ready" }); }
  catch { response.status(503).json({ status: "unavailable" }); }
});

app.use("/api/auth", authRouter);
app.use("/api", csrf);
app.use("/api/patients", auth, patientRouter);
app.use("/api/appointments", auth, appointmentRouter);
app.use("/api/dashboard", auth, dashboardRouter);
app.use("/api/activity", auth, activityRouter);
app.use(notFound);
app.use(errorHandler);
