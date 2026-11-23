CREATE TABLE "calendar_connection" (
  "id" TEXT NOT NULL PRIMARY KEY CHECK ("id" = 'clinic'),
  "generation" TEXT NOT NULL UNIQUE,
  "email" TEXT NOT NULL,
  "refreshTokenCipher" TEXT NOT NULL,
  "calendarId" TEXT,
  "calendarName" TEXT,
  "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "needsReconnect" BOOLEAN NOT NULL DEFAULT false,
  "connectedBy" TEXT NOT NULL,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "calendar_oauth_state" (
  "stateHash" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "verifierCipher" TEXT NOT NULL,
  "expectedRevision" INTEGER NOT NULL,
  "expectedGeneration" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
