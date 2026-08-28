import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSLMODE } = process.env;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  throw new Error("Database environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) are required");
}

const client = postgres({
  host: DB_HOST,
  port: Number(DB_PORT) || 5432,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  ssl: DB_SSLMODE === "require",
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export { client };
