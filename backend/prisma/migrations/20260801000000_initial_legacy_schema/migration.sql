-- Restored missing initial schema from repository commit 7f453d8.
-- Runs BEFORE the unchanged historical upgrade migrations; see baseline/README.md.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMINISTRATOR', 'MANAGER', 'ENGINEER', 'AUDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('USER', 'ROLE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'MORE_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED', 'PROVISIONING', 'PROVISIONED', 'PROVISIONING_FAILED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RequestMode" AS ENUM ('MANAGED_POLICY', 'SPECIFIC_ACTIONS');

-- CreateEnum
CREATE TYPE "ProvisioningMode" AS ENUM ('MOCK', 'SIMULATE', 'LIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "approver" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetArn" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "duration" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "notes" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mode" "RequestMode" NOT NULL,
    "policyArn" TEXT,
    "policyName" TEXT,
    "actions" TEXT[],
    "generatedPolicyDocument" JSONB,

    CONSTRAINT "RequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approver" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGrant" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetArn" TEXT NOT NULL,
    "policyArn" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "provisioningResponse" JSONB NOT NULL,
    "revocationResponse" JSONB,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningJob" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mode" "ProvisioningMode" NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProvisioningJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "requestId" TEXT,
    "awsAccountId" TEXT,
    "targetArn" TEXT,
    "policyArn" TEXT,
    "action" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "result" TEXT NOT NULL,
    "errorCode" TEXT,
    "awsRequestId" TEXT,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSettings" (
    "id" TEXT NOT NULL DEFAULT 'permissionhub',
    "provisioningMode" TEXT NOT NULL DEFAULT 'MOCK',
    "enableLiveProvisioning" BOOLEAN NOT NULL DEFAULT false,
    "liveConfirmationProvided" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PermissionGrant_requestId_idx" ON "PermissionGrant"("requestId");

-- CreateIndex
CREATE INDEX "PermissionGrant_targetArn_policyArn_idx" ON "PermissionGrant"("targetArn", "policyArn");

-- CreateIndex
CREATE INDEX "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp");

-- CreateIndex
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningJob" ADD CONSTRAINT "ProvisioningJob_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
