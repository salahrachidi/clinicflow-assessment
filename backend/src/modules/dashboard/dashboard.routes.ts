import { Router } from "express";
import { pool } from "../../db/pool.js";
import { asyncHandler } from "../../lib/async-handler.js";

const router = Router();

router.get("/", asyncHandler(async (_request, response) => {
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM patients WHERE deleted_at IS NULL) AS "totalPatients",
    count(*) FILTER (WHERE appointment_date >= date_trunc('day', now() AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'Africa/Casablanca'
      AND appointment_date < (date_trunc('day', now() AT TIME ZONE 'Africa/Casablanca') + interval '1 day') AT TIME ZONE 'Africa/Casablanca')::int AS "appointmentsToday",
    count(*) FILTER (WHERE status = 'pending')::int AS pending,
    count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed
    FROM appointments`);
  response.json({ data: result.rows[0] });
}));

export { router as dashboardRouter };
