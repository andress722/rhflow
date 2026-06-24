import { prisma } from '../lib/prisma';
import { Occurrence, OccurrenceType, OccurrenceStatus, OccurrenceSource } from '@prisma/client';

export interface CreateOccurrenceInput {
  companyId: string;
  employeeId: string;
  type: OccurrenceType;
  title: string;
  description?: string;
  occurrenceDate: Date;
  source: OccurrenceSource;
  severity?: string;
  managerUserId?: string;
  actorUserId?: string;
  actorType?: 'USER' | 'SYSTEM' | 'WHATSAPP';
  metadata?: any;
}

export class OccurrenceService {
  /**
   * Centralized occurrence creation.
   * Handles duplicate check for open occurrences of the same type on the same day.
   */
  static async createOccurrence(input: CreateOccurrenceInput, tx?: any): Promise<{ occurrence: Occurrence; isDuplicate: boolean }> {
    const client = tx || prisma;
    const {
      companyId,
      employeeId,
      type,
      title,
      description,
      occurrenceDate,
      source,
      severity = 'LOW',
      managerUserId,
      actorUserId,
      actorType = 'SYSTEM',
      metadata = {},
    } = input;

    // Define same day range
    const startOfDay = new Date(occurrenceDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(occurrenceDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 8. Se já existir ocorrência aberta do mesmo employeeId + type + dia
    const existing = await client.occurrence.findFirst({
      where: {
        companyId,
        employeeId,
        type,
        occurrenceDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: [
            OccurrenceStatus.OPEN,
            OccurrenceStatus.WAITING_EMPLOYEE,
            OccurrenceStatus.WAITING_MANAGER,
            OccurrenceStatus.WAITING_HR,
          ],
        },
      },
    });

    if (existing) {
      // 8. Adicionar novo evento na ocorrência existente e retornar ocorrência existente
      let eventType = 'DUPLICATE_REPORTED';
      let message = 'Nova tentativa de registro duplicado recebida.';

      if (source === OccurrenceSource.WHATSAPP) {
        eventType = 'WHATSAPP_INBOUND_RECEIVED';
        message = `Mensagem recebida via WhatsApp (Inbound): "${description}"`;
      } else if (source === OccurrenceSource.AUTOMATION) {
        // 9. Automação missed-clock-in: adicionar evento AUTOMATION_SKIPPED_DUPLICATE
        eventType = 'AUTOMATION_SKIPPED_DUPLICATE';
        message = 'Automação de ponto não batido ignorada por já existir ocorrência ativa no dia.';
      }

      await client.occurrenceEvent.create({
        data: {
          companyId,
          occurrenceId: existing.id,
          actorType: source === 'WHATSAPP' ? 'WHATSAPP' : 'SYSTEM',
          actorUserId: actorUserId || null,
          eventType,
          message,
          metadata: {
            ...metadata,
            originalSource: source,
            reportedAt: new Date().toISOString(),
          },
        },
      });

      return { occurrence: existing, isDuplicate: true };
    }

    // Otherwise, create a new occurrence
    const occurrence = await client.occurrence.create({
      data: {
        companyId,
        employeeId,
        managerUserId: managerUserId || null,
        type,
        status: OccurrenceStatus.OPEN,
        title,
        description: description || null,
        occurrenceDate,
        source,
        severity,
      },
    });

    // 4. Toda ocorrência criada deve gerar evento inicial OCCURRENCE_CREATED
    await client.occurrenceEvent.create({
      data: {
        companyId,
        occurrenceId: occurrence.id,
        actorType: actorType === 'USER' ? 'USER' : 'SYSTEM',
        actorUserId: actorUserId || null,
        eventType: 'OCCURRENCE_CREATED',
        message: `Ocorrência iniciada via ${source}`,
        metadata: {
          title,
          type,
          source,
          createdAt: new Date().toISOString(),
        },
      },
    });

    return { occurrence, isDuplicate: false };
  }

  /**
   * Centralized status changes.
   * Records STATUS_CHANGED event in timeline.
   */
  static async updateStatus(
    occurrenceId: string,
    companyId: string,
    newStatus: OccurrenceStatus,
    actorUserId: string,
  ): Promise<Occurrence> {
    const occurrence = await prisma.occurrence.findFirst({
      where: { id: occurrenceId, companyId },
    });

    if (!occurrence) {
      throw new Error('Occurrence not found');
    }

    const oldStatus = occurrence.status;

    if (oldStatus === newStatus) {
      return occurrence;
    }

    const updated = await prisma.occurrence.update({
      where: { id: occurrenceId },
      data: {
        status: newStatus,
        resolvedAt: (newStatus === OccurrenceStatus.RESOLVED || newStatus === OccurrenceStatus.REJECTED) ? new Date() : null,
        resolvedByUserId: (newStatus === OccurrenceStatus.RESOLVED || newStatus === OccurrenceStatus.REJECTED) ? actorUserId : null,
      },
    });

    // Create STATUS_CHANGED event
    await prisma.occurrenceEvent.create({
      data: {
        companyId,
        occurrenceId,
        actorType: 'USER',
        actorUserId,
        eventType: 'STATUS_CHANGED',
        message: `Status alterado de ${oldStatus} para ${newStatus}`,
        metadata: {
          oldStatus,
          newStatus,
          changedAt: new Date().toISOString(),
        },
      },
    });

    return updated;
  }

  /**
   * Centralized timeline comment creation.
   * Records COMMENT_ADDED event in timeline.
   */
  static async addComment(
    occurrenceId: string,
    companyId: string,
    comment: string,
    actorUserId: string,
  ) {
    const occurrence = await prisma.occurrence.findFirst({
      where: { id: occurrenceId, companyId },
    });

    if (!occurrence) {
      throw new Error('Occurrence not found');
    }

    const event = await prisma.occurrenceEvent.create({
      data: {
        companyId,
        occurrenceId,
        actorType: 'USER',
        actorUserId,
        eventType: 'COMMENT_ADDED',
        message: comment,
        metadata: {
          comment,
          addedAt: new Date().toISOString(),
        },
      },
    });

    return event;
  }

  /**
   * Verify if a user has access to see/manage a specific occurrence based on role rules.
   */
  static checkAccess(occurrence: any, user: { sub: string; role: string; companyId: string }): boolean {
    if (occurrence.companyId !== user.companyId) {
      return false;
    }

    // MANAGER sees only occurrences of employees they manage
    if (user.role === 'MANAGER') {
      return occurrence.employee?.managerUserId === user.sub;
    }

    return true;
  }
}
