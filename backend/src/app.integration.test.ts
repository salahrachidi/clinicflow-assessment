import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { pool } from "./db/pool.js";

const password = "ClinicFlow2026!";
const admin = request.agent(app);
const staff = request.agent(app);
let adminCsrf = "";
let staffCsrf = "";
let patientId = "";
let schedulingPatientId = "";
const testCin = `TEST${Date.now()}`;
const schedulingCin = `SLOT${Date.now()}`;

async function login(agent: ReturnType<typeof request.agent>, email: string) {
  const response = await agent.post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  expect(response.body.user.email).toBe(email);
  return response.body.csrfToken as string;
}

describe.sequential("ClinicFlow API integration", () => {
  beforeAll(async () => {
    adminCsrf = await login(admin, "admin@clinicflow.local");
    staffCsrf = await login(staff, "staff1@clinicflow.local");
  });

  it("rejects unauthenticated access to protected resources", async () => {
    const response = await request(app).get("/api/patients");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("returns a generic error for invalid login credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin@clinicflow.local",
      password: "incorrect-password"
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("validates patient input", async () => {
    const response = await admin
      .post("/api/patients")
      .set("X-CSRF-Token", adminCsrf)
      .send({ fullName: "A", cin: "X", phone: "1", birthDate: "2099-01-01" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a patient and normalizes the CIN", async () => {
    const response = await admin
      .post("/api/patients")
      .set("X-CSRF-Token", adminCsrf)
      .send({
        fullName: "Patient Integration",
        cin: testCin.toLowerCase(),
        phone: "+212600000099",
        birthDate: "1990-01-01",
        address: "Casablanca"
      });
    expect(response.status).toBe(201);
    expect(response.body.data.cin).toBe(testCin);
    patientId = response.body.data.id;
  });

  it("maps a duplicate CIN to a conflict response", async () => {
    const response = await admin
      .post("/api/patients")
      .set("X-CSRF-Token", adminCsrf)
      .send({
        fullName: "Duplicate CIN",
        cin: testCin,
        phone: "+212600000098",
        birthDate: "1991-02-02"
      });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CIN_ALREADY_EXISTS");
  });

  it("explains a scheduling conflict and reschedules to a suggested slot", async () => {
    const patient = await admin
      .post("/api/patients")
      .set("X-CSRF-Token", adminCsrf)
      .send({
        fullName: "Patient Suggestions",
        cin: schedulingCin,
        phone: "+212600000097",
        birthDate: "1992-03-03"
      });
    expect(patient.status).toBe(201);
    schedulingPatientId = patient.body.data.id;

    const confirmedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    confirmedDate.setUTCHours(10, 0, 0, 0);
    const conflictingDate = new Date(confirmedDate.getTime() + 15 * 60 * 1000);
    const confirmed = await admin
      .post("/api/appointments")
      .set("X-CSRF-Token", adminCsrf)
      .send({ patientId: schedulingPatientId, appointmentDate: confirmedDate.toISOString(), status: "confirmed", reason: "Consultation initiale" });
    const pending = await admin
      .post("/api/appointments")
      .set("X-CSRF-Token", adminCsrf)
      .send({ patientId: schedulingPatientId, appointmentDate: conflictingDate.toISOString(), status: "pending", reason: "Consultation suivante" });
    expect(confirmed.status).toBe(201);
    expect(pending.status).toBe(201);

    const rejected = await admin
      .patch(`/api/appointments/${pending.body.data.id}/status`)
      .set("X-CSRF-Token", adminCsrf)
      .send({ status: "confirmed" });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe("APPOINTMENT_CONFLICT");

    const assistant = await admin.get(`/api/appointments/${pending.body.data.id}/alternatives?count=3`);
    expect(assistant.status).toBe(200);
    expect(assistant.body.data.conflict.id).toBe(confirmed.body.data.id);
    expect(assistant.body.data.alternatives).toHaveLength(3);

    const rescheduled = await admin
      .patch(`/api/appointments/${pending.body.data.id}/reschedule`)
      .set("X-CSRF-Token", adminCsrf)
      .send({ appointmentDate: assistant.body.data.alternatives[0] });
    expect(rescheduled.status).toBe(200);
    expect(rescheduled.body.data.status).toBe("confirmed");
    expect(rescheduled.body.data.appointmentDate).toBe(assistant.body.data.alternatives[0]);
  });

  it("prevents staff from archiving a patient", async () => {
    const response = await staff
      .delete(`/api/patients/${patientId}`)
      .set("X-CSRF-Token", staffCsrf);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an admin to archive a patient", async () => {
    const response = await admin
      .delete(`/api/patients/${patientId}`)
      .set("X-CSRF-Token", adminCsrf);
    expect(response.status).toBe(204);

    const lookup = await admin.get(`/api/patients/${patientId}`);
    expect(lookup.status).toBe(404);
  });

  it("returns dashboard statistics to authenticated staff", async () => {
    const response = await staff.get("/api/dashboard");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      totalPatients: expect.any(Number),
      appointmentsToday: expect.any(Number),
      pending: expect.any(Number),
      confirmed: expect.any(Number)
    }));
  });
});

afterAll(async () => {
  if (schedulingPatientId) {
    await pool.query(`DELETE FROM audit_logs WHERE entity_type = 'appointment'
      AND entity_id IN (SELECT id FROM appointments WHERE patient_id = $1)`, [schedulingPatientId]);
    await pool.query("DELETE FROM appointments WHERE patient_id = $1", [schedulingPatientId]);
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'patient' AND entity_id = $1", [schedulingPatientId]);
    await pool.query("DELETE FROM patients WHERE id = $1", [schedulingPatientId]);
  }
  if (patientId) {
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'patient' AND entity_id = $1", [patientId]);
    await pool.query("DELETE FROM patients WHERE id = $1", [patientId]);
  }
  await pool.end();
});
