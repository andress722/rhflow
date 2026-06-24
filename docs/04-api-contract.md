# 04 — Contrato Inicial de API

Todas as rotas devem usar prefixo `/api`.

## Auth

- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/auth/me

## Users

- GET /api/users
- POST /api/users
- GET /api/users/:id
- PATCH /api/users/:id
- PATCH /api/users/:id/activate
- PATCH /api/users/:id/deactivate

## Employees

- GET /api/employees
- POST /api/employees
- GET /api/employees/:id
- PATCH /api/employees/:id
- PATCH /api/employees/:id/deactivate
- GET /api/employees/:id/occurrences

## Work schedules

- GET /api/work-schedules
- POST /api/work-schedules
- GET /api/work-schedules/:id
- PATCH /api/work-schedules/:id
- PATCH /api/work-schedules/:id/deactivate

## Attendance

- GET /api/attendance-records
- POST /api/attendance-records/manual
- POST /api/attendance-records/import
- GET /api/attendance-records/inconsistencies

## Occurrences

- GET /api/occurrences
- POST /api/occurrences
- GET /api/occurrences/:id
- PATCH /api/occurrences/:id/status
- POST /api/occurrences/:id/comment
- POST /api/occurrences/:id/resolve
- POST /api/occurrences/:id/reject
- GET /api/occurrences/:id/timeline

## Absences

- GET /api/absences
- POST /api/absences
- PATCH /api/absences/:id/classify
- PATCH /api/absences/:id/return

## Medical certificates

- GET /api/medical-certificates
- POST /api/medical-certificates/upload
- GET /api/medical-certificates/:id
- POST /api/medical-certificates/:id/approve
- POST /api/medical-certificates/:id/reject
- POST /api/medical-certificates/:id/request-resubmission

## Remote work

- POST /api/remote/checkins
- POST /api/remote/checkouts
- POST /api/remote/issues
- PATCH /api/remote/issues/:id/resolve

## WhatsApp webhooks

- POST /api/webhooks/whatsapp
- GET /api/webhooks/whatsapp/verify

## Dashboard

- GET /api/dashboard/summary
- GET /api/dashboard/today
- GET /api/dashboard/pending
- GET /api/dashboard/absenteeism

## Reports

- GET /api/reports/occurrences
- GET /api/reports/absences
- GET /api/reports/certificates
- POST /api/reports/export

## Health

- GET /api/health
- GET /api/health/live
- GET /api/health/ready

## Padrões de resposta

### Sucesso

```json
{
  "success": true,
  "data": {}
}
```

### Erro

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": []
  }
}
```
