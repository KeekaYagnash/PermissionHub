ALTER TYPE "ConnectionType" ADD VALUE IF NOT EXISTS 'LOCAL_DEFAULT_CREDENTIALS';
ALTER TYPE "ConnectionStatus" ADD VALUE IF NOT EXISTS 'DEGRADED';
ALTER TYPE "ConnectionStatus" ADD VALUE IF NOT EXISTS 'DISABLED';
CREATE TYPE "AwsAccountSource" AS ENUM ('MANUAL', 'ORGANISATION_DISCOVERY', 'DEMO_SEED', 'MIGRATION', 'LEGACY');

ALTER TABLE "AwsOrganisation" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceType" "AwsAccountSource" NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "AwsOrganisationalUnit" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceType" "AwsAccountSource" NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "AwsAccount" ADD COLUMN "sourceType" "AwsAccountSource" NOT NULL DEFAULT 'LEGACY',
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "discoveredAt" TIMESTAMP(3),
ADD COLUMN "manuallyCreatedAt" TIMESTAMP(3);
ALTER TABLE "AwsAccountConnection" ADD COLUMN "connectionSource" "AwsAccountSource" NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "AwsAccountConnection" ALTER COLUMN "readRoleArn" DROP NOT NULL;

-- Existing records cannot be classified safely. Known seed IDs are explicitly marked;
-- all other legacy records remain excluded from manual mode pending review.
UPDATE "AwsAccount" SET "sourceType"='DEMO_SEED', "isDemo"=true
WHERE "id" IN ('account_prod_payments_dev','account_sandbox_dev','account_security_dev');
UPDATE "AwsOrganisation" SET "sourceType"='DEMO_SEED', "isDemo"=true WHERE "id"='org_disraptor_dev';
UPDATE "AwsOrganisationalUnit" SET "sourceType"='DEMO_SEED', "isDemo"=true
WHERE "id" IN ('ou_production_dev','ou_development_dev','ou_security_dev');
UPDATE "AwsAccountConnection" SET "connectionSource"='DEMO_SEED'
WHERE "awsAccountId" IN ('account_prod_payments_dev','account_sandbox_dev','account_security_dev');
