import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { NotificationPolicyService } from './notification-policy.service';
import { NotificationEscalationService } from './notification-escalation.service';
import { EVENT_CATALOG, type DomainEventInput } from './notification-engine.types';

export interface ProcessEventResult {
  workflowId: string | null;
  reason?: 'ENGINE_DISABLED' | 'EVENT_NOT_ACTIVE' | 'NO_ACTIVE_POLICY' | 'POLICY_HAS_NO_STEPS' | 'DEDUPLICATED' | 'SUPPRESSED_COOLDOWN';
}

const PRISMA_UNIQUE_VIOLATION = 'P2002';

export class NotificationEngineService {
  /**
   * Entry point for domain events. Only events marked ACTIVE in the event
   * catalog are processed — ACTIVE_LEGACY events remain on their existing
   * ad-hoc path, and RESERVED events are never wired (no confirmed origin).
   */
  static async processDomainEvent(input: DomainEventInput): Promise<ProcessEventResult> {
    if (!config.notificationEngine.enabled) {
      return { workflowId: null, reason: 'ENGINE_DISABLED' };
    }

    const catalogEntry = EVENT_CATALOG[input.eventType];
    if (!catalogEntry || catalogEntry.status !== 'ACTIVE') {
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify({ event: 'NOTIFICATION_ENGINE_EVENT_NOT_ACTIVE', eventType: input.eventType }));
      return { workflowId: null, reason: 'EVENT_NOT_ACTIVE' };
    }

    const deduplicationKey = `${input.eventType}:${input.aggregateType}:${input.aggregateId}`;

    const existing = await prisma.notificationWorkflowInstance.findUnique({
      where: { companyId_deduplicationKey: { companyId: input.companyId, deduplicationKey } },
    });
    if (existing) {
      return { workflowId: existing.id, reason: 'DEDUPLICATED' };
    }

    if (await this.isRecipientCooldownActive(input.companyId, input.eventType)) {
      return { workflowId: null, reason: 'SUPPRESSED_COOLDOWN' };
    }

    const policy = await NotificationPolicyService.findActivePolicy(input.companyId, input.eventType);
    if (!policy) {
      return { workflowId: null, reason: 'NO_ACTIVE_POLICY' };
    }

    const steps = policy.steps.map(NotificationPolicyService.toStepView);
    const firstStep = steps[0];
    if (!firstStep) {
      return { workflowId: null, reason: 'POLICY_HAS_NO_STEPS' };
    }

    const { title, message } = await NotificationEscalationService.renderInitialMessage(
      input.companyId,
      input.eventType,
      firstStep.channels[0],
      input.context,
      input.defaultTitle,
      input.defaultMessage,
    );

    let workflow;
    try {
      workflow = await prisma.notificationWorkflowInstance.create({
        data: {
          companyId: input.companyId,
          policyId: policy.id,
          eventType: input.eventType,
          eventId: input.eventId,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          priority: policy.priority,
          status: 'ACTIVE',
          currentStep: 0,
          acknowledgmentRequired: policy.acknowledgmentRequired,
          deduplicationKey,
          correlationId: input.correlationId,
          payload: { context: input.context, title, message, actionUrl: input.actionUrl ?? null } as any,
        },
      });
    } catch (err: any) {
      // Concurrency: another request created the same (companyId, deduplicationKey)
      // between our findUnique and this create. Never duplicate — return the winner.
      if (err?.code === PRISMA_UNIQUE_VIOLATION) {
        const winner = await prisma.notificationWorkflowInstance.findUnique({
          where: { companyId_deduplicationKey: { companyId: input.companyId, deduplicationKey } },
        });
        return { workflowId: winner?.id ?? null, reason: 'DEDUPLICATED' };
      }
      throw err;
    }

    if (firstStep.delayMinutes === 0) {
      await NotificationEscalationService.executeStep(workflow, steps, policy.quietHoursBehavior, policy.maxEscalationLevel);
    } else {
      await prisma.notificationWorkflowInstance.update({
        where: { id: workflow.id },
        data: { nextActionAt: new Date(Date.now() + firstStep.delayMinutes * 60_000) },
      });
    }

    return { workflowId: workflow.id };
  }

  /**
   * Coarse event-level cooldown (companyId + eventType). Per-recipient
   * cooldown (NOTIFICATION_RECIPIENT_MAX_PER_HOUR) is a finer-grained
   * follow-up; documented as a known simplification in
   * docs/notifications/architecture.md.
   */
  private static async isRecipientCooldownActive(companyId: string, eventType: string): Promise<boolean> {
    const cooldownMinutes = config.notificationEngine.eventCooldownMinutes;
    if (cooldownMinutes <= 0) return false;

    const since = new Date(Date.now() - cooldownMinutes * 60_000);
    const recent = await prisma.notificationWorkflowInstance.count({
      where: { companyId, eventType, createdAt: { gte: since } },
    });
    return recent >= config.notificationEngine.recipientMaxPerHour;
  }
}
