import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseURL = process.env.APP_URL ?? "http://localhost:8088";
const outputDirectory = resolve("docs/screenshots");
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill("admin@clinicflow.local");
  await page.getByLabel("Mot de passe").fill("ClinicFlow2026!");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByRole("heading", { name: "Bonjour, voici votre journée." }).waitFor();
  await page.screenshot({ path: resolve(outputDirectory, "dashboard.png"), fullPage: true });

  await page.getByRole("link", { name: "Patients", exact: true }).click();
  await page.getByPlaceholder("Rechercher par nom ou CIN…").fill("DEMO-CIN-001");
  await page.getByRole("row").filter({ hasText: "Patient Démo 01" }).getByRole("link", { name: "Consulter" }).click();
  await page.getByRole("heading", { name: "Patient Démo 01" }).waitFor();
  await page.getByRole("button", { name: /Archiver|Gérer .* archiver/ }).click();
  await page.getByRole("dialog", { name: /Archiver Patient Démo 01/ }).waitFor();
  await page.screenshot({ path: resolve(outputDirectory, "archive-workflow.png"), fullPage: true });

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/appointments`);
  await page.getByRole("heading", { name: "Rendez-vous", level: 1 }).waitFor();
  await page.locator(".appointment-filters select").selectOption("confirmed");
  await page.getByText("3 rendez-vous", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(outputDirectory, "appointments-mobile.png"), fullPage: true });
} finally {
  await browser.close();
}

console.info(`Screenshots saved in ${outputDirectory}`);
