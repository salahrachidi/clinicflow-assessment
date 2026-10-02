import { pool } from "../../db/pool.js";

export async function listActivity(filters: { entityType?: "patient" | "appointment"; action?: string; page: number; limit: number }) {
  const offset = (filters.page - 1) * filters.limit;
  const values = [filters.entityType ?? null, filters.action ?? null, filters.limit, offset];
  const where = `WHERE ($1::text IS NULL OR log.entity_type = $1)
    AND ($2::text IS NULL OR log.action = $2)`;
  const [items, count, summary] = await Promise.all([
    pool.query(`SELECT log.id, log.actor_id AS "actorId", actor.email AS "actorEmail",
        log.action, log.entity_type AS "entityType", log.entity_id AS "entityId",
        log.changes, log.created_at AS "createdAt",
        CASE WHEN log.entity_type = 'patient' THEN patient.full_name ELSE appointment_patient.full_name END AS "entityLabel",
        appointment.appointment_date AS "appointmentDate"
      FROM audit_logs log
      JOIN users actor ON actor.id = log.actor_id
      LEFT JOIN patients patient ON log.entity_type = 'patient' AND patient.id = log.entity_id
      LEFT JOIN appointments appointment ON log.entity_type = 'appointment' AND appointment.id = log.entity_id
      LEFT JOIN patients appointment_patient ON appointment_patient.id = appointment.patient_id
      ${where}
      ORDER BY log.created_at DESC, log.id DESC LIMIT $3 OFFSET $4`, values),
    pool.query(`SELECT count(*)::int AS total FROM audit_logs log ${where}`, values.slice(0, 2)),
    pool.query(`SELECT
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS "last24Hours",
        count(*) FILTER (WHERE entity_type = 'patient')::int AS "patientEvents",
        count(*) FILTER (WHERE entity_type = 'appointment')::int AS "appointmentEvents",
        count(DISTINCT actor_id) FILTER (WHERE created_at >= now() - interval '30 days')::int AS "activeUsers"
      FROM audit_logs`)
  ]);
  const total = count.rows[0].total as number;
  return {
    data: items.rows,
    summary: summary.rows[0],
    pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) }
  };
}
