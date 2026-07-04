import { prisma } from '../lib/prisma';
import { RemoteCheckinStatus, OccurrenceType, OccurrenceSource, RemoteCheckin, NotificationSeverity } from '@prisma/client';
import { OccurrenceService } from './occurrence.service';
import { CompanySettingsService } from './company-settings.service';
import { PlanLimitsService } from './plan-limits.service';
import { UsageService } from './usage.service';
import { NotificationCenterService } from './notification-center.service';

// Helper to get local date civil in America/Sao_Paulo normalized as a Date representing midnight UTC
export function getLocalDateInSaoPaulo(date: Date = new Date()): Date {
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const formatter = new Intl.DateTimeFormat('en-US', formatOptions);
  const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(date);
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

export class RemoteCheckinService {
  /**
   * Helper to format check-in/out messages with placeholders.
   */
  static formatMessage(
    template: string | null | undefined,
    fallback: string,
    replacements: {
      employeeName?: string;
      companyName?: string;
      date?: string;
      managerName?: string;
      graceMinutes?: number | string;
    }
  ): string {
    const rawTemplate = template && template.trim() !== '' ? template : fallback;

    let msg = rawTemplate;
    if (replacements.employeeName !== undefined) {
      msg = msg.replace(/\{\{employeeName\}\}/g, replacements.employeeName);
    }
    if (replacements.companyName !== undefined) {
      msg = msg.replace(/\{\{companyName\}\}/g, replacements.companyName);
    }
    if (replacements.date !== undefined) {
      msg = msg.replace(/\{\{date\}\}/g, replacements.date);
    }
    if (replacements.managerName !== undefined) {
      msg = msg.replace(/\{\{managerName\}\}/g, replacements.managerName);
    }
    if (replacements.graceMinutes !== undefined) {
      msg = msg.replace(/\{\{graceMinutes\}\}/g, String(replacements.graceMinutes));
    }
    return msg;
  }

  /**
   * Creates a pending remote check-in for an employee on the local date.
   * Enforces daily uniqueness constraint per employee.
   */
  static async createCheckin(options: {
    companyId: string;
    employeeId: string;
    workScheduleId?: string;
    expectedAt?: Date;
  }): Promise<{ checkin: RemoteCheckin; isDuplicate: boolean }> {
    const { companyId, employeeId, workScheduleId, expectedAt } = options;
    const localDate = getLocalDateInSaoPaulo();

    // Check duplicate check-in request for employee on this date
    const existing = await prisma.remoteCheckin.findFirst({
      where: {
        employeeId,
        checkinDate: localDate,
      },
    });

    if (existing) {
      return { checkin: existing, isDuplicate: true };
    }

    const checkin = await prisma.remoteCheckin.create({
      data: {
        companyId,
        employeeId,
        workScheduleId: workScheduleId || null,
        expectedAt: expectedAt || null,
        checkinDate: localDate,
        status: RemoteCheckinStatus.PENDING,
        sentAt: new Date(),
        source: 'AUTOMATION',
      },
    });

    return { checkin, isDuplicate: false };
  }

  /**
   * Creates check-in requests in batch for eligible employees matching filters.
   * Handles duplication check, leaves, inactive status, and missing WhatsApp.
   */
  static async createCheckinBatch(
    filters: {
      workModel?: string;
      workScheduleId?: string;
      sector?: string;
      managerUserId?: string;
    },
    companyId: string
  ): Promise<{
    created: number;
    duplicates: number;
    skipped: number;
    items: Array<{
      employeeId: string;
      employeeName: string;
      status: string;
      reason: string;
    }>;
  }> {
    const whereClause: any = { companyId };
    if (filters.workScheduleId) whereClause.workScheduleId = filters.workScheduleId;
    if (filters.sector) whereClause.sector = filters.sector;
    if (filters.managerUserId) whereClause.managerUserId = filters.managerUserId;

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: { workSchedule: true },
    });

    const localDate = getLocalDateInSaoPaulo();
    const now = new Date();
    const settings = await CompanySettingsService.getOrCreateSettings(companyId);
    const company = await prisma.company.findUnique({ where: { id: companyId } });

    // Fetch active absences for today
    const activeAbsences = await prisma.absenceRecord.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });
    const absentEmployeeIds = new Set(activeAbsences.map((a) => a.employeeId));

    // Fetch existing check-ins today
    const todayCheckins = await prisma.remoteCheckin.findMany({
      where: {
        companyId,
        checkinDate: localDate,
      },
    });
    const checkinEmployeeIds = new Set(todayCheckins.map((c) => c.employeeId));

    let createdCount = 0;
    let duplicateCount = 0;
    let skippedCount = 0;
    const items: any[] = [];

    // Target work models filtering (default to REMOTE/HYBRID)
    let targetWorkModels = ['REMOTE', 'HYBRID'];
    if (filters.workModel) {
      targetWorkModels = [filters.workModel];
    }

    // Count how many check-ins will actually be created
    let eligibleCount = 0;
    for (const emp of employees) {
      if (emp.status !== 'ACTIVE') continue;
      if (!targetWorkModels.includes(emp.workModel)) continue;
      if (!emp.whatsapp || emp.whatsapp.trim() === '') continue;
      if (absentEmployeeIds.has(emp.id)) continue;
      if (checkinEmployeeIds.has(emp.id)) continue;
      eligibleCount++;
    }

    if (eligibleCount > 0) {
      await PlanLimitsService.assertCanRunCheckin(companyId, eligibleCount);
    }

    for (const emp of employees) {
      // 1. Check inactive
      if (emp.status !== 'ACTIVE') {
        skippedCount++;
        items.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          status: 'SKIPPED_INACTIVE',
          reason: 'Funcionário inativo.',
        });
        continue;
      }

      // 2. Check workModel match
      if (!targetWorkModels.includes(emp.workModel)) {
        skippedCount++;
        items.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          status: 'SKIPPED_NOT_REMOTE_OR_HYBRID',
          reason: `Modelo de trabalho (${emp.workModel}) incompatível.`,
        });
        continue;
      }

      // 3. Check WhatsApp
      if (!emp.whatsapp || emp.whatsapp.trim() === '') {
        skippedCount++;
        items.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          status: 'SKIPPED_NO_WHATSAPP',
          reason: 'Número de WhatsApp inválido ou ausente.',
        });
        continue;
      }

      // 4. Check active absence
      if (absentEmployeeIds.has(emp.id)) {
        skippedCount++;
        items.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          status: 'SKIPPED_ACTIVE_ABSENCE',
          reason: 'Funcionário afastado (licença/ausência ativa).',
        });
        continue;
      }

      // 5. Check duplicate check-in
      if (checkinEmployeeIds.has(emp.id)) {
        duplicateCount++;
        items.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          status: 'DUPLICATE',
          reason: 'Check-in já criado para este dia.',
        });
        continue;
      }

      // Create check-in request
      await prisma.remoteCheckin.create({
        data: {
          companyId,
          employeeId: emp.id,
          workScheduleId: emp.workScheduleId || null,
          expectedAt: emp.workSchedule ? now : null,
          checkinDate: localDate,
          status: RemoteCheckinStatus.PENDING,
          sentAt: now,
          source: 'AUTOMATION',
        },
      });

      // Simulate sending message
      const checkinFallback = `Bom dia, {{employeeName}}. Você já iniciou sua jornada remota hoje?\n\n1. Sim, iniciei agora\n2. Vou iniciar mais tarde\n3. Estou com problema técnico\n4. Vou faltar\n5. Estou de atestado`;
      const messageText = RemoteCheckinService.formatMessage(
        settings.whatsappCheckinMessage,
        checkinFallback,
        {
          employeeName: emp.fullName,
          companyName: company?.name || '',
          date: new Date().toLocaleDateString('pt-BR'),
        }
      );
      
      if (messageText && messageText.trim() !== '') {
        const { WhatsAppService } = require('./whatsapp.service');
        await WhatsAppService.sendMessage({
          to: emp.whatsapp,
          message: messageText,
          companyId,
        });
      }

      createdCount++;

      // Warning if no work schedule
      if (!emp.workScheduleId) {
        items.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          status: 'WARNING_NO_WORK_SCHEDULE',
          reason: 'Check-in criado (Alerta: funcionário não possui jornada vinculada).',
        });
      } else {
        items.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          status: 'CREATED',
          reason: 'Solicitação de check-in remoto criada e enviada com sucesso.',
        });
      }
    }

    if (createdCount > 0) {
      await UsageService.incrementUsage(companyId, 'remote_checkins', createdCount);
    }

    return {
      created: createdCount,
      duplicates: duplicateCount,
      skipped: skippedCount,
      items,
    };
  }

  /**
   * Identifies check-ins PENDING that have exceeded graceMinutes and marks them as NOT_RESPONDED.
   * Transactionally creates REMOTE_CHECKIN_NOT_RESPONDED occurrences and notifies managers.
   */
  static async markNotResponded(
    dateStr: string | undefined,
    graceMinutes: number | undefined,
    companyId: string
  ): Promise<{ updated: number }> {
    const settings = await CompanySettingsService.getOrCreateSettings(companyId);
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    const resolvedGrace = graceMinutes !== undefined ? graceMinutes : settings.defaultCheckinGraceMinutes;

    const localDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : getLocalDateInSaoPaulo();
    const cutOff = new Date(Date.now() - resolvedGrace * 60 * 1000);

    const pendingCheckins = await prisma.remoteCheckin.findMany({
      where: {
        companyId,
        checkinDate: localDate,
        status: RemoteCheckinStatus.PENDING,
        sentAt: { lte: cutOff },
      },
      include: {
        employee: {
          select: { id: true, fullName: true, managerUserId: true, whatsapp: true },
        },
      },
    });

    let updatedCount = 0;

    for (const checkin of pendingCheckins) {
      await prisma.$transaction(async (tx) => {
        let finalOccId = checkin.occurrenceId;

        if (!finalOccId) {
          const { occurrence, isDuplicate } = await OccurrenceService.createOccurrence({
            companyId,
            employeeId: checkin.employeeId,
            type: OccurrenceType.REMOTE_CHECKIN_NOT_RESPONDED,
            title: 'Check-in Remoto não respondido',
            description: 'Funcionário não respondeu à solicitação de check-in remoto dentro do prazo limite.',
            occurrenceDate: new Date(),
            source: OccurrenceSource.AUTOMATION,
            severity: 'MEDIUM',
            managerUserId: checkin.employee.managerUserId || undefined,
            actorType: 'SYSTEM',
          }, tx);

          finalOccId = occurrence.id;

          await tx.occurrenceEvent.create({
            data: {
              companyId,
              occurrenceId: occurrence.id,
              actorType: 'SYSTEM',
              eventType: 'REMOTE_CHECKIN_NOT_RESPONDED',
              message: `Check-in pendente do dia ${localDate.toLocaleDateString('pt-BR')} estourou o limite e foi marcado como Sem Resposta.`,
              metadata: { checkinId: checkin.id, graceMinutes: resolvedGrace },
            },
          });

          // Not Responded message to Employee
          const employeeFallback = `Prezado(a) {{employeeName}}, seu check-in remoto do dia {{date}} foi marcado como Não Respondido devido à ausência de resposta dentro do prazo de tolerância.`;
          const employeeMsgText = RemoteCheckinService.formatMessage(
            settings.whatsappNotRespondedMessage,
            employeeFallback,
            {
              employeeName: checkin.employee.fullName,
              companyName: company?.name || '',
              date: localDate.toLocaleDateString('pt-BR'),
              graceMinutes: resolvedGrace,
            }
          );

          if (employeeMsgText && employeeMsgText.trim() !== '') {
            const { WhatsAppService } = require('./whatsapp.service');
            await WhatsAppService.sendMessage({
              to: checkin.employee.whatsapp,
              message: employeeMsgText,
              occurrenceId: occurrence.id,
              companyId,
            });
          }

          // Alert message to Manager
          if (checkin.employee.managerUserId) {
            const manager = await tx.user.findUnique({
              where: { id: checkin.employee.managerUserId },
            });
            if (manager) {
              const managerFallback = `Prezado(a) {{managerName}}, notificamos que o funcionário {{employeeName}} não respondeu ao check-in remoto hoje dentro do limite de tempo ({{graceMinutes}} minutos).`;
              const messageText = RemoteCheckinService.formatMessage(
                settings.whatsappManagerAlertMessage,
                managerFallback,
                {
                  employeeName: checkin.employee.fullName,
                  companyName: company?.name || '',
                  date: localDate.toLocaleDateString('pt-BR'),
                  managerName: manager.name,
                  graceMinutes: resolvedGrace,
                }
              );
              
              if (messageText && messageText.trim() !== '') {
                const { WhatsAppService } = require('./whatsapp.service');
                await WhatsAppService.sendMessage({
                  to: 'manager_whatsapp_simulated',
                  message: messageText,
                  occurrenceId: occurrence.id,
                  companyId,
                });

                await tx.occurrenceEvent.create({
                  data: {
                    companyId,
                    occurrenceId: occurrence.id,
                    actorType: 'SYSTEM',
                    eventType: 'MANAGER_NOTIFIED',
                    message: `Gestor ${manager.name} notificado da falta de resposta via WhatsApp.`,
                    metadata: { managerUserId: manager.id, messageText },
                  },
                });
              }
            }
          }
        }

        await tx.remoteCheckin.update({
          where: { id: checkin.id },
          data: {
            status: RemoteCheckinStatus.NOT_RESPONDED,
            occurrenceId: finalOccId,
          },
        });

        // Notify MANAGER of team member NOT_RESPONDED (fire-and-forget)
        if (checkin.employee.managerUserId) {
          NotificationCenterService.createOrUpdateByDedupeKey({
            companyId,
            userId: checkin.employee.managerUserId,
            role: 'MANAGER',
            type: 'TEAM_CHECKIN_NOT_RESPONDED',
            severity: NotificationSeverity.WARNING,
            title: 'Funcionário não respondeu ao check-in',
            message: `Um funcionário da sua equipe não respondeu ao check-in remoto de hoje.`,
            actionUrl: `/app/presence`,
            entityType: 'RemoteCheckin',
            entityId: checkin.id,
            dedupeKey: `checkin:${checkin.id}:not-responded`,
            metadata: { checkinId: checkin.id, employeeId: checkin.employeeId },
          }).catch(() => {/* silent */});
        }
      });

      updatedCount++;
    }

    return { updated: updatedCount };
  }

  /**
   * Processes a WhatsApp response message for an employee's check-in today.
   * Runs transationally to update check-in and optionally spawn a linked occurrence.
   */
  static async processResponse(options: {
    companyId: string;
    employeeId: string;
    message: string;
    timestamp: Date;
    latitude?: number;
    longitude?: number;
  }): Promise<{ checkin: RemoteCheckin; occurrence?: any } | null> {
    const { companyId, employeeId, message, timestamp, latitude, longitude } = options;
    const localDate = getLocalDateInSaoPaulo(timestamp);

    // Find pending check-in for employee today
    const checkin = await prisma.remoteCheckin.findFirst({
      where: {
        companyId,
        employeeId,
        checkinDate: localDate,
        status: RemoteCheckinStatus.PENDING,
      },
      include: { employee: true, workSchedule: true },
    });

    if (!checkin) {
      return null;
    }

    const text = message.toLowerCase().trim();

    let newStatus: RemoteCheckinStatus = RemoteCheckinStatus.PENDING;
    let occurrenceType: OccurrenceType | null = null;
    let responseOption: string | null = null;

    // Classification rules
    if (text === '1' || text.includes('sim') || text.includes('iniciei') || text.includes('comecei') || text.includes('já comecei') || text.includes('ja comecei')) {
      newStatus = RemoteCheckinStatus.CONFIRMED;
      responseOption = '1. Sim, iniciei agora';
    } else if (text === '2' || text.includes('atrasar') || text.includes('atrasado') || text.includes('mais tarde') || text.includes('vou atrasar') || text.includes('vou iniciar mais tarde')) {
      newStatus = RemoteCheckinStatus.LATE;
      occurrenceType = OccurrenceType.LATE_ARRIVAL;
      responseOption = '2. Vou iniciar mais tarde';
    } else if (text === '3' || text.includes('sem internet') || text.includes('caiu') || text.includes('energia') || text.includes('problema') || text.includes('técnico') || text.includes('luz')) {
      newStatus = RemoteCheckinStatus.ISSUE_REPORTED;
      occurrenceType = OccurrenceType.REMOTE_TECHNICAL_ISSUE;
      responseOption = '3. Estou com problema técnico';
    } else if (text === '4' || text.includes('vou faltar') || text.includes('não vou hoje') || text.includes('nao vou hoje') || text.includes('faltei')) {
      newStatus = RemoteCheckinStatus.ABSENCE_REPORTED;
      occurrenceType = OccurrenceType.ABSENCE;
      responseOption = '4. Vou faltar';
    } else if (text === '5' || text.includes('atestado') || text.includes('médico') || text.includes('medico')) {
      newStatus = RemoteCheckinStatus.ABSENCE_REPORTED;
      occurrenceType = OccurrenceType.MEDICAL_CERTIFICATE;
      responseOption = '5. Estou de atestado';
    } else {
      newStatus = RemoteCheckinStatus.CONFIRMED;
      responseOption = 'Outro';
    }

    // Geofencing perimeter calculation (Haversine Formula)
    let isOutOfBounds = false;
    if (
      latitude !== undefined &&
      longitude !== undefined &&
      checkin.workSchedule?.latitude &&
      checkin.workSchedule?.longitude
    ) {
      const scheduleLat = checkin.workSchedule.latitude;
      const scheduleLng = checkin.workSchedule.longitude;
      const radiusLimit = checkin.workSchedule.radiusMeters || 200;

      // Distance calculation in meters
      const R = 6371000;
      const dLat = (scheduleLat - latitude) * (Math.PI / 180);
      const dLng = (scheduleLng - longitude) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(latitude * (Math.PI / 180)) *
          Math.cos(scheduleLat * (Math.PI / 180)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance > radiusLimit) {
        isOutOfBounds = true;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let linkedOcc: any = null;

      if (occurrenceType) {
        const titleMap = {
          LATE_ARRIVAL: 'Atraso reportado no Check-in Remoto',
          ABSENCE: 'Falta reportada no Check-in Remoto',
          REMOTE_TECHNICAL_ISSUE: 'Problema técnico no Check-in Remoto',
          MEDICAL_CERTIFICATE: 'Atestado médico informado no Check-in Remoto',
        };
        const title = titleMap[occurrenceType as keyof typeof titleMap] || 'Ocorrência de Presença';

        const description = isOutOfBounds 
          ? `Resposta de check-in: "${message}" (ATENÇÃO: Resposta registrada fora do perímetro geográfico!)`
          : `Resposta de check-in: "${message}"`;

        const { occurrence, isDuplicate } = await OccurrenceService.createOccurrence({
          companyId,
          employeeId,
          type: occurrenceType,
          title: isOutOfBounds ? `[Fora do Posto] ${titleMap[occurrenceType as keyof typeof titleMap] || title}` : titleMap[occurrenceType as keyof typeof titleMap] || title,
          description,
          occurrenceDate: timestamp,
          source: OccurrenceSource.WHATSAPP,
          severity: 'MEDIUM',
          managerUserId: checkin.employee.managerUserId || undefined,
          actorType: 'WHATSAPP',
          metadata: { checkinId: checkin.id, rawMessage: message, timestamp, isOutOfBounds },
        }, tx);

        linkedOcc = occurrence;

        if (!isDuplicate) {
          await tx.occurrenceEvent.create({
            data: {
              companyId,
              occurrenceId: occurrence.id,
              actorType: 'WHATSAPP',
              eventType: 'WHATSAPP_INBOUND_RECEIVED',
              message: `Mensagem recebida via WhatsApp (Inbound Check-in): "${message}"`,
              metadata: {
                checkinId: checkin.id,
                from: checkin.employee.whatsapp,
                message,
                timestamp,
                intent: occurrenceType,
              },
            },
          });
        }
      }

      const updatedCheckin = await tx.remoteCheckin.update({
        where: { id: checkin.id },
        data: {
          status: newStatus,
          respondedAt: new Date(),
          responseOption,
          responseText: message,
          occurrenceId: linkedOcc ? linkedOcc.id : null,
          latitude: latitude !== undefined ? latitude : null,
          longitude: longitude !== undefined ? longitude : null,
          isOutOfBounds,
        },
        include: {
          employee: {
            select: { id: true, fullName: true, sector: true },
          },
          occurrence: {
            select: { id: true, title: true, status: true },
          },
        },
      });

      return { checkin: updatedCheckin, occurrence: linkedOcc };
    });

    // Dispatch manager notification for ABSENCE_REPORTED (fire-and-forget, outside transaction)
    if (result && result.checkin.status === RemoteCheckinStatus.ABSENCE_REPORTED) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { managerUserId: true },
      });
      if (employee?.managerUserId) {
        NotificationCenterService.createOrUpdateByDedupeKey({
          companyId,
          userId: employee.managerUserId,
          role: 'MANAGER',
          type: 'EMPLOYEE_ABSENCE_REPORTED',
          severity: NotificationSeverity.WARNING,
          title: 'Funcionário informou falta via check-in',
          message: `Um funcionário da sua equipe reportou ausência ou atestado no check-in remoto de hoje.`,
          actionUrl: `/app/presence`,
          entityType: 'RemoteCheckin',
          entityId: result.checkin.id,
          dedupeKey: `checkin:${result.checkin.id}:absence-reported`,
          metadata: { checkinId: result.checkin.id, employeeId },
        }).catch(() => {/* silent */});
      }
    }

    return result;
  }

  /**
   * Retrieves summary counts for check-ins today, respecting RBAC visibility.
   */
  static async getSummary(options: {
    companyId: string;
    role: string;
    sub: string;
    date?: string;
    graceMinutes?: number;
  }) {
    const { companyId, role, sub, date, graceMinutes } = options;
    const settings = await CompanySettingsService.getOrCreateSettings(companyId);
    const resolvedGrace = graceMinutes !== undefined ? graceMinutes : settings.defaultCheckinGraceMinutes;
    const localDate = date ? new Date(`${date}T00:00:00.000Z`) : getLocalDateInSaoPaulo();

    const whereClause: any = {
      companyId,
      checkinDate: localDate,
    };

    if (role === 'MANAGER') {
      whereClause.employee = { managerUserId: sub };
    }

    const checkins = await prisma.remoteCheckin.findMany({
      where: whereClause,
    });

    let pending = 0;
    let confirmed = 0;
    let late = 0;
    let absences = 0;
    let issues = 0;
    let notResponded = 0;
    let notRespondedOverdue = 0;

    const cutOff = new Date(Date.now() - resolvedGrace * 60 * 1000);

    checkins.forEach((c) => {
      if (c.status === RemoteCheckinStatus.PENDING) {
        pending++;
        if (c.sentAt <= cutOff) {
          notRespondedOverdue++;
        }
      } else if (c.status === RemoteCheckinStatus.CONFIRMED) {
        confirmed++;
      } else if (c.status === RemoteCheckinStatus.LATE) {
        late++;
      } else if (c.status === RemoteCheckinStatus.ABSENCE_REPORTED) {
        absences++;
      } else if (c.status === RemoteCheckinStatus.ISSUE_REPORTED) {
        issues++;
      } else if (c.status === RemoteCheckinStatus.NOT_RESPONDED) {
        notResponded++;
      }
    });

    const sentToday = checkins.length;
    const respondedCount = confirmed + late + absences + issues;
    const responseRate = sentToday > 0 ? Math.round((respondedCount / sentToday) * 100) : 0;

    return {
      pending,
      confirmed,
      late,
      absences,
      issues,
      notResponded,
      sentToday,
      responseRate,
      notRespondedOverdue,
    };
  }

  /**
   * Lists remote check-ins applying filters and RBAC checks.
   */
  static async listCheckins(options: {
    companyId: string;
    role: string;
    sub: string;
    status?: string;
    employeeId?: string;
    date?: string;
    workModel?: string;
    sector?: string;
    managerUserId?: string;
  }) {
    const { companyId, role, sub, status, employeeId, date, workModel, sector, managerUserId } = options;

    const whereClause: any = { companyId };

    if (role === 'MANAGER') {
      whereClause.employee = { managerUserId: sub };
    } else if (managerUserId) {
      whereClause.employee = { ...whereClause.employee, managerUserId };
    }

    if (status) {
      whereClause.status = status as RemoteCheckinStatus;
    }

    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    if (date) {
      whereClause.checkinDate = new Date(`${date}T00:00:00.000Z`);
    } else {
      whereClause.checkinDate = getLocalDateInSaoPaulo();
    }

    if (workModel) {
      whereClause.employee = { ...whereClause.employee, workModel };
    }

    if (sector) {
      whereClause.employee = { ...whereClause.employee, sector };
    }

    return prisma.remoteCheckin.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { id: true, fullName: true, sector: true, workModel: true },
        },
        occurrence: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
