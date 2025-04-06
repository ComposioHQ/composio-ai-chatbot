import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({
  path: ".env.local",
});

const resetDatabase = async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });

  try {
    // Drop all tables (this will cascade and remove all data)
    console.log("\u231B Dropping all tables...");

    // Method 1: Using DROP SCHEMA (safer approach that doesn't need role permissions)
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`CREATE SCHEMA IF NOT EXISTS public`;

    // We don't specify roles here to avoid permission errors
    // Let the database use default permissions

    console.log("\u2705 All tables dropped successfully");

    // Run migrations to recreate the schema
    const db = drizzle(sql);
    console.log("\u231B Running migrations to recreate schema...");

    const start = Date.now();
    await migrate(db, { migrationsFolder: "./lib/db/migrations" });
    const end = Date.now();

    console.log("\u2705 Database reset completed in", end - start, "ms");
  } catch (err) {
    console.error("\u274C Database reset failed");
    console.error(err);
  } finally {
    await sql.end();
    process.exit(0);
  }
};

resetDatabase().catch((err) => {
  console.error("\u274C Database reset failed");
  console.error(err);
  process.exit(1);
});
