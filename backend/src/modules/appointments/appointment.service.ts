import { pool } from "../../db/pool.js";
import { ApiError } from "../../lib/api-error.js";
import type { AppointmentStatus } from "../../types.js";

const columns = `a.id, a.patient_id AS "patientId", p.full_name AS "patientName",
  a.appointment_date AS "appointmentDate", a.status, a.reason, a.notes,
  a.created_by AS "createdBy", u.email AS "createdByEmail",
  a.created_at AS "createdAt", a.updated_at AS "updatedAt"`;

type AppointmentInput = {
  patientId: string;
  appointmentDate: string;
  status: AppointmentStatus;
  reason: string;
  notes?: string | null;
};

export async function createAppointment(input: AppointmentInput, actorId: string) {
  const patient = await pool.query("SELECT 1 FROM patients WHERE id = $1 AND deleted_at IS NULL", [input.patientId]);
  if (!patient.rowCount) throw new ApiError(404, "PATIENT_NOT_FOUND", "Patient introuvable ou archivé.");

  const result = await pool.query(`WITH inserted AS (
      INSERT INTO appointments (patient_id, appointment_date, status, reason, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    ) SELECT ${columns} FROM inserted a
      JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = a.created_by`,
    [input.patientId, input.appointmentDate, input.status, input.reason, input.notes ?? null, actorId]);
  return result.rows[0];
}

export async function listAppointments(filters: { date?: string; status?: AppointmentStatus; patientId?: string; page: number; limit: number }) {
  const offset = (filters.page - 1) * filters.limit;
  const values = [filters.date ?? null, filters.status ?? null, filters.patientId ?? null, filters.limit, offset];
  const where = `WHERE ($1::date IS NULL OR (a.appointment_date >= $1::date AT TIME ZONE 'Africa/Casablanca'
      AND a.appointment_date < ($1::date + 1) AT TIME ZONE 'Africa/Casablanca'))
    AND ($2::text IS NULL OR a.status = $2) AND ($3::uuid IS NULL OR a.patient_id = $3)`;
  const [items, count] = await Promise.all([
    pool.query(`SELECT ${columns} FROM appointments a JOIN patients p ON p.id = a.patient_id
      JOIN users u ON u.id = a.created_by ${where}
      ORDER BY a.appointment_date DESC, a.created_at DESC, a.id DESC LIMIT $4 OFFSET $5`, values),
    pool.query(`SELECT count(*)::int AS total FROM appointments a ${where}`, values.slice(0, 3))
  ]);
  const total = count.rows[0].total as number;
  return { data: items.rows, pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) } };
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT status FROM appointments WHERE id = $1 FOR UPDATE", [id]);
    if (!existing.rowCount) throw new ApiError(404, "APPOINTMENT_NOT_FOUND", "Rendez-vous introuvable.");
    const previousStatus = existing.rows[0].status as AppointmentStatus;
    if (previousStatus === status) {
      await client.query("COMMIT");
      return getAppointment(id);
    }
    await client.query("UPDATE appointments SET status = $2, updated_at = now() WHERE id = $1", [id, status]);
    await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
      VALUES ($1, 'appointment.status_changed', 'appointment', $2, $3::jsonb)`,
      [actorId, id, JSON.stringify({ from: previousStatus, to: status })]);
    await client.query("COMMIT");
    return getAppointment(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function getAppointment(id: string) {
  const result = await pool.query(`SELECT ${columns} FROM appointments a JOIN patients p ON p.id = a.patient_id
    JOIN users u ON u.id = a.created_by WHERE a.id = $1`, [id]);
  if (!result.rowCount) throw new ApiError(404, "APPOINTMENT_NOT_FOUND", "Rendez-vous introuvable.");
  return result.rows[0];
}
