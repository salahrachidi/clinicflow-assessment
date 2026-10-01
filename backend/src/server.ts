import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";

const server = app.listen(config.PORT, () => console.info(`ClinicFlow API listening on port ${config.PORT}`));

async function shutdown(signal: string) {
  console.info(`${signal} received, shutting down`);
  server.close(async () => { await pool.end(); process.exit(0); });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
