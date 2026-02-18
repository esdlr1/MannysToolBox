-- One-time: add stateId to branches (Branch now belongs to State).
-- Run: npx prisma db execute --file prisma/backfill-branches-state.sql

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branches') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'stateId') THEN
      ALTER TABLE "branches" ADD COLUMN "stateId" TEXT;
      UPDATE "branches" SET "stateId" = (SELECT "id" FROM "states" ORDER BY "name" ASC LIMIT 1);
      ALTER TABLE "branches" ALTER COLUMN "stateId" SET NOT NULL;
      ALTER TABLE "branches" ADD CONSTRAINT "branches_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      CREATE UNIQUE INDEX "branches_stateId_name_key" ON "branches"("stateId", "name");
      CREATE INDEX "branches_stateId_idx" ON "branches"("stateId");
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'locationId') THEN
      ALTER TABLE "branches" DROP CONSTRAINT IF EXISTS "branches_locationId_fkey";
      ALTER TABLE "branches" DROP COLUMN "locationId";
    END IF;
  END IF;
END $$;
