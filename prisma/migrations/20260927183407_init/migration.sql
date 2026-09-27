-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GOVT', 'PROVIDER', 'AGENT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "SocialCategory" AS ENUM ('SC', 'ST', 'OBC', 'OPEN', 'EWS');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('ITI', 'PMKK', 'PRIVATE', 'POLYTECHNIC');

-- CreateEnum
CREATE TYPE "ConsentScope" AS ENUM ('employmentTracking', 'wageTracking', 'publicAggregates');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'SMS', 'IVR', 'AGENT', 'PORTAL', 'ENROLMENT_FORM');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('EMPLOYER_LINK', 'EPFO_SIM', 'AGENT', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "OutcomeEventType" AS ENUM ('PLACED', 'SELF_EMPLOYED', 'APPRENTICE', 'UNEMPLOYED', 'JOB_SWITCH', 'WAGE_CHANGE', 'DROPPED_OUT', 'ATTRITION');

-- CreateEnum
CREATE TYPE "OutcomeSource" AS ENUM ('TRAINER_REPORT', 'BOT', 'EMPLOYER_VERIFIED', 'EPFO_SIM', 'AGENT_CALL');

-- CreateEnum
CREATE TYPE "AttritionReason" AS ENUM ('LOW_WAGE', 'RELOCATION', 'WORKING_CONDITIONS', 'SKILL_MISMATCH', 'FAMILY', 'HEALTH', 'OTHER');

-- CreateEnum
CREATE TYPE "Milestone" AS ENUM ('MONTH_3', 'MONTH_6', 'MONTH_12', 'MONTH_24');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('SCHEDULED', 'SENT', 'RESPONDED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "AgentTaskStatus" AS ENUM ('QUEUED', 'IN_CALL', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AlertRule" AS ENUM ('PLACEMENT_VERIFICATION_GAP', 'WAGE_OUTLIER', 'EMPLOYER_CONCENTRATION', 'REJECTION_CLUSTER');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('UDYAM_CERTIFICATE', 'SHOP_PHOTO', 'UPI_SUMMARY', 'OTHER');

-- CreateEnum
CREATE TYPE "StorageBackend" AS ENUM ('SUPABASE', 'INLINE');

-- CreateTable
CREATE TABLE "Trainee" (
    "id" TEXT NOT NULL,
    "unifiedId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "socialCategory" "SocialCategory" NOT NULL,
    "district" TEXT NOT NULL,
    "phonePrimary" TEXT NOT NULL,
    "phoneAlternate" TEXT,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "preferredLang" TEXT NOT NULL DEFAULT 'mr',
    "isPersona" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trainee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "scope" "ConsentScope" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "Channel" NOT NULL,
    "sourceIp" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "district" TEXT NOT NULL,
    "contact" TEXT NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nsqfLevel" INTEGER NOT NULL,
    "sector" TEXT NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "skills" TEXT[],

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "batchStart" TIMESTAMP(3) NOT NULL,
    "batchEnd" TIMESTAMP(3) NOT NULL,
    "attendancePct" DOUBLE PRECISION NOT NULL,
    "assessmentScore" DOUBLE PRECISION NOT NULL,
    "certified" BOOLEAN NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "gstinValid" BOOLEAN NOT NULL,
    "district" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "employeeCount" INTEGER NOT NULL,

    CONSTRAINT "Employer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentRecord" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "monthlyWage" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "EmploymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationMethod" "VerificationMethod",
    "verifiedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutcomeEvent" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "eventType" "OutcomeEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" "OutcomeSource" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attritionReason" "AttritionReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutcomeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "milestone" "Milestone" NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP',
    "status" "FollowUpStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "responses" JSONB NOT NULL DEFAULT '{}',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillGapSignal" (
    "id" TEXT NOT NULL,
    "extractedSkill" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 0,
    "sampleQuotes" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillGapSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "followUpId" TEXT,
    "traineeId" TEXT NOT NULL,
    "assignedTo" TEXT,
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "callNotes" TEXT,
    "resolvedOutcome" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "providerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "targetTraineeId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSession" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "followUpId" TEXT,
    "state" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'mr',
    "context" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "buttons" JSONB NOT NULL DEFAULT '[]',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "BotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "employmentRecordId" TEXT NOT NULL,
    "otp" TEXT,
    "otpIssuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFile" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storage" "StorageBackend" NOT NULL,
    "path" TEXT,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrityAlert" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "rule" "AlertRule" NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "providerId" TEXT,
    "employerId" TEXT,
    "employmentRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trainee_unifiedId_key" ON "Trainee"("unifiedId");

-- CreateIndex
CREATE INDEX "Trainee_district_idx" ON "Trainee"("district");

-- CreateIndex
CREATE INDEX "ConsentRecord_traineeId_scope_capturedAt_idx" ON "ConsentRecord"("traineeId", "scope", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "Enrollment_traineeId_idx" ON "Enrollment"("traineeId");

-- CreateIndex
CREATE INDEX "Enrollment_providerId_idx" ON "Enrollment"("providerId");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Employer_gstin_key" ON "Employer"("gstin");

-- CreateIndex
CREATE INDEX "EmploymentRecord_traineeId_idx" ON "EmploymentRecord"("traineeId");

-- CreateIndex
CREATE INDEX "EmploymentRecord_employerId_idx" ON "EmploymentRecord"("employerId");

-- CreateIndex
CREATE INDEX "EmploymentRecord_status_idx" ON "EmploymentRecord"("status");

-- CreateIndex
CREATE INDEX "OutcomeEvent_traineeId_occurredAt_idx" ON "OutcomeEvent"("traineeId", "occurredAt");

-- CreateIndex
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_traineeId_milestone_key" ON "FollowUp"("traineeId", "milestone");

-- CreateIndex
CREATE UNIQUE INDEX "SkillGapSignal_extractedSkill_district_courseId_key" ON "SkillGapSignal"("extractedSkill", "district", "courseId");

-- CreateIndex
CREATE INDEX "AgentTask_status_idx" ON "AgentTask"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "BotSession_traineeId_active_idx" ON "BotSession"("traineeId", "active");

-- CreateIndex
CREATE INDEX "BotMessage_sessionId_createdAt_idx" ON "BotMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrityAlert_key_key" ON "IntegrityAlert"("key");

-- CreateIndex
CREATE INDEX "OtpChallenge_subject_idx" ON "OtpChallenge"("subject");

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT "EmploymentRecord_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT "EmploymentRecord_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeEvent" ADD CONSTRAINT "OutcomeEvent_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetTraineeId_fkey" FOREIGN KEY ("targetTraineeId") REFERENCES "Trainee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSession" ADD CONSTRAINT "BotSession_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSession" ADD CONSTRAINT "BotSession_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotMessage" ADD CONSTRAINT "BotMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrityAlert" ADD CONSTRAINT "IntegrityAlert_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrityAlert" ADD CONSTRAINT "IntegrityAlert_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrityAlert" ADD CONSTRAINT "IntegrityAlert_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
