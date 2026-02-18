-- One-time script: add State model and backfill Location.stateId
-- Run with: psql $DATABASE_URL -f prisma/backfill-states.sql
-- Or run the statements in your DB client.

-- 1. Create states table (matches Prisma schema)
CREATE TABLE IF NOT EXISTS "states" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "states_name_key" ON "states"("name");

-- 2. Insert default state for existing locations (use a stable CUID-like id)
INSERT INTO "states" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (
  'clr0defaultstate000000000',
  'Default',
  'Default state for existing locations',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

-- 3. Add stateId to locations if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'stateId'
  ) THEN
    ALTER TABLE "locations" ADD COLUMN "stateId" TEXT;
    UPDATE "locations" SET "stateId" = (SELECT "id" FROM "states" WHERE "name" = 'Default' LIMIT 1);
    ALTER TABLE "locations" ALTER COLUMN "stateId" SET NOT NULL;
    ALTER TABLE "locations" ADD CONSTRAINT "locations_stateId_fkey"
      FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    CREATE UNIQUE INDEX "locations_stateId_name_key" ON "locations"("stateId", "name");
    CREATE INDEX "locations_stateId_idx" ON "locations"("stateId");
  END IF;
END $$;
