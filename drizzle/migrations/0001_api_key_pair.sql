-- Add api_key and secret_key columns (nullable first for existing data)
ALTER TABLE "api_keys" ADD COLUMN "api_key" varchar(64);--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "secret_key" varchar(128);--> statement-breakpoint

-- Copy old key to both new columns for existing rows
UPDATE "api_keys" SET "api_key" = "key", "secret_key" = "key" WHERE "api_key" IS NULL;--> statement-breakpoint

-- Make NOT NULL
ALTER TABLE "api_keys" ALTER COLUMN "api_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "secret_key" SET NOT NULL;--> statement-breakpoint

-- Add unique constraints
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_api_key_unique" UNIQUE("api_key");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_secret_key_unique" UNIQUE("secret_key");--> statement-breakpoint

-- Drop old key column
ALTER TABLE "api_keys" DROP COLUMN "key";
