# 03 — Modelo de Dados Inicial

Este modelo serve como base para o Prisma. O agente deve transformar essas entidades em `schema.prisma`.

## Company

- id
- name
- legalName
- cnpj
- timezone
- isActive
- createdAt
- updatedAt

## User

- id
- companyId
- name
- email
- passwordHash
- role: ADMIN | HR | MANAGER | VIEWER
- isActive
- lastLoginAt
- createdAt
- updatedAt

## Employee

- id
- companyId
- managerUserId nullable
- fullName
- cpf
- whatsapp
- email nullable
- sector
- jobTitle
- workModel: PRESENTIAL | REMOTE | HYBRID
- workScheduleId nullable
- status: ACTIVE | INACTIVE
- createdAt
- updatedAt

## WorkSchedule

- id
- companyId
- name
- workDays: string[] or json
- expectedClockIn
- expectedClockOut
- toleranceMinutes
- requireRemoteCheckin
- requireRemoteCheckout
- isActive
- createdAt
- updatedAt

## AttendanceRecord

- id
- companyId
- employeeId
- date
- clockInAt nullable
- clockOutAt nullable
- source: MANUAL | CSV_IMPORT | API | REMOTE_CHECKIN
- createdByUserId nullable
- createdAt
- updatedAt

## Occurrence

- id
- companyId
- employeeId
- managerUserId nullable
- type
- status
- title
- description nullable
- occurrenceDate
- source: SYSTEM | WHATSAPP | MANUAL | IMPORT
- severity: LOW | MEDIUM | HIGH
- resolvedAt nullable
- resolvedByUserId nullable
- createdAt
- updatedAt

## OccurrenceEvent

- id
- companyId
- occurrenceId
- actorType: SYSTEM | USER | EMPLOYEE | WHATSAPP
- actorUserId nullable
- eventType
- message nullable
- metadata json nullable
- createdAt

## AbsenceRecord

- id
- companyId
- employeeId
- occurrenceId
- reason
- status
- startDate
- endDate nullable
- expectedReturnDate nullable
- notes nullable
- decidedByUserId nullable
- decidedAt nullable
- createdAt
- updatedAt

## MedicalCertificate

- id
- companyId
- employeeId
- occurrenceId nullable
- fileName
- filePath
- mimeType
- status
- certificateDate nullable
- suggestedDays nullable
- approvedStartDate nullable
- approvedEndDate nullable
- approvedDays nullable
- rejectionReason nullable
- hrNotes nullable
- reviewedByUserId nullable
- reviewedAt nullable
- createdAt
- updatedAt

## RemoteCheckin

- id
- companyId
- employeeId
- date
- type: CHECKIN | CHECKOUT
- status
- respondedAt nullable
- responseOption nullable
- notes nullable
- createdAt
- updatedAt

## RemoteIssue

- id
- companyId
- employeeId
- occurrenceId nullable
- issueType: INTERNET | POWER | COMPUTER | VPN | COMPANY_SYSTEM | ACCESS | EQUIPMENT | OTHER
- startedAt
- expectedResolutionAt nullable
- resolvedAt nullable
- notes nullable
- status: OPEN | RESOLVED | CANCELLED
- createdAt
- updatedAt

## WhatsAppMessage

- id
- companyId
- employeeId nullable
- occurrenceId nullable
- direction: INBOUND | OUTBOUND
- providerMessageId nullable
- from
- to
- body nullable
- mediaUrl nullable
- mediaMimeType nullable
- status
- payload json
- createdAt

## AutomationRule

- id
- companyId
- name
- type
- isActive
- config json
- createdAt
- updatedAt

## ExportLog

- id
- companyId
- userId
- type
- filters json
- filePath nullable
- createdAt
