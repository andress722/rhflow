import { prisma } from '../../lib/prisma';

export interface AckResult {
  ok: boolean;
  alreadyTerminal?: boolean;
  error?: 'NOT_FOUND' | 'FORBIDDEN';
}

const ADMIN_ROLES = new Set(['ADMIN', 'HR', 'SUPER_ADMIN']);

export class NotificationAcknowledgmentService {
  /** A user may act on a workflow if it is one of its own tenant's, and either they are an administrative role or they were a resolved recipient of one of its delivery attempts. */
  static async canActOn(workflowId: string, companyId: string, userId: string, role: string): Promise<boolean> {
    if (ADMIN_ROLES.has(role)) return true;
    const attempt = await prisma.notificationDeliveryAttempt.findFirst({
      where: { workflowInstanceId: workflowId, companyId, recipientUserId: userId },
    });
    return Boolean(attempt);
  }

  static async acknowledge(workflowId: string, companyId: string, userId: string, role: string): Promise<AckResult> {
    const workflow = await prisma.notificationWorkflowInstance.findFirst({ where: { id: workflowId, companyId } });
    if (!workflow) return { ok: false, error: 'NOT_FOUND' };

    if (!(await this.canActOn(workflowId, companyId, userId, role))) {
      return { ok: false, error: 'FORBIDDEN' };
    }

    // Idempotent: already acknowledged, or already terminal — no-op success.
    if (workflow.acknowledgedAt || workflow.status === 'RESOLVED' || workflow.status === 'CANCELLED' || workflow.status === 'EXHAUSTED') {
      return { ok: true, alreadyTerminal: true };
    }

    const policy = workflow.policyId
      ? await prisma.notificationPolicy.findUnique({ where: { id: workflow.policyId }, include: { steps: { orderBy: { stepOrder: 'asc' } } } })
      : null;
    const currentStepDef = policy?.steps[workflow.currentStep];
    // ACK does not imply RESOLVED. stopOnAcknowledgment on the current step
    // decides whether escalation halts (status ACKNOWLEDGED, no further
    // steps) or continues running in the background despite the ACK.
    const shouldStopEscalation = currentStepDef ? currentStepDef.stopOnAcknowledgment : true;

    await prisma.notificationWorkflowInstance.update({
      where: { id: workflowId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
        status: shouldStopEscalation ? 'ACKNOWLEDGED' : workflow.status,
        nextActionAt: shouldStopEscalation ? null : workflow.nextActionAt,
      },
    });

    return { ok: true };
  }

  static async resolve(workflowId: string, companyId: string, userId: string, role: string, reasonCode: string, notes?: string): Promise<AckResult> {
    const workflow = await prisma.notificationWorkflowInstance.findFirst({ where: { id: workflowId, companyId } });
    if (!workflow) return { ok: false, error: 'NOT_FOUND' };

    if (!(await this.canActOn(workflowId, companyId, userId, role))) {
      return { ok: false, error: 'FORBIDDEN' };
    }

    // Idempotent: resolving an already-resolved/cancelled workflow is a no-op success.
    if (workflow.status === 'RESOLVED' || workflow.status === 'CANCELLED') {
      return { ok: true, alreadyTerminal: true };
    }

    // RESOLVED always halts escalation, regardless of any step's stopOnAcknowledgment.
    await prisma.notificationWorkflowInstance.update({
      where: { id: workflowId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionReason: notes ? `${reasonCode}: ${notes}` : reasonCode,
        nextActionAt: null,
      },
    });

    return { ok: true };
  }

  static async cancel(workflowId: string, companyId: string, userId: string, role: string, reason?: string): Promise<AckResult> {
    const workflow = await prisma.notificationWorkflowInstance.findFirst({ where: { id: workflowId, companyId } });
    if (!workflow) return { ok: false, error: 'NOT_FOUND' };

    if (!(await this.canActOn(workflowId, companyId, userId, role))) {
      return { ok: false, error: 'FORBIDDEN' };
    }

    if (workflow.status === 'CANCELLED' || workflow.status === 'RESOLVED') {
      return { ok: true, alreadyTerminal: true };
    }

    await prisma.notificationWorkflowInstance.update({
      where: { id: workflowId },
      data: { status: 'CANCELLED', resolutionReason: reason ?? null, nextActionAt: null },
    });

    return { ok: true };
  }
}
