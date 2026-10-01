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
const testCin = `TEST${Date.now()}`;

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
  if (patientId) {
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'patient' AND entity_id = $1", [patientId]);
    await pool.query("DELETE FROM patients WHERE id = $1", [patientId]);
  }
  await pool.end();
});
