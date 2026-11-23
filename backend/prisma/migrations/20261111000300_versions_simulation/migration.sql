CREATE TABLE "content_version" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "number" SERIAL NOT NULL UNIQUE,
  "snapshot" JSONB NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "note" VARCHAR(500) NOT NULL,
  "actorId" TEXT NOT NULL,
  "restoredFrom" TEXT REFERENCES "content_version"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION protect_content_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Content versions are immutable';
END;
$$;
CREATE TRIGGER content_version_immutable BEFORE UPDATE OR DELETE ON "content_version"
FOR EACH ROW EXECUTE FUNCTION protect_content_version();
CREATE TABLE "content_release" (
  "id" TEXT NOT NULL PRIMARY KEY CHECK ("id" = 'clinic'),
  "versionId" TEXT NOT NULL REFERENCES "content_version"("id"),
  "revision" INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE "simulation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('demo', 'openai')),
  "versionId" TEXT REFERENCES "content_version"("id"),
  "snapshot" JSONB NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "messages" JSONB NOT NULL DEFAULT '[]',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "processingToken" TEXT,
  "processingUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "simulation_userId_updatedAt_idx" ON "simulation"("userId", "updatedAt");
CREATE TABLE "ai_request_window" (
  "userId" TEXT NOT NULL PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "count" INTEGER NOT NULL DEFAULT 1
);
