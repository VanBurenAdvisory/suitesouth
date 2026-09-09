// Applies every migration in db/migrations in order, then seeds and verifies.
// Run with:  npm run db:init
import { readFileSync, readdirSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Put it in .env.local first.");
  process.exit(1);
}

const dir = new URL("../db/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const pool = new Pool({ connectionString });

try {
  for (const file of files) {
    process.stdout.write(`Applying ${file} ... `);
    await pool.query(readFileSync(new URL(file, dir), "utf8"));
    console.log("done");
  }
  const { rows } = await pool.query(
    "select name, owner_share_pct, commission_pct, fee_treatment, turnaround_days from properties order by sort_order",
  );
  console.log("Migrations applied. Properties:");
  for (const row of rows) {
    console.log(
      `  ${row.name}: owner share ${row.owner_share_pct}%, commission ${row.commission_pct}%, fees: ${row.fee_treatment}, turnaround: ${row.turnaround_days}d`,
    );
  }
} catch (error) {
  console.error("Failed to apply schema:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
