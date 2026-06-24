import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { OccurrenceService } from '../services/occurrence.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { CompanySettingsService } from '../services/company-settings.service';
import { PlanLimitsService } from '../services/plan-limits.service';
import { UsageService } from '../services/usage.service';
import { MedicalCertificateStatus, OccurrenceType, OccurrenceSource, AbsenceType, AbsenceStatus, OccurrenceStatus } from '@prisma/client';
import { env } from '../config/env';

// Schemas for query and payload validation
const reviewSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('APPROVED'),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    approvedDays: z.number().int().positive(),
    notes: z.string().optional(),
  }),
  z.object({
    status: z.literal('REJECTED'),
    rejectionReason: z.string().min(1, 'Motivo de rejeição é obrigatório'),
    notes: z.string().optional(),
  }),
  z.object({
    status: z.literal('RESUBMISSION_REQUESTED'),
    rejectionReason: z.string().min(1, 'Motivo de reenvio é obrigatório'),
    notes: z.string().optional(),
  }),
]);

export default async function medicalCertificatesRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication globally for these routes
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /api/medical-certificates/upload
  fastify.post('/medical-certificates/upload', async (request, reply) => {
    const { companyId, sub, role } = request.user;

    const settings = await CompanySettingsService.getOrCreateSettings(companyId);
    if (!settings.enableMedicalCertificates) {
      return reply.status(403).send({
        error: 'FEATURE_DISABLED',
        message: 'Este recurso está desativado nas configurações da empresa.',
      });
    }

    try {
      await PlanLimitsService.assertCanUploadMedicalCertificate(companyId);
    } catch (err: any) {
      if (err.message === 'PLAN_FEATURE_DISABLED') {
        return reply.status(403).send({
          error: 'PLAN_FEATURE_DISABLED',
          message: 'Este recurso não está disponível no plano atual.',
        });
      }
      if (err.message === 'PLAN_LIMIT_EXCEEDED') {
        return reply.status(403).send({
          error: 'PLAN_LIMIT_EXCEEDED',
          message: 'Limite do plano atingido.',
        });
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao verificar limites do plano.',
        },
      });
    }

    // Check multipart parser
    if (!request.isMultipart()) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MULTIPART_REQUIRED',
          message: 'Requisição deve ser multipart/form-data.',
        },
      });
    }

    // Parse files and fields
    let data;
    try {
      data = await request.file();
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message || 'Erro ao processar arquivo.',
        },
      });
    }

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FILE_REQUIRED',
          message: 'Nenhum arquivo enviado.',
        },
      });
    }

    const employeeId = (data.fields.employeeId as any)?.value;
    const occurrenceId = (data.fields.occurrenceId as any)?.value;
    const certificateDateStr = (data.fields.certificateDate as any)?.value;
    const suggestedDaysStr = (data.fields.suggestedDays as any)?.value;

    // Validate required fields
    if (!employeeId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'O campo employeeId é obrigatório.',
        },
      });
    }

    // Validate employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, status: 'ACTIVE' },
    });

    if (!employee) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_EMPLOYEE',
          message: 'Funcionário ativo não encontrado.',
        },
      });
    }

    // RBAC check: VIEWER is blocked from writing; MANAGER can only upload for their team
    if (role === 'VIEWER') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para fazer upload de atestados.',
        },
      });
    }

    if (role === 'MANAGER' && employee.managerUserId !== sub) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Você só pode enviar atestados para funcionários sob sua supervisão direta.',
        },
      });
    }

    // Validate occurrence if provided
    if (occurrenceId) {
      const occurrence = await prisma.occurrence.findFirst({
        where: { id: occurrenceId, companyId, employeeId },
      });
      if (!occurrence) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_OCCURRENCE',
            message: 'Ocorrência fornecida é inválida.',
          },
        });
      }
    }

    // Validate MIME types: PDF, JPG, JPEG, PNG, WEBP
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(data.mimetype)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_MIME_TYPE',
          message: `Formato de arquivo inválido (${data.mimetype}). Aceito apenas PDF, JPG, JPEG, PNG e WEBP.`,
        },
      });
    }

    // Buffer read to check size and save
    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FILE_SIZE_LIMIT',
          message: 'Tamanho do arquivo excede o limite permitido de 5MB.',
        },
      });
    }

    // Double check size
    if (buffer.length > 5242880) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FILE_SIZE_LIMIT',
          message: 'Tamanho do arquivo excede o limite de 5MB.',
        },
      });
    }

    // Save file with secure random UUID filename
    const fileExt = path.extname(data.filename) || `.${data.mimetype.split('/')[1]}`;
    const storedFilename = `${crypto.randomUUID()}${fileExt}`;
    const storageDir = path.join(env.STORAGE_PATH, 'medical-certificates');
    
    // Ensure dir exists
    fs.mkdirSync(storageDir, { recursive: true });
    
    const absolutePath = path.join(storageDir, storedFilename);
    fs.writeFileSync(absolutePath, buffer);

    const relativeStoragePath = `storage/medical-certificates/${storedFilename}`;

    // Database transactional flows
    let finalOccurrenceId = occurrenceId;

    if (!finalOccurrenceId) {
      // 4. Se não houver occurrenceId, criar ocorrência MEDICAL_CERTIFICATE
      const { occurrence } = await OccurrenceService.createOccurrence({
        companyId,
        employeeId,
        type: OccurrenceType.MEDICAL_CERTIFICATE,
        title: 'Atestado Médico Entregue',
        description: `Upload de atestado médico realizado em ${new Date().toLocaleDateString('pt-BR')}.`,
        occurrenceDate: certificateDateStr ? new Date(certificateDateStr) : new Date(),
        source: OccurrenceSource.MANUAL,
        severity: 'MEDIUM',
        managerUserId: employee.managerUserId || undefined,
        actorUserId: sub,
        actorType: 'USER',
      });
      finalOccurrenceId = occurrence.id;
    }

    // Create MedicalCertificate entry
    const certificate = await prisma.medicalCertificate.create({
      data: {
        companyId,
        employeeId,
        occurrenceId: finalOccurrenceId,
        originalFilename: data.filename,
        storedFilename,
        mimeType: data.mimetype,
        fileSize: buffer.length,
        storagePath: relativeStoragePath,
        status: MedicalCertificateStatus.RECEIVED,
        certificateDate: certificateDateStr ? new Date(certificateDateStr) : null,
        suggestedDays: suggestedDaysStr ? parseInt(suggestedDaysStr, 10) : null,
      },
    });

    // Generate MEDICAL_CERTIFICATE_UPLOADED event in timeline
    await prisma.occurrenceEvent.create({
      data: {
        companyId,
        occurrenceId: finalOccurrenceId,
        actorType: 'USER',
        actorUserId: sub,
        eventType: 'MEDICAL_CERTIFICATE_UPLOADED',
        message: `Atestado médico anexado: "${data.filename}"`,
        metadata: {
          certificateId: certificate.id,
          originalFilename: data.filename,
          storedFilename,
          fileSize: buffer.length,
          mimeType: data.mimetype,
        },
      },
    });

    await UsageService.incrementUsage(companyId, 'medical_uploads', 1);

    return reply.status(201).send({
      success: true,
      data: certificate,
    });
  });

  // GET /api/medical-certificates (Respects RBAC)
  fastify.get('/medical-certificates', async (request, reply) => {
    const { companyId, role, sub } = request.user;
    const { status } = request.query as { status?: string };

    const whereClause: any = { companyId };
    if (status) {
      whereClause.status = status;
    }

    if (role === 'MANAGER') {
      whereClause.employee = { managerUserId: sub };
    }

    const certificates = await prisma.medicalCertificate.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { id: true, fullName: true, cpf: true, whatsapp: true, sector: true },
        },
        occurrence: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.status(200).send({
      success: true,
      data: certificates,
    });
  });

  // GET /api/medical-certificates/summary (Respects RBAC)
  fastify.get('/medical-certificates/summary', async (request, reply) => {
    const { companyId, role, sub } = request.user;

    const baseWhere: any = { companyId };
    const absenceWhere: any = { companyId, status: AbsenceStatus.ACTIVE };

    if (role === 'MANAGER') {
      baseWhere.employee = { managerUserId: sub };
      absenceWhere.employee = { managerUserId: sub };
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 11. underReview deve considerar RECEIVED + UNDER_REVIEW
    const underReview = await prisma.medicalCertificate.count({
      where: {
        ...baseWhere,
        status: { in: [MedicalCertificateStatus.RECEIVED, MedicalCertificateStatus.UNDER_REVIEW] },
      },
    });

    // activeAbsences: today is between startDate and endDate
    const now = new Date();
    const activeAbsences = await prisma.absenceRecord.count({
      where: {
        ...absenceWhere,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    // approvedToday
    const approvedToday = await prisma.medicalCertificate.count({
      where: {
        ...baseWhere,
        status: MedicalCertificateStatus.APPROVED,
        reviewedAt: { gte: startOfToday, lte: endOfToday },
      },
    });

    // rejectedToday
    const rejectedToday = await prisma.medicalCertificate.count({
      where: {
        ...baseWhere,
        status: MedicalCertificateStatus.REJECTED,
        reviewedAt: { gte: startOfToday, lte: endOfToday },
      },
    });

    return reply.status(200).send({
      success: true,
      data: {
        underReview,
        activeAbsences,
        approvedToday,
        rejectedToday,
      },
    });
  });

  // GET /api/medical-certificates/:id (Respects RBAC)
  fastify.get('/medical-certificates/:id', async (request, reply) => {
    const { companyId, role, sub } = request.user;
    const { id } = request.params as { id: string };

    const certificate = await prisma.medicalCertificate.findFirst({
      where: { id, companyId },
      include: {
        employee: true,
        occurrence: true,
        absenceRecords: true,
      },
    });

    if (!certificate) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Atestado médico não encontrado',
        },
      });
    }

    // MANAGER visualiza apenas atestados de funcionários sob sua supervisão
    if (role === 'MANAGER' && certificate.employee.managerUserId !== sub) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para visualizar este atestado.',
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: certificate,
    });
  });

  // GET /api/medical-certificates/:id/file (Secure Stream Download)
  fastify.get('/medical-certificates/:id/file', async (request, reply) => {
    const { companyId, role, sub } = request.user;
    const { id } = request.params as { id: string };

    const certificate = await prisma.medicalCertificate.findFirst({
      where: { id, companyId },
      include: { employee: { select: { managerUserId: true } } },
    });

    if (!certificate) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Atestado médico não encontrado',
        },
      });
    }

    // Validate MANAGER access
    if (role === 'MANAGER' && certificate.employee.managerUserId !== sub) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso negado para download do arquivo.',
        },
      });
    }

    // Build secure local path (prevent path traversal by using basename)
    const safeFilename = path.basename(certificate.storedFilename);
    const storageDir = path.join(env.STORAGE_PATH, 'medical-certificates');
    const absolutePath = path.join(storageDir, safeFilename);

    if (!fs.existsSync(absolutePath)) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'O arquivo físico do atestado não foi localizado no servidor.',
        },
      });
    }

    // Register MEDICAL_CERTIFICATE_FILE_VIEWED event in occurrence timeline
    if (certificate.occurrenceId) {
      // Find viewer user name
      const viewerUser = await prisma.user.findUnique({ where: { id: sub } });
      await prisma.occurrenceEvent.create({
        data: {
          companyId,
          occurrenceId: certificate.occurrenceId,
          actorType: 'USER',
          actorUserId: sub,
          eventType: 'MEDICAL_CERTIFICATE_FILE_VIEWED',
          message: `Arquivo de atestado visualizado por ${viewerUser?.name || 'Usuário'}`,
          metadata: {
            viewedByUserId: sub,
            viewedAt: new Date().toISOString(),
          },
        },
      });
    }

    // Return Stream with correct content type
    const fileStream = fs.createReadStream(absolutePath);
    reply.type(certificate.mimeType);
    return reply.send(fileStream);
  });

  // PATCH /api/medical-certificates/:id/review (ADMIN/HR only)
  fastify.patch(
    '/medical-certificates/:id/review',
    { preHandler: [requireRole(['ADMIN', 'HR'])] },
    async (request, reply) => {
      const { companyId, sub } = request.user;

      const settings = await CompanySettingsService.getOrCreateSettings(companyId);
      if (!settings.enableMedicalCertificates) {
        return reply.status(403).send({
          error: 'FEATURE_DISABLED',
          message: 'Este recurso está desativado nas configurações da empresa.',
        });
      }
      const { id } = request.params as { id: string };

      // Validate body
      const bodyResult = reviewSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados de revisão inválidos.',
            details: bodyResult.error.errors,
          },
        });
      }

      // Check certificate existence
      const certificate = await prisma.medicalCertificate.findFirst({
        where: { id, companyId },
        include: { employee: true },
      });

      if (!certificate) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Atestado médico não encontrado',
          },
        });
      }

      // 10. Bloquear transições inválidas (APPROVED, REJECTED, RESUBMISSION_REQUESTED são finais)
      const finalStatuses: MedicalCertificateStatus[] = [
        MedicalCertificateStatus.APPROVED,
        MedicalCertificateStatus.REJECTED,
        MedicalCertificateStatus.RESUBMISSION_REQUESTED,
      ];
      if (finalStatuses.includes(certificate.status)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'FINAL_STATUS_BLOCKED',
            message: `Este atestado já possui um status final revisado (${certificate.status}) e não pode ser alterado novamente.`,
          },
        });
      }

      const reviewData = bodyResult.data;

      // Executing inside a prisma transaction
      const transactionResult = await prisma.$transaction(async (tx) => {
        const reviewedAt = new Date();

        if (reviewData.status === 'APPROVED') {
          const { startDate, endDate, approvedDays, notes } = reviewData;

          // 8. Validar startDate <= endDate e approvedDays > 0
          const start = new Date(startDate);
          const end = new Date(endDate);
          if (start > end) {
            throw new Error('VALIDATION:startDate:A data de início deve ser menor ou igual à data de término.');
          }
          if (approvedDays <= 0) {
            throw new Error('VALIDATION:approvedDays:Os dias aprovados devem ser maiores que zero.');
          }

          // Update MedicalCertificate
          const updatedCert = await tx.medicalCertificate.update({
            where: { id },
            data: {
              status: MedicalCertificateStatus.APPROVED,
              startDate: start,
              endDate: end,
              approvedDays,
              notes: notes || null,
              reviewedByUserId: sub,
              reviewedAt,
            },
          });

          // Create AbsenceRecord
          const absence = await tx.absenceRecord.create({
            data: {
              companyId,
              employeeId: certificate.employeeId,
              occurrenceId: certificate.occurrenceId,
              medicalCertificateId: certificate.id,
              startDate: start,
              endDate: end,
              days: approvedDays,
              type: AbsenceType.MEDICAL_LEAVE,
              status: AbsenceStatus.ACTIVE,
              createdByUserId: sub,
            },
          });

          // Update linked Occurrence status to RESOLVED
          if (certificate.occurrenceId) {
            await tx.occurrence.update({
              where: { id: certificate.occurrenceId },
              data: {
                status: OccurrenceStatus.RESOLVED,
                resolvedAt: reviewedAt,
                resolvedByUserId: sub,
              },
            });

            // Generate occurrence events: MEDICAL_CERTIFICATE_APPROVED
            await tx.occurrenceEvent.create({
              data: {
                companyId,
                occurrenceId: certificate.occurrenceId,
                actorType: 'USER',
                actorUserId: sub,
                eventType: 'MEDICAL_CERTIFICATE_APPROVED',
                message: 'Atestado médico aprovado pelo RH.',
                metadata: { reviewedByUserId: sub, reviewedAt: reviewedAt.toISOString(), approvedDays },
              },
            });

            // Generate occurrence events: ABSENCE_PERIOD_CREATED
            await tx.occurrenceEvent.create({
              data: {
                companyId,
                occurrenceId: certificate.occurrenceId,
                actorType: 'USER',
                actorUserId: sub,
                eventType: 'ABSENCE_PERIOD_CREATED',
                message: `Período de afastamento registrado de ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')} (${approvedDays} dias).`,
                metadata: {
                  absenceRecordId: absence.id,
                  startDate,
                  endDate,
                  days: approvedDays,
                },
              },
            });

            // Notify manager via simulated WhatsApp service
            if (certificate.employee.managerUserId) {
              const manager = await tx.user.findUnique({
                where: { id: certificate.employee.managerUserId },
              });
              if (manager) {
                const messageText = `Prezado(a) ${manager.name}, notificamos que o atestado médico do funcionário ${certificate.employee.fullName} foi aprovado. Período: de ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')} (${approvedDays} dias).`;
                
                // Trigger outbound simulation
                await WhatsAppService.sendMessage({
                  to: 'manager_whatsapp_simulated',
                  message: messageText,
                  occurrenceId: certificate.occurrenceId,
                  companyId,
                });

                // Generate event: MANAGER_NOTIFIED
                await tx.occurrenceEvent.create({
                  data: {
                    companyId,
                    occurrenceId: certificate.occurrenceId,
                    actorType: 'SYSTEM',
                    eventType: 'MANAGER_NOTIFIED',
                    message: `Gestor ${manager.name} notificado da aprovação via WhatsApp.`,
                    metadata: { managerUserId: manager.id, messageText },
                  },
                });
              }
            }
          }

          return updatedCert;
        } else if (reviewData.status === 'REJECTED') {
          const { rejectionReason, notes } = reviewData;

          // Update MedicalCertificate
          const updatedCert = await tx.medicalCertificate.update({
            where: { id },
            data: {
              status: MedicalCertificateStatus.REJECTED,
              rejectionReason,
              notes: notes || null,
              reviewedByUserId: sub,
              reviewedAt,
            },
          });

          // Update linked Occurrence status to REJECTED
          if (certificate.occurrenceId) {
            await tx.occurrence.update({
              where: { id: certificate.occurrenceId },
              data: {
                status: OccurrenceStatus.REJECTED,
                resolvedAt: reviewedAt,
                resolvedByUserId: sub,
              },
            });

            // Generate event: MEDICAL_CERTIFICATE_REJECTED
            await tx.occurrenceEvent.create({
              data: {
                companyId,
                occurrenceId: certificate.occurrenceId,
                actorType: 'USER',
                actorUserId: sub,
                eventType: 'MEDICAL_CERTIFICATE_REJECTED',
                message: `Atestado médico recusado. Motivo: ${rejectionReason}`,
                metadata: { rejectionReason, reviewedByUserId: sub, reviewedAt: reviewedAt.toISOString() },
              },
            });
          }

          return updatedCert;
        } else {
          // status === 'RESUBMISSION_REQUESTED'
          const { rejectionReason: reason, notes } = reviewData;

          // Update MedicalCertificate
          const updatedCert = await tx.medicalCertificate.update({
            where: { id },
            data: {
              status: MedicalCertificateStatus.RESUBMISSION_REQUESTED,
              rejectionReason: reason,
              notes: notes || null,
              reviewedByUserId: sub,
              reviewedAt,
            },
          });

          // Update linked Occurrence status to WAITING_EMPLOYEE
          if (certificate.occurrenceId) {
            await tx.occurrence.update({
              where: { id: certificate.occurrenceId },
              data: {
                status: OccurrenceStatus.WAITING_EMPLOYEE,
              },
            });

            // Generate event: MEDICAL_CERTIFICATE_RESUBMISSION_REQUESTED
            await tx.occurrenceEvent.create({
              data: {
                companyId,
                occurrenceId: certificate.occurrenceId,
                actorType: 'USER',
                actorUserId: sub,
                eventType: 'MEDICAL_CERTIFICATE_RESUBMISSION_REQUESTED',
                message: `Solicitação de reenvio do atestado enviada. Motivo: ${reason}`,
                metadata: { reason, reviewedByUserId: sub, reviewedAt: reviewedAt.toISOString() },
              },
            });

            // Notify employee via WhatsApp outbound simulation
            const messageText = `Prezado(a) ${certificate.employee.fullName}, seu atestado médico foi recusado e necessita de reenvio. Motivo: ${reason}. Por favor, envie uma foto legível ou PDF do atestado atualizado pelo WhatsApp.`;
            
            await WhatsAppService.sendMessage({
              to: certificate.employee.whatsapp,
              message: messageText,
              occurrenceId: certificate.occurrenceId,
              companyId,
            });

            // Generate event: EMPLOYEE_NOTIFIED
            await tx.occurrenceEvent.create({
              data: {
                companyId,
                occurrenceId: certificate.occurrenceId,
                actorType: 'SYSTEM',
                eventType: 'EMPLOYEE_NOTIFIED',
                message: `Funcionário notificado da necessidade de reenvio via WhatsApp.`,
                metadata: { employeeId: certificate.employeeId, messageText },
              },
            });
          }

          return updatedCert;
        }
      }).catch((err: Error) => {
        // Intercept validation messages from within transaction
        if (err.message.startsWith('VALIDATION:')) {
          const [, field, msg] = err.message.split(':');
          return { errorValidation: true, field, msg };
        }
        throw err;
      });

      if ('errorValidation' in transactionResult) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: (transactionResult as any).msg,
            details: [{ path: [(transactionResult as any).field], message: (transactionResult as any).msg }],
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: transactionResult,
      });
    },
  );
}
