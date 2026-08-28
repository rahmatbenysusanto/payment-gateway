import type { Config } from "drizzle-kit";

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: DB_HOST!,
    port: Number(DB_PORT) || 5432,
    user: DB_USER!,
    password: DB_PASSWORD!,
    database: DB_NAME!,
    ssl: false,
  },
  verbose: true,
  strict: true,
} satisfies Config;
