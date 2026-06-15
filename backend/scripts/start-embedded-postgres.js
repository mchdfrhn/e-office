import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = path.resolve(".postgres-data");
const logDir = path.resolve(".postgres-log");

mkdirSync(logDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
  authMethod: "password",
  onLog: (message) => process.stdout.write(String(message)),
  onError: (message) => process.stderr.write(`${String(message)}\n`)
});

async function ensureDatabase(name) {
  const client = pg.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  try {
    const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${client.escapeIdentifier(name)}`);
      console.log(`Created database ${name}`);
    } else {
      console.log(`Database ${name} already exists`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    console.log(`Initialising PostgreSQL cluster at ${databaseDir}`);
    await pg.initialise();
  }

  console.log("Starting PostgreSQL on 127.0.0.1:5432");
  await pg.start();
  await ensureDatabase("eoffice_db");
  console.log("PostgreSQL is active. Press Ctrl+C to stop it.");

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
