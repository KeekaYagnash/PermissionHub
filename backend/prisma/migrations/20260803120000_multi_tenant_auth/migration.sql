-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ApplicationRole" AS ENUM ('REQUESTER', 'ACCOUNT_APPROVER', 'OU_ADMIN', 'SECURITY_REVIEWER', 'PROVISIONER', 'ORGANISATION_ADMIN', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('TENANT', 'AWS_ORGANISATION', 'ORGANISATIONAL_UNIT', 'AWS_ACCOUNT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('MANAGEMENT', 'SECURITY', 'LOG_ARCHIVE', 'SHARED_SERVICES', 'NETWORK', 'PRODUCTION', 'STAGING', 'DEVELOPMENT', 'SANDBOX', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('DEFAULT_CHAIN', 'ASSUME_ROLE', 'EXTERNAL_ROLE');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TargetType" ADD VALUE 'IDENTITY_CENTER_USER';
ALTER TYPE "TargetType" ADD VALUE 'IDENTITY_CENTER_GROUP';
ALTER TYPE "TargetType" ADD VALUE 'IAM_GROUP';

-- AlterEnum
ALTER TYPE "RequestMode" ADD VALUE 'PERMISSION_SET';

-- AlterEnum
ALTER TYPE "ProvisioningMode" ADD VALUE 'MANUAL';

-- DropIndex
DROP INDEX "PermissionGrant_targetArn_policyArn_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "displayName" TEXT,
ADD COLUMN     "legacyRole" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- Preserve existing PermissionHub identities and legacy application roles before
-- removing the original single-role columns. Membership backfill is performed
-- explicitly by the deployment migration procedure because a tenant choice is required.
UPDATE "User" SET "displayName" = "name", "legacyRole" = "role"::text;
ALTER TABLE "User" ALTER COLUMN "displayName" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "name", DROP COLUMN "role";

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "accountType" "AccountType",
ADD COLUMN     "approvalPolicyId" TEXT,
ADD COLUMN     "awsAccountId" TEXT,
ADD COLUMN     "awsOrganisationId" TEXT,
ADD COLUMN     "ouId" TEXT,
ADD COLUMN     "permissionSource" TEXT,
ADD COLUMN     "provisioningAccountId" TEXT,
ADD COLUMN     "provisioningRoleArn" TEXT,
ADD COLUMN     "requesterUserId" TEXT,
ADD COLUMN     "requiredApprovalStages" JSONB,
ADD COLUMN     "completedApprovalStages" JSONB,
ADD COLUMN     "targetSubjectType" "TargetType",
ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "approverUserId" TEXT,
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'ACCOUNT_APPROVER';

