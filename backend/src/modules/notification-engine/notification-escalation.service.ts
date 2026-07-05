import { prisma } from '../../lib/prisma';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationPolicyService } from './notification-policy.service';
import { NotificationTemplateService } from './notification-template.service';
import type { PolicyStepView } from './notification-engine.types';

export interface WorkflowPayload {
  context: Record<string, unknown>;
  title: string;
  message: string;
  actionUrl: string | null;
}

const SCAN_BATCH_LIMIT = 200;

export class NotificationEscalationService {
  /**
   * Executes whichever step is currently due for a workflow, then advances
   * `currentStep`/`nextActionAt`, or marks the workflow EXHAUSTED once the
   * policy's maxEscalationLevel is reached with no further steps.
   */
  static async executeStep(
    workflow: {
      id: string;
      companyId: string;
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
      currentStep: number;
      payload: unknown;
    },
    steps: PolicyStepView[],
    quietHoursBehavior: 'DEFER' | 'ALLOW_HIGH_PRIORITY' | 'IGNORE',
    maxEscalationLevel: number,
  ): Promise<void> {
    const step = steps[workflow.currentStep];
    const payload = (workflow.payload ?? {}) as Partial<WorkflowPayload>;
    const context = payload.context ?? {};

    if (!step || workflow.currentStep >= maxEscalationLevel) {
      await prisma.notificationWorkflowInstance.update({
        where: { id: workflow.id },
        data: { status: 'EXHAUSTED', nextActionAt: null },
      });
      return;
    }

    const title = payload.title ?? workflow.eventType;
    const message = payload.message ?? '';
    const actionUrl = payload.actionUrl ?? null;

    const outcome = await NotificationDispatchService.dispatchStep(
      workflow.id,
      workflow.companyId,
      workflow.eventType,
      workflow.aggregateType,
      workflow.aggregateId,
      workflow.priority,
      quietHoursBehavior,
      step,
      context,
      title,
      message,
      actionUrl,
    );

    if (outcome.deferredUntil) {
      // Quiet hours deferral: keep the same step, just push the clock forward.
      await prisma.notificationWorkflowInstance.update({
        where: { id: workflow.id },
        data: { nextActionAt: outcome.deferredUntil },
      });
      return;
    }

    const nextStepIndex = workflow.currentStep + 1;
    const nextStep = steps[nextStepIndex];
    const hasReachedMaxLevel = nextStepIndex >= maxEscalationLevel;

    if (!nextStep || hasReachedMaxLevel) {
      await prisma.notificationWorkflowInstance.update({
        where: { id: workflow.id },
        data: { status: 'EXHAUSTED', currentStep: nextStepIndex, nextActionAt: null },
      });
      return;
    }

    // delayMinutes is relative to the step that just ran, computed and
    // persisted once here — never recalculated from scratch on later scans.
    const nextActionAt = new Date(Date.now() + nextStep.delayMinutes * 60_000);
    await prisma.notificationWorkflowInstance.update({
      where: { id: workflow.id },
      data: { status: 'ACTIVE', currentStep: nextStepIndex, nextActionAt },
    });
  }

  /**
   * Scheduler-scan entry point (no delayed jobs / BullMQ in this stack): scans
   * ACTIVE workflows whose nextActionAt has passed and advances each one.
   * Meant to be invoked periodically via POST /internal/jobs/notification-workflow-escalations/run.
   */
  static async scanAndAdvance(): Promise<{ evaluated: number; advanced: number; exhausted: number; cancelled: number }> {
    const due = await prisma.notificationWorkflowInstance.findMany({
      where: { status: 'ACTIVE', nextActionAt: { lte: new Date() } },
      take: SCAN_BATCH_LIMIT,
    });

    let advanced = 0;
    let exhausted = 0;
    let cancelled = 0;

    for (const workflow of due) {
      const policy = workflow.policyId
        ? await prisma.notificationPolicy.findUnique({
            where: { id: workflow.policyId },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
          })
        : null;

      if (!policy || !policy.isActive) {
        await prisma.notificationWorkflowInstance.update({
          where: { id: workflow.id },
          data: { status: 'CANCELLED', nextActionAt: null },
        });
        cancelled += 1;
        continue;
      }

      const steps = policy.steps.map(NotificationPolicyService.toStepView);
      const before = workflow.status;
      await this.executeStep(workflow as any, steps, policy.quietHoursBehavior, policy.maxEscalationLevel);
      const after = await prisma.notificationWorkflowInstance.findUnique({ where: { id: workflow.id } });
      if (after?.status === 'EXHAUSTED' && before !== 'EXHAUSTED') exhausted += 1;
      else advanced += 1;
    }

    return { evaluated: due.length, advanced, exhausted, cancelled };
  }

  /** Renders the title/message once at trigger time, to persist into the workflow payload. */
  static async renderInitialMessage(companyId: string, eventType: string, channel: string, context: Record<string, unknown>, fallbackTitle: string, fallbackMessage: string): Promise<{ title: string; message: string }> {
    const template = await NotificationTemplateService.resolve(companyId, eventType, channel);
    if (!template) return { title: fallbackTitle, message: fallbackMessage };
    return {
      title: template.subjectTemplate ? NotificationTemplateService.render(eventType, template.subjectTemplate, context) : fallbackTitle,
      message: NotificationTemplateService.render(eventType, template.bodyTemplate, context) || fallbackMessage,
    };
  }
}
