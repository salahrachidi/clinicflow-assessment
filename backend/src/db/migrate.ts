import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const directory = join(dirname(fileURLToPath(import.meta.url)), "migrations");

await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`);

for (const filename of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
  const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
  if (applied.rowCount) continue;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(await readFile(join(directory, filename), "utf8"));
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
    console.info(`Applied ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

await pool.end();
