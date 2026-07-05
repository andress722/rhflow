import { prisma } from '../../lib/prisma';
import { VALID_ROLES_FOR_ROLE_RECIPIENT } from './notification-engine.schemas';
import type { PolicyStepView } from './notification-engine.types';

export interface PolicyStepInput {
  stepOrder: number;
  delayMinutes: number;
  recipientType: string;
  recipientReference?: string | null;
  channels: string[];
  fallbackMode: 'PARALLEL' | 'SEQUENTIAL';
  stopOnAcknowledgment: boolean;
  stopOnResolution: boolean;
}

export class NotificationPolicyService {
  /** Deep validation that requires DB access (shape-only rules already live in the zod schema). */
  static async validateSteps(companyId: string, steps: PolicyStepInput[]): Promise<string[]> {
    const errors: string[] = [];

    for (const step of steps) {
      if (step.recipientType === 'SPECIFIC_USER' && step.recipientReference) {
        const user = await prisma.user.findFirst({ where: { id: step.recipientReference, companyId } });
        if (!user) {
          errors.push(`Step ${step.stepOrder}: recipientReference (${step.recipientReference}) não corresponde a um usuário desta empresa.`);
        }
      }
      if (step.recipientType === 'ROLE' && step.recipientReference) {
        if (!(VALID_ROLES_FOR_ROLE_RECIPIENT as readonly string[]).includes(step.recipientReference)) {
          errors.push(`Step ${step.stepOrder}: role "${step.recipientReference}" inválida.`);
        }
      }
    }

    return errors;
  }

  /** Returns the active policy for (companyId, eventType), or null if none is configured/active. */
  static async findActivePolicy(companyId: string, eventType: string) {
    return prisma.notificationPolicy.findFirst({
      where: { companyId, eventType, isActive: true },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  static toStepView(step: { id: string; stepOrder: number; delayMinutes: number; recipientType: any; recipientReference: string | null; channels: any; fallbackMode: any; stopOnAcknowledgment: boolean; stopOnResolution: boolean }): PolicyStepView {
    return {
      id: step.id,
      stepOrder: step.stepOrder,
      delayMinutes: step.delayMinutes,
      recipientType: step.recipientType,
      recipientReference: step.recipientReference,
      channels: Array.isArray(step.channels) ? (step.channels as string[]) : [],
      fallbackMode: step.fallbackMode,
      stopOnAcknowledgment: step.stopOnAcknowledgment,
      stopOnResolution: step.stopOnResolution,
    };
  }
}
