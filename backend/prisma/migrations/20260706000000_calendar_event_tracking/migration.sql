ALTER TABLE "AbsenceRecord"
  ADD COLUMN IF NOT EXISTS "externalCalendarEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalCalendarProvider" TEXT;
