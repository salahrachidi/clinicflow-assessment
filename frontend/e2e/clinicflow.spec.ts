import { expect, test } from "@playwright/test";
import pg from "pg";

const password = "ClinicFlow2026!";
const testCin = `E2E${Date.now()}`;
const patientName = `Patient Playwright ${Date.now()}`;
const staffTestCin = `STAFF${Date.now()}`;
const staffPatientName = `Patient Staff ${Date.now()}`;
const appointmentDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Casablanca",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const cin of [testCin, staffTestCin]) {
      const patient = await client.query("SELECT id FROM patients WHERE cin = $1", [cin]);
      const patientId = patient.rows[0]?.id as string | undefined;
      if (patientId) {
        await client.query(`DELETE FROM audit_logs WHERE entity_type = 'appointment'
          AND entity_id IN (SELECT id FROM appointments WHERE patient_id = $1)`, [patientId]);
        await client.query("DELETE FROM appointments WHERE patient_id = $1", [patientId]);
        await client.query("DELETE FROM audit_logs WHERE entity_type = 'patient' AND entity_id = $1", [patientId]);
        await client.query("DELETE FROM patients WHERE id = $1", [patientId]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});

test("admin completes booking, conflict, dashboard, and archive workflows", async ({ page }) => {
  await login(page, "admin@clinicflow.local");
  const confirmedCard = page.locator(".stat").filter({ hasText: "Confirmés" }).locator("strong");
  await expect(confirmedCard).toHaveText(/^\d+$/);
  const confirmedBefore = Number(await confirmedCard.textContent());

  await page.getByRole("link", { name: "Patients" }).click();
  await page.getByRole("button", { name: "Ajouter un patient" }).click();
  await page.getByLabel("Nom complet").fill(patientName);
  await page.getByLabel("CIN", { exact: true }).fill(testCin);
  await page.getByLabel("Téléphone").fill("+212600009999");
  await page.getByLabel("Date de naissance").fill("1994-05-14");
  await page.getByLabel("Adresse").fill("Casablanca");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await page.getByPlaceholder("Rechercher par nom ou CIN…").fill(testCin);
  const patientRow = page.getByRole("row").filter({ hasText: patientName });
  await expect(patientRow).toBeVisible();
  await patientRow.getByRole("link", { name: "Consulter" }).click();
  await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

  await page.getByRole("link", { name: "Prendre rendez-vous" }).click();
  await expect(page.getByLabel("Patient")).toHaveValue(/.+/);
  await page.getByLabel("Date et heure").fill(`${appointmentDay}T10:00`);
  await page.getByLabel("Motif").fill("Consultation E2E");
  await page.getByRole("button", { name: "Créer le rendez-vous" }).click();
  await expect(page.getByRole("status")).toContainText(patientName);

  const firstAppointment = page.getByRole("row").filter({ hasText: "Consultation E2E" });
  await firstAppointment.getByRole("button", { name: "Confirmer" }).click();
  await expect(firstAppointment.getByText("Confirmé", { exact: true })).toBeVisible();

  await page.getByLabel("Patient").selectOption({ label: `${patientName} · ${testCin}` });
  await page.getByLabel("Date et heure").fill(`${appointmentDay}T10:15`);
  await page.getByLabel("Motif").fill("Conflit E2E");
  await page.getByRole("button", { name: "Créer le rendez-vous" }).click();
  const conflictingAppointment = page.getByRole("row").filter({ hasText: "Conflit E2E" });
  await conflictingAppointment.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByRole("alert")).toContainText("fenêtre de 30 minutes");

  await page.getByRole("link", { name: "Vue du jour" }).click();
  await expect(confirmedCard).toHaveText(String(confirmedBefore + 1));

  await page.getByRole("link", { name: "Patients" }).click();
  await page.getByPlaceholder("Rechercher par nom ou CIN…").fill(testCin);
  await page.getByRole("row").filter({ hasText: patientName }).getByRole("link", { name: "Consulter" }).click();
  await page.getByRole("button", { name: /Gérer 2 rendez-vous et archiver/ }).click();
  const dialog = page.getByRole("dialog", { name: new RegExp(`Archiver ${patientName}`) });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Tout annuler" }).click();
  await expect(dialog.getByRole("button", { name: "Confirmer l’archivage" })).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmer l’archivage" }).click();
  await expect(page).toHaveURL(/\/patients$/);
  await page.getByPlaceholder("Rechercher par nom ou CIN…").fill(testCin);
  await expect(page.getByText("Aucun patient trouvé.")).toBeVisible();
});

test("staff cannot see patient archival controls", async ({ page }) => {
  await login(page, "admin@clinicflow.local");
  await page.getByRole("link", { name: "Patients" }).click();
  await page.getByRole("button", { name: "Ajouter un patient" }).click();
  await page.getByLabel("Nom complet").fill(staffPatientName);
  await page.getByLabel("CIN", { exact: true }).fill(staffTestCin);
  await page.getByLabel("Téléphone").fill("+212600008888");
  await page.getByLabel("Date de naissance").fill("1990-01-01");
  await page.getByLabel("Adresse").fill("Casablanca");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();

  await login(page, "staff1@clinicflow.local");
  await page.getByRole("link", { name: "Patients" }).click();
  await page.getByPlaceholder("Rechercher par nom ou CIN…").fill(staffTestCin);
  await page.getByRole("row").filter({ hasText: staffPatientName }).getByRole("link", { name: "Consulter" }).click();
  await expect(page.getByRole("button", { name: /Archiver|Gérer .* archiver/ })).toHaveCount(0);
});

test("mobile navigation and appointment controls remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "staff1@clinicflow.local");
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
  await page.getByRole("link", { name: "Rendez-vous", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rendez-vous", level: 1 })).toBeVisible();
  await expect(page.locator(".appointment-filters input")).toBeVisible();
  await expect(page.locator(".appointment-filters select")).toBeVisible();
  const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(pageOverflows).toBe(false);
});
