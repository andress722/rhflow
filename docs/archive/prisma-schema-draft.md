# Draft Schema Prisma Original

Este arquivo contém o rascunho original fornecido na raiz do backend antes da inicialização do projeto no Sprint 00.

```prisma
// Draft inicial. O agente backend deve revisar, completar relações e gerar migrations.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  HR
  MANAGER
  VIEWER
}

enum WorkModel {
  PRESENTIAL
  REMOTE
  HYBRID
}

enum EmployeeStatus {
  ACTIVE
  INACTIVE
}

enum OccurrenceType {
  MISSED_CLOCK_IN
  MISSED_CLOCK_OUT
  LATE_ARRIVAL
  EARLY_LEAVE
  ABSENCE
  TEMPORARY_ABSENCE
  MEDICAL_CERTIFICATE
  REMOTE_CHECKIN_MISSED
  REMOTE_CHECKOUT_MISSED
  REMOTE_TECHNICAL_ISSUE
}

enum OccurrenceStatus {
  OPEN
  WAITING_EMPLOYEE
  WAITING_MANAGER
  WAITING_HR
  RESOLVED
  REJECTED
  CANCELLED
}

enum OccurrenceSource {
  SYSTEM
  WHATSAPP
  MANUAL
  IMPORT
}

enum MedicalCertificateStatus {
  RECEIVED
  UNDER_REVIEW
  APPROVED
  REJECTED
  RESUBMISSION_REQUESTED
}

model Company {
  id        String   @id @default(uuid())
  name      String
  legalName String?
  cnpj      String?
  timezone  String   @default("America/Sao_Paulo")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users     User[]
  employees Employee[]
}

model User {
  id           String   @id @default(uuid())
  companyId    String
  company      Company  @relation(fields: [companyId], references: [id])
  name         String
  email        String
  passwordHash String
  role         UserRole
  isActive     Boolean  @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([companyId, email])
}

model Employee {
  id             String         @id @default(uuid())
  companyId      String
  company        Company        @relation(fields: [companyId], references: [id])
  managerUserId  String?
  fullName       String
  cpf            String
  whatsapp       String
  email          String?
  sector         String?
  jobTitle       String?
  workModel      WorkModel      @default(PRESENTIAL)
  workScheduleId String?
  status         EmployeeStatus @default(ACTIVE)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@unique([companyId, cpf])
}

model WorkSchedule {
  id                    String   @id @default(uuid())
  companyId             String
  name                  String
  workDays              Json
  expectedClockIn        String
  expectedClockOut       String
  toleranceMinutes       Int      @default(10)
  requireRemoteCheckin   Boolean  @default(false)
  requireRemoteCheckout  Boolean  @default(false)
  isActive              Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model Occurrence {
  id               String           @id @default(uuid())
  companyId        String
  employeeId       String
  managerUserId    String?
  type             OccurrenceType
  status           OccurrenceStatus @default(OPEN)
  title            String
  description      String?
  occurrenceDate   DateTime
  source           OccurrenceSource @default(SYSTEM)
  severity         String           @default("LOW")
  resolvedAt       DateTime?
  resolvedByUserId String?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  events           OccurrenceEvent[]
}

model OccurrenceEvent {
  id           String   @id @default(uuid())
  companyId    String
  occurrenceId String
  occurrence   Occurrence @relation(fields: [occurrenceId], references: [id])
  actorType    String
  actorUserId  String?
  eventType    String
  message      String?
  metadata     Json?
  createdAt    DateTime @default(now())
}

model MedicalCertificate {
  id                String @id @default(uuid())
  companyId         String
  employeeId        String
  occurrenceId      String?
  fileName          String
  filePath          String
  mimeType          String
  status            MedicalCertificateStatus @default(RECEIVED)
  certificateDate   DateTime?
  suggestedDays     Int?
  approvedStartDate DateTime?
  approvedEndDate   DateTime?
  approvedDays      Int?
  rejectionReason   String?
  hrNotes           String?
  reviewedByUserId  String?
  reviewedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```
