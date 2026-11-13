ALTER TABLE "AwsAccountConnection"
  ADD COLUMN "provisionRoleStatus" TEXT NOT NULL DEFAULT 'NOT_VALIDATED',
  ADD COLUMN "provisionRoleLastValidatedAt" TIMESTAMP(3),
  ADD COLUMN "provisionRoleLastError" TEXT;

ALTER TABLE "Request" ADD COLUMN "approverUserId" TEXT;

ALTER TABLE "PermissionGrant"
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "grantedPolicyArn" TEXT,
  ADD COLUMN "revocationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "scheduledRevocationId" TEXT;

CREATE TABLE "DevelopmentRoleGrant" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "awsAccountId" TEXT NOT NULL,
  "role" "ApplicationRole" NOT NULL,
  "grantedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "DevelopmentRoleGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DevelopmentRoleGrant_tenantId_userId_awsAccountId_role_key" ON "DevelopmentRoleGrant"("tenantId", "userId", "awsAccountId", "role");
CREATE INDEX "DevelopmentRoleGrant_tenantId_awsAccountId_userId_idx" ON "DevelopmentRoleGrant"("tenantId", "awsAccountId", "userId");
ALTER TABLE "DevelopmentRoleGrant" ADD CONSTRAINT "DevelopmentRoleGrant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevelopmentRoleGrant" ADD CONSTRAINT "DevelopmentRoleGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevelopmentRoleGrant" ADD CONSTRAINT "DevelopmentRoleGrant_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevelopmentRoleGrant" ADD CONSTRAINT "DevelopmentRoleGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
