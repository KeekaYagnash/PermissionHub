ALTER TYPE "ConnectionType" ADD VALUE IF NOT EXISTS 'ACCESS_KEYS';

ALTER TABLE "AwsAccountConnection"
  ADD COLUMN IF NOT EXISTS "accessKeyIdEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "secretAccessKeyEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "sessionTokenEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "accessKeyIdMasked" TEXT,
  ADD COLUMN IF NOT EXISTS "credentialUpdatedAt" TIMESTAMP(3);
