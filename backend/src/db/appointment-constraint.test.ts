import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const testPool = new pg.Pool({ connectionString: databaseUrl });
const patientId = "20000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000001";
const createdIds: string[] = [];

suite("confirmed appointment exclusion constraint", () => {
  it("rejects 29 minutes and accepts the exact 30-minute boundary", async () => {
    const client = await testPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO appointments
        (patient_id, appointment_date, status, reason, created_by)
        VALUES ($1, '2099-01-01T10:00:00Z', 'confirmed', 'Constraint test', $2)`, [patientId, userId]);
      await client.query("SAVEPOINT before_conflict");
      await expect(client.query(`INSERT INTO appointments
        (patient_id, appointment_date, status, reason, created_by)
        VALUES ($1, '2099-01-01T10:29:00Z', 'confirmed', 'Constraint test', $2)`, [patientId, userId]))
        .rejects.toMatchObject({ code: "23P01" });
      await client.query("ROLLBACK TO SAVEPOINT before_conflict");
      await expect(client.query(`INSERT INTO appointments
        (patient_id, appointment_date, status, reason, created_by)
        VALUES ($1, '2099-01-01T10:30:00Z', 'confirmed', 'Constraint test', $2)`, [patientId, userId]))
        .resolves.toBeDefined();
      await client.query("ROLLBACK");
    } finally { client.release(); }
  });

  it("allows only one of two simultaneous conflicting confirmations", async () => {
    const firstId = randomUUID();
    const secondId = randomUUID();
    createdIds.push(firstId, secondId);
    await testPool.query(`INSERT INTO appointments
      (id, patient_id, appointment_date, status, reason, created_by)
      VALUES ($1, $3, '2099-02-01T10:00:00Z', 'pending', 'Concurrency test', $4),
             ($2, $3, '2099-02-01T10:10:00Z', 'pending', 'Concurrency test', $4)`,
      [firstId, secondId, patientId, userId]);

    const results = await Promise.allSettled([
      testPool.query("UPDATE appointments SET status = 'confirmed' WHERE id = $1", [firstId]),
      testPool.query("UPDATE appointments SET status = 'confirmed' WHERE id = $1", [secondId])
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});

afterAll(async () => {
  if (createdIds.length) await testPool.query("DELETE FROM appointments WHERE id = ANY($1::uuid[])", [createdIds]);
  await testPool.end();
});