-- AlterTable
ALTER TABLE "PermissionGrant" ADD COLUMN     "awsAccountId" TEXT;

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "actorUserId" TEXT,
ADD COLUMN     "tenantId" TEXT;

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "providerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ApplicationRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwsOrganisation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "organisationName" TEXT NOT NULL,
    "managementAccountId" TEXT NOT NULL,
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwsOrganisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwsOrganisationalUnit" (
    "id" TEXT NOT NULL,
    "awsOrganisationId" TEXT NOT NULL,
    "ouId" TEXT NOT NULL,
    "parentOuId" TEXT,
    "name" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwsOrganisationalUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwsAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "awsOrganisationId" TEXT,
    "ouId" TEXT,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountEmail" TEXT,
    "accountType" "AccountType" NOT NULL,
    "environment" TEXT NOT NULL,
    "riskTier" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "connectionType" "ConnectionType" NOT NULL,
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "executionRoleArn" TEXT,
    "readRoleArn" TEXT,
    "provisionRoleArn" TEXT,
    "externalIdSecretReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminScope" (
    "id" TEXT NOT NULL,
    "tenantMembershipId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "includeDescendants" BOOLEAN NOT NULL DEFAULT true,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canRequest" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canProvision" BOOLEAN NOT NULL DEFAULT false,
    "canRevoke" BOOLEAN NOT NULL DEFAULT false,
    "canManageConfiguration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "AccountType",
    "riskTier" TEXT,
    "permissionRisk" TEXT,
    "maximumDuration" INTEGER,
    "permanentAccessAllowed" BOOLEAN NOT NULL DEFAULT false,
    "automaticProvisioningAllowed" BOOLEAN NOT NULL DEFAULT false,
    "requiredApprovalStages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwsPrincipalMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "awsAccountId" TEXT NOT NULL,
    "principalType" "TargetType" NOT NULL,
    "principalArn" TEXT NOT NULL,
    "identityCenterUserId" TEXT,
    "identityCenterGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwsPrincipalMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionAuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "awsAccountId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerSubject_key" ON "AuthIdentity"("provider", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "TenantMembership_userId_idx" ON "TenantMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_tenantId_userId_key" ON "TenantMembership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AwsOrganisation_tenantId_organisationId_key" ON "AwsOrganisation"("tenantId", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "AwsOrganisationalUnit_awsOrganisationId_ouId_key" ON "AwsOrganisationalUnit"("awsOrganisationId", "ouId");

-- CreateIndex
CREATE INDEX "AwsAccount_awsOrganisationId_ouId_idx" ON "AwsAccount"("awsOrganisationId", "ouId");

-- CreateIndex
CREATE UNIQUE INDEX "AwsAccount_tenantId_accountId_key" ON "AwsAccount"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "AdminScope_scopeType_scopeId_idx" ON "AdminScope"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminScope_tenantMembershipId_scopeType_scopeId_key" ON "AdminScope"("tenantMembershipId", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "ApprovalPolicy_tenantId_accountType_riskTier_idx" ON "ApprovalPolicy"("tenantId", "accountType", "riskTier");

-- CreateIndex
CREATE UNIQUE INDEX "AwsPrincipalMapping_userId_awsAccountId_principalArn_key" ON "AwsPrincipalMapping"("userId", "awsAccountId", "principalArn");

-- CreateIndex
CREATE INDEX "ConnectionAuditEvent_tenantId_createdAt_idx" ON "ConnectionAuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Request_tenantId_awsAccountId_status_idx" ON "Request"("tenantId", "awsAccountId", "status");

-- CreateIndex
CREATE INDEX "Request_requesterUserId_idx" ON "Request"("requesterUserId");

-- CreateIndex
CREATE INDEX "Approval_requestId_stage_idx" ON "Approval"("requestId", "stage");

-- CreateIndex
CREATE INDEX "PermissionGrant_awsAccountId_targetArn_policyArn_idx" ON "PermissionGrant"("awsAccountId", "targetArn", "policyArn");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_awsAccountId_idx" ON "AuditEvent"("tenantId", "awsAccountId");

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsOrganisation" ADD CONSTRAINT "AwsOrganisation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsOrganisationalUnit" ADD CONSTRAINT "AwsOrganisationalUnit_awsOrganisationId_fkey" FOREIGN KEY ("awsOrganisationId") REFERENCES "AwsOrganisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsAccount" ADD CONSTRAINT "AwsAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsAccount" ADD CONSTRAINT "AwsAccount_awsOrganisationId_fkey" FOREIGN KEY ("awsOrganisationId") REFERENCES "AwsOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsAccount" ADD CONSTRAINT "AwsAccount_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "AwsOrganisationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminScope" ADD CONSTRAINT "AdminScope_tenantMembershipId_fkey" FOREIGN KEY ("tenantMembershipId") REFERENCES "TenantMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsPrincipalMapping" ADD CONSTRAINT "AwsPrincipalMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsPrincipalMapping" ADD CONSTRAINT "AwsPrincipalMapping_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_awsOrganisationId_fkey" FOREIGN KEY ("awsOrganisationId") REFERENCES "AwsOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "AwsOrganisationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_approvalPolicyId_fkey" FOREIGN KEY ("approvalPolicyId") REFERENCES "ApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionAuditEvent" ADD CONSTRAINT "ConnectionAuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionAuditEvent" ADD CONSTRAINT "ConnectionAuditEvent_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionAuditEvent" ADD CONSTRAINT "ConnectionAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
