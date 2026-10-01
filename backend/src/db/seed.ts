import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

const users = [
  ["10000000-0000-4000-8000-000000000001", "admin@clinicflow.local", "admin"],
  ["10000000-0000-4000-8000-000000000002", "staff1@clinicflow.local", "staff"],
  ["10000000-0000-4000-8000-000000000003", "staff2@clinicflow.local", "staff"]
] as const;

const patients = [
  ["20000000-0000-4000-8000-000000000001", "Patient Démo 01", "DEMO-CIN-001", "+212 600 000 001", "1992-04-18", "Adresse de démonstration 1, Casablanca"],
  ["20000000-0000-4000-8000-000000000002", "Patient Démo 02", "DEMO-CIN-002", "+212 600 000 002", "1985-11-02", "Adresse de démonstration 2, Casablanca"],
  ["20000000-0000-4000-8000-000000000003", "Patient Démo 03", "DEMO-CIN-003", "+212 600 000 003", "1978-07-27", "Adresse de démonstration 3, Casablanca"],
  ["20000000-0000-4000-8000-000000000004", "Patient Démo 04", "DEMO-CIN-004", "+212 600 000 004", "2001-01-12", "Adresse de démonstration 4, Casablanca"],
  ["20000000-0000-4000-8000-000000000005", "Patient Démo 05", "DEMO-CIN-005", "+212 600 000 005", "1996-09-09", "Adresse de démonstration 5, Casablanca"]
] as const;

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const passwordHash = await bcrypt.hash("ClinicFlow2026!", 12);
  for (const [id, email, role] of users) {
    await client.query(`INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [id, email, passwordHash, role]);
  }
  for (const patient of patients) {
    await client.query(`INSERT INTO patients (id, full_name, cin, phone, birth_date, address)
      VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name, cin = EXCLUDED.cin, phone = EXCLUDED.phone,
      birth_date = EXCLUDED.birth_date, address = EXCLUDED.address, deleted_at = NULL`, [...patient]);
  }
  await client.query("DELETE FROM appointments WHERE id::text LIKE '30000000-%'");
  const statuses = ["confirmed", "pending", "cancelled", "confirmed", "pending", "cancelled", "confirmed", "pending", "cancelled", "pending"];
  for (let index = 0; index < 10; index += 1) {
    const number = String(index + 1).padStart(12, "0");
    const patientId = patients[index % patients.length]![0];
    await client.query(`INSERT INTO appointments
      (id, patient_id, appointment_date, status, reason, notes, created_by)
      VALUES ($1, $2, (CURRENT_DATE + $3::int + make_interval(hours => $4)) AT TIME ZONE 'Africa/Casablanca', $5, $6, $7, $8)`,
      [`30000000-0000-4000-8000-${number}`, patientId, Math.floor(index / 4), 9 + (index % 4), statuses[index],
        ["Consultation générale", "Contrôle", "Suivi traitement"][index % 3], index % 2 ? null : "Données de démonstration", users[index % users.length]![0]]);
  }
  await client.query("COMMIT");
  console.info("Seed complete. Demo password: ClinicFlow2026!");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
