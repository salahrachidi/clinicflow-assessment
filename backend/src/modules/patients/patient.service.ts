import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import { ApiError } from "../../lib/api-error.js";

const columns = `id, full_name AS "fullName", cin, phone, birth_date AS "birthDate",
  address, created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listPatients(search: string, page: number, limit: number) {
  const pattern = `${search.toLowerCase()}%`;
  const offset = (page - 1) * limit;
  const [items, count] = await Promise.all([
    pool.query(`SELECT ${columns} FROM patients
      WHERE deleted_at IS NULL AND ($1 = '%' OR lower(full_name) LIKE $1 OR cin LIKE upper($1))
      ORDER BY full_name, id LIMIT $2 OFFSET $3`, [pattern, limit, offset]),
    pool.query(`SELECT count(*)::int AS total FROM patients
      WHERE deleted_at IS NULL AND ($1 = '%' OR lower(full_name) LIKE $1 OR cin LIKE upper($1))`, [pattern])
  ]);
  return { data: items.rows, pagination: { page, limit, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total / limit) } };
}

export async function getPatient(id: string) {
  const result = await pool.query(`SELECT ${columns} FROM patients WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!result.rowCount) throw new ApiError(404, "PATIENT_NOT_FOUND", "Patient introuvable.");
  return result.rows[0];
}

export async function createPatient(input: Record<string, unknown>, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`INSERT INTO patients (full_name, cin, phone, birth_date, address)
      VALUES ($1, $2, $3, $4, $5) RETURNING ${columns}`,
      [input.fullName, input.cin, input.phone, input.birthDate, input.address ?? null]);
    await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
      VALUES ($1, 'patient.created', 'patient', $2)`, [actorId, result.rows[0].id]);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function updatePatient(id: string, input: Record<string, unknown>, actorId: string) {
  const current = await getPatient(id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`UPDATE patients SET full_name = $2, cin = $3, phone = $4,
      birth_date = $5, address = $6, updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING ${columns}`,
      [id, input.fullName ?? current.fullName, input.cin ?? current.cin, input.phone ?? current.phone,
        input.birthDate ?? current.birthDate, input.address === undefined ? current.address : input.address]);
    if (!result.rowCount) throw new ApiError(404, "PATIENT_NOT_FOUND", "Patient introuvable.");
    await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
      VALUES ($1, 'patient.updated', 'patient', $2, $3::jsonb)`,
      [actorId, id, JSON.stringify({ fields: Object.keys(input) })]);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function archivePatient(id: string, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertArchivable(client, id);
    const result = await client.query("UPDATE patients SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id", [id]);
    if (!result.rowCount) throw new ApiError(404, "PATIENT_NOT_FOUND", "Patient introuvable.");
    await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
      VALUES ($1, 'patient.archived', 'patient', $2)`, [actorId, id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function assertArchivable(client: PoolClient, id: string) {
  const future = await client.query(`SELECT 1 FROM appointments
    WHERE patient_id = $1 AND appointment_date >= now() AND status IN ('pending', 'confirmed') LIMIT 1`, [id]);
  if (future.rowCount) throw new ApiError(409, "PATIENT_HAS_FUTURE_APPOINTMENTS", "Annulez d'abord les rendez-vous futurs de ce patient.");
}
