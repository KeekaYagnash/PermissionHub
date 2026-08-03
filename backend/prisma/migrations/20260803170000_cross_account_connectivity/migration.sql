-- Cross-account connection metadata. Temporary STS credentials and external ID values are never persisted.
CREATE TABLE "AwsAccountConnection" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "awsAccountId" TEXT NOT NULL,
  "connectionType" TEXT NOT NULL,
  "readRoleArn" TEXT NOT NULL,
  "provisionRoleArn" TEXT,
  "externalIdSecretReference" TEXT,
  "organisationDiscoveryRoleArn" TEXT,
  "defaultRegion" TEXT NOT NULL,
  "organisationsRegion" TEXT NOT NULL DEFAULT 'us-east-1',
  "connectionStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "provisioningStatus" TEXT NOT NULL DEFAULT 'DISABLED',
  "provisioningEnabled" BOOLEAN NOT NULL DEFAULT false,
  "lastValidatedAt" TIMESTAMP(3),
  "lastSuccessfulReadAt" TIMESTAMP(3),
  "lastSuccessfulProvisionAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AwsAccountConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AwsAccountConnection_awsAccountId_key" ON "AwsAccountConnection"("awsAccountId");
CREATE UNIQUE INDEX "AwsAccountConnection_tenantId_awsAccountId_key" ON "AwsAccountConnection"("tenantId", "awsAccountId");
CREATE INDEX "AwsAccountConnection_tenantId_connectionStatus_idx" ON "AwsAccountConnection"("tenantId", "connectionStatus");
ALTER TABLE "AwsAccountConnection" ADD CONSTRAINT "AwsAccountConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AwsAccountConnection" ADD CONSTRAINT "AwsAccountConnection_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
