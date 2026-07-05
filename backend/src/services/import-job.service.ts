import { prisma } from '../lib/prisma';
import { isValidCpf, sanitizeCpf } from '../lib/cpf-validator';
import { PlanLimitsService } from './plan-limits.service';

export class ImportJobService {
  /**
   * Helper to validate a single UUID string safely.
   */
  private static isUuid(val: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  }

  /**
   * Validate all rows inside an ImportJob and write issues.
   */
  static async validateJob(jobId: string): Promise<void> {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
    });

    if (!job) throw new Error('Job de importação não encontrado.');

    // Clear existing issues
    await prisma.importValidationIssue.deleteMany({
      where: { importJobId: jobId },
    });

    const rows = (job.parsedData as any[]) || [];
    const mappings = (job.mappings as Record<string, string>) || {};
    const companyId = job.companyId;

    if (rows.length === 0) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: 'READY', validRows: 0, invalidRows: 0, totalRows: 0 },
      });
      return;
    }

    const issues: any[] = [];
    const cpfSeen = new Set<string>();

    // Pre-fetch list of active managers and schedules for validation lookup
    const managers = await prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true, email: true, name: true },
    });

    const schedules = await prisma.workSchedule.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
    });

    let validRowsCount = 0;
    let invalidRowsCount = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNumber = row.__rowNum || (idx + 2);
      let hasError = false;

      // 1. Full name validation
      const nameKey = mappings.name;
      const name = nameKey ? String(row[nameKey] || '').trim() : '';
      if (!name) {
        issues.push({
          importJobId: jobId,
          rowNumber,
          field: 'name',
          code: 'MISSING_NAME',
          message: 'Nome completo é obrigatório.',
          severity: 'ERROR',
        });
        hasError = true;
      }

      // 2. CPF validation
      const cpfKey = mappings.cpf;
      const rawCpf = cpfKey ? String(row[cpfKey] || '').trim() : '';
      if (!rawCpf) {
        issues.push({
          importJobId: jobId,
          rowNumber,
          field: 'cpf',
          code: 'MISSING_CPF',
          message: 'CPF é obrigatório.',
          severity: 'ERROR',
        });
        hasError = true;
      } else {
        const cpf = sanitizeCpf(rawCpf);
        if (!isValidCpf(cpf)) {
          issues.push({
            importJobId: jobId,
            rowNumber,
            field: 'cpf',
            code: 'INVALID_CPF',
            message: `CPF inválido: ${rawCpf}.`,
            severity: 'ERROR',
          });
          hasError = true;
        } else if (cpfSeen.has(cpf)) {
          issues.push({
            importJobId: jobId,
            rowNumber,
            field: 'cpf',
            code: 'DUPLICATE_IN_FILE',
            message: `CPF duplicado no próprio arquivo: ${rawCpf}.`,
            severity: 'ERROR',
          });
          hasError = true;
        } else {
          cpfSeen.add(cpf);

          // Unique in DB (if CREATE_ONLY or UPSERT)
          if (job.mode !== 'UPDATE_EXISTING') {
            const dbExisting = await prisma.employee.findFirst({
              where: { companyId, cpf },
            });
            if (dbExisting) {
              issues.push({
                importJobId: jobId,
                rowNumber,
                field: 'cpf',
                code: 'DUPLICATE_IN_DB',
                message: `O CPF ${cpf} já está cadastrado para o colaborador "${dbExisting.fullName}".`,
                severity: 'WARNING', // Warning here since UPSERT/UPDATE modes will handle it, or skips will ignore.
              });
            }
          }
        }
      }

      // 3. WhatsApp validation
      const whatsappKey = mappings.whatsapp;
      const rawWhatsapp = whatsappKey ? String(row[whatsappKey] || '').trim() : '';
      if (!rawWhatsapp) {
        issues.push({
          importJobId: jobId,
          rowNumber,
          field: 'whatsapp',
          code: 'MISSING_WHATSAPP',
          message: 'WhatsApp é obrigatório.',
          severity: 'ERROR',
        });
        hasError = true;
      } else {
        const whatsapp = rawWhatsapp.replace(/\D/g, '');
        if (whatsapp.length < 10) {
          issues.push({
            importJobId: jobId,
            rowNumber,
            field: 'whatsapp',
            code: 'INVALID_WHATSAPP',
            message: 'WhatsApp deve conter pelo menos DDD e número.',
            severity: 'ERROR',
          });
          hasError = true;
        }
      }

      // 4. Email validation
      const emailKey = mappings.email;
      const email = emailKey ? String(row[emailKey] || '').trim() : '';
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          issues.push({
            importJobId: jobId,
            rowNumber,
            field: 'email',
            code: 'INVALID_EMAIL',
            message: `E-mail inválido: ${email}.`,
            severity: 'ERROR',
          });
          hasError = true;
        }
      }

      // 5. Work model validation
      const workModelKey = mappings.workModel;
      const rawWorkModel = workModelKey ? String(row[workModelKey] || '').trim().toUpperCase() : '';
      if (rawWorkModel && !['PRESENTIAL', 'REMOTE', 'HYBRID'].includes(rawWorkModel)) {
        issues.push({
          importJobId: jobId,
          rowNumber,
          field: 'workModel',
          code: 'INVALID_WORK_MODEL',
          message: `Modelo de trabalho inválido: ${rawWorkModel}. Escolha entre PRESENTIAL, REMOTE ou HYBRID.`,
          severity: 'WARNING',
        });
      }

      // 6. Manager lookup validation
      const managerKey = mappings.managerUserId;
      const rawManager = managerKey ? String(row[managerKey] || '').trim() : '';
      if (rawManager) {
        let foundManager = false;
        if (this.isUuid(rawManager)) {
          foundManager = managers.some(m => m.id === rawManager);
        } else {
          // Lookup by email or name (case-insensitive)
          foundManager = managers.some(
            m => m.email.toLowerCase() === rawManager.toLowerCase() ||
                 m.name.toLowerCase() === rawManager.toLowerCase()
          );
        }
        if (!foundManager) {
          issues.push({
            importJobId: jobId,
            rowNumber,
            field: 'managerUserId',
            code: 'MANAGER_NOT_FOUND',
            message: `Gestor "${rawManager}" não encontrado na empresa.`,
            severity: 'ERROR',
          });
          hasError = true;
        }
      }

      // 7. Work schedule validation
      const scheduleKey = mappings.workScheduleId;
      const rawSchedule = scheduleKey ? String(row[scheduleKey] || '').trim() : '';
      if (rawSchedule) {
        let foundSchedule = false;
        if (this.isUuid(rawSchedule)) {
          foundSchedule = schedules.some(s => s.id === rawSchedule);
        } else {
          foundSchedule = schedules.some(
            s => s.name.toLowerCase() === rawSchedule.toLowerCase()
          );
        }
        if (!foundSchedule) {
          issues.push({
            importJobId: jobId,
            rowNumber,
            field: 'workScheduleId',
            code: 'SCHEDULE_NOT_FOUND',
            message: `Escala "${rawSchedule}" não encontrada.`,
            severity: 'ERROR',
          });
          hasError = true;
        }
      }

      if (hasError) {
        invalidRowsCount++;
      } else {
        validRowsCount++;
      }
    }

    // Persist all validation issues
    if (issues.length > 0) {
      await prisma.importValidationIssue.createMany({
        data: issues,
      });
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: invalidRowsCount > 0 ? 'MAPPING' : 'READY',
        validRows: validRowsCount,
        invalidRows: invalidRowsCount,
        totalRows: rows.length,
      },
    });
  }

  /**
   * Run background processing of the ImportJob.
   */
  static async processImportJob(jobId: string): Promise<void> {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      console.error(`[ImportJobService] Job ${jobId} not found.`);
      return;
    }

    if (job.status !== 'QUEUED') {
      console.warn(`[ImportJobService] Job ${jobId} status is ${job.status}, expected QUEUED. Skipping.`);
      return;
    }

    // Update to IMPORTING
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'IMPORTING',
        startedAt: new Date(),
      },
    });

    const rows = (job.parsedData as any[]) || [];
    const mappings = (job.mappings as Record<string, string>) || {};
    const companyId = job.companyId;

    // Cache lookup lists for the transaction
    const managers = await prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true, email: true, name: true },
    });

    const schedules = await prisma.workSchedule.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
    });

    const chunkSize = 100;
    let createdRows = 0;
    let updatedRows = 0;
    let skippedRows = 0;
    let failedRows = 0;
    let processedRows = 0;

    for (let chunkStart = 0; chunkStart < rows.length; chunkStart += chunkSize) {
      // Check if job has been cancelled in mid-run
      const currentJobState = await prisma.importJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (currentJobState?.status === 'CANCELLED') {
        console.log(`[ImportJobService] Job ${jobId} was cancelled during processing.`);
        return;
      }

      const chunk = rows.slice(chunkStart, chunkStart + chunkSize);

      try {
        await prisma.$transaction(async (tx) => {
          // Double-check plan limit before chunk processing
          const subscription = await PlanLimitsService.getCurrentSubscription(companyId);
          const limit = subscription.plan.maxEmployees;

          for (let idx = 0; idx < chunk.length; idx++) {
            const row = chunk[idx];
            const rowNumber = row.__rowNum || (chunkStart + idx + 2);

            const name = mappings.name ? String(row[mappings.name] || '').trim() : '';
            const cpf = mappings.cpf ? sanitizeCpf(String(row[mappings.cpf] || '')) : '';
            const whatsapp = mappings.whatsapp ? String(row[mappings.whatsapp] || '').replace(/\D/g, '') : '';
            const email = mappings.email ? String(row[mappings.email] || '').trim() || null : null;
            const sector = mappings.sector ? String(row[mappings.sector] || '').trim() || null : null;
            const jobTitle = mappings.jobTitle ? String(row[mappings.jobTitle] || '').trim() || null : null;
            const registrationNumber = mappings.registrationNumber ? String(row[mappings.registrationNumber] || '').trim() || null : null;

            // Resolve workModel with fallback
            const rawModel = mappings.workModel ? String(row[mappings.workModel] || '').trim().toUpperCase() : '';
            const workModel = ['PRESENTIAL', 'REMOTE', 'HYBRID'].includes(rawModel) ? (rawModel as any) : 'PRESENTIAL';

            // Required validations
            if (!name || !cpf || !whatsapp || !isValidCpf(cpf) || whatsapp.length < 10) {
              failedRows++;
              await tx.importValidationIssue.create({
                data: {
                  importJobId: jobId,
                  rowNumber,
                  field: 'row',
                  code: 'ROW_VALIDATION_FAILED',
                  message: 'Falha crítica na estrutura de dados da linha.',
                  severity: 'ERROR',
                },
              });
              continue;
            }

            // Resolve managerUserId
            let managerUserId: string | null = null;
            const rawManager = mappings.managerUserId ? String(row[mappings.managerUserId] || '').trim() : '';
            if (rawManager) {
              let m;
              if (this.isUuid(rawManager)) {
                m = managers.find(x => x.id === rawManager);
              } else {
                m = managers.find(
                  x => x.email.toLowerCase() === rawManager.toLowerCase() ||
                       x.name.toLowerCase() === rawManager.toLowerCase()
                );
              }
              if (m) managerUserId = m.id;
            }

            // Resolve workScheduleId
            let workScheduleId: string | null = null;
            const rawSchedule = mappings.workScheduleId ? String(row[mappings.workScheduleId] || '').trim() : '';
            if (rawSchedule) {
              let s;
              if (this.isUuid(rawSchedule)) {
                s = schedules.find(x => x.id === rawSchedule);
              } else {
                s = schedules.find(x => x.name.toLowerCase() === rawSchedule.toLowerCase());
              }
              if (s) workScheduleId = s.id;
            }

            // Check if employee already exists in DB
            const existingEmployee = await tx.employee.findFirst({
              where: { companyId, cpf },
            });

            // 1. Mode CREATE_ONLY
            if (job.mode === 'CREATE_ONLY') {
              if (existingEmployee) {
                skippedRows++;
                continue;
              }

              // Count current active employees before creating
              const currentActiveCount = await tx.employee.count({
                where: { companyId, status: 'ACTIVE' },
              });
              if (currentActiveCount >= limit) {
                failedRows++;
                await tx.importValidationIssue.create({
                  data: {
                    importJobId: jobId,
                    rowNumber,
                    field: 'plan',
                    code: 'PLAN_LIMIT_EXCEEDED',
                    message: 'Colaborador não importado: limite do plano atingido.',
                    severity: 'ERROR',
                  },
                });
                continue;
              }

              await tx.employee.create({
                data: {
                  companyId,
                  fullName: name,
                  cpf,
                  whatsapp,
                  email,
                  sector,
                  jobTitle,
                  registrationNumber,
                  workModel,
                  managerUserId,
                  workScheduleId,
                  status: 'ACTIVE',
                },
              });
              createdRows++;
            }

            // 2. Mode UPDATE_EXISTING
            else if (job.mode === 'UPDATE_EXISTING') {
              if (!existingEmployee) {
                skippedRows++;
                continue;
              }

              await tx.employee.update({
                where: { id: existingEmployee.id },
                data: {
                  fullName: name,
                  whatsapp,
                  email,
                  sector,
                  jobTitle,
                  registrationNumber,
                  workModel,
                  managerUserId,
                  workScheduleId,
                },
              });
              updatedRows++;
            }

            // 3. Mode UPSERT
            else if (job.mode === 'UPSERT') {
              if (existingEmployee) {
                await tx.employee.update({
                  where: { id: existingEmployee.id },
                  data: {
                    fullName: name,
                    whatsapp,
                    email,
                    sector,
                    jobTitle,
                    registrationNumber,
                    workModel,
                    managerUserId,
                    workScheduleId,
                  },
                });
                updatedRows++;
              } else {
                // Count current active employees before creating
                const currentActiveCount = await tx.employee.count({
                  where: { companyId, status: 'ACTIVE' },
                });
                if (currentActiveCount >= limit) {
                  failedRows++;
                  await tx.importValidationIssue.create({
                    data: {
                      importJobId: jobId,
                      rowNumber,
                      field: 'plan',
                      code: 'PLAN_LIMIT_EXCEEDED',
                      message: 'Colaborador não importado: limite do plano atingido.',
                      severity: 'ERROR',
                    },
                  });
                  continue;
                }

                await tx.employee.create({
                  data: {
                    companyId,
                    fullName: name,
                    cpf,
                    whatsapp,
                    email,
                    sector,
                    jobTitle,
                    registrationNumber,
                    workModel,
                    managerUserId,
                    workScheduleId,
                    status: 'ACTIVE',
                  },
                });
                createdRows++;
              }
            }
          }
        });

        // Chunk processed successfully, update database statistics
        processedRows += chunk.length;
        await prisma.importJob.update({
          where: { id: jobId },
          data: {
            processedRows,
            createdRows,
            updatedRows,
            skippedRows,
            failedRows,
          },
        });
      } catch (err: any) {
        console.error(`[ImportJobService] Chunk error for job ${jobId} near row ${chunkStart}:`, err);
        failedRows += chunk.length;
        processedRows += chunk.length;
        
        // Write chunk failure details
        await prisma.importValidationIssue.create({
          data: {
            importJobId: jobId,
            rowNumber: chunkStart + 2,
            field: 'chunk',
            code: 'CHUNK_FAILED',
            message: `Erro ao processar lote: ${err.message || 'Erro interno na transação.'}`,
            severity: 'ERROR',
          },
        });

        await prisma.importJob.update({
          where: { id: jobId },
          data: {
            processedRows,
            failedRows,
          },
        });
      }
    }

    // Wrap-up statistics
    const finalJob = await prisma.importJob.findUnique({
      where: { id: jobId },
    });

    const isFullySuccessful = (finalJob?.failedRows ?? 0) === 0;
    const finalStatus = isFullySuccessful ? 'COMPLETED' : 'PARTIAL';

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: job.createdByUserId,
        action: 'EMPLOYEES_IMPORTED_V2',
        entity: 'ImportJob',
        metadata: {
          jobId,
          mode: job.mode,
          createdRows,
          updatedRows,
          skippedRows,
          failedRows,
        },
      },
    });
  }

  /**
   * Safe CSV error exporter with protection against CSV Formula Injection.
   */
  static async buildErrorCsv(jobId: string): Promise<string> {
    const issues = await prisma.importValidationIssue.findMany({
      where: { importJobId: jobId },
      orderBy: { rowNumber: 'asc' },
    });

    const headers = ['Linha', 'Campo', 'Código do Erro', 'Severidade', 'Mensagem'];
    const rows = issues.map(issue => {
      // Escape Formula Injection
      const sanitizeCell = (val: string | null | undefined): string => {
        if (!val) return '';
        const trimmed = val.trim();
        if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
          return `'${trimmed}`;
        }
        return trimmed;
      };

      return [
        String(issue.rowNumber),
        sanitizeCell(issue.field),
        sanitizeCell(issue.code),
        issue.severity,
        sanitizeCell(issue.message),
      ];
    });

    // Escape quote marks and join columns
    const escapeCsvString = (cell: string): string => {
      if (cell.includes(',') || cell.includes(';') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    };

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(escapeCsvString).join(';')),
    ].join('\r\n');

    return csvContent;
  }
}
