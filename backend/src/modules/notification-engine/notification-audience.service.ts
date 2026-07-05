import { prisma } from '../../lib/prisma';
import { NotificationRecipientType } from '@prisma/client';
import type { ResolvedRecipient } from './notification-engine.types';

export class NotificationAudienceService {
  /**
   * Resolves the concrete recipient(s) for a policy step's recipientType.
   * Never throws for an unresolvable recipient: returns an entry with
   * `skipReasonCode` set instead, so the caller can record a SKIPPED
   * delivery attempt with an explicit reason rather than silently dropping it.
   */
  static async resolve(
    companyId: string,
    recipientType: NotificationRecipientType,
    recipientReference: string | null,
    context: Record<string, unknown>,
  ): Promise<ResolvedRecipient[]> {
    switch (recipientType) {
      case 'EMPLOYEE':
        return this.resolveEmployee(companyId, context);
      case 'DIRECT_MANAGER':
        return this.resolveDirectManager(companyId, context);
      case 'HR':
        return this.resolveByRole(companyId, 'HR');
      case 'ADMIN':
        return this.resolveByRole(companyId, 'ADMIN');
      case 'ROLE':
        if (!recipientReference) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];
        return this.resolveByRole(companyId, recipientReference);
      case 'SPECIFIC_USER':
        return this.resolveSpecificUser(companyId, recipientReference);
      case 'REQUESTER':
        return this.resolveFromContext(context, 'requesterUserId');
      case 'EVENT_ACTOR':
        return this.resolveFromContext(context, 'actorUserId');
      default:
        return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];
    }
  }

  private static async resolveEmployee(companyId: string, context: Record<string, unknown>): Promise<ResolvedRecipient[]> {
    const employeeId = context.employeeId as string | undefined;
    if (!employeeId) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];

    const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];

    // Employees don't have a direct FK to User; the Employee Portal links
    // them by matching email within the same company (see employee-portal.ts).
    let linkedUserId: string | null = null;
    if (employee.email) {
      const linkedUser = await prisma.user.findFirst({ where: { companyId, email: employee.email, isActive: true } });
      linkedUserId = linkedUser?.id ?? null;
    }

    return [{ recipientUserId: linkedUserId, recipientEmployeeId: employee.id }];
  }

  private static async resolveDirectManager(companyId: string, context: Record<string, unknown>): Promise<ResolvedRecipient[]> {
    const employeeId = context.employeeId as string | undefined;
    if (!employeeId) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];

    const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee?.managerUserId) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];

    const manager = await prisma.user.findFirst({ where: { id: employee.managerUserId, companyId, isActive: true } });
    if (!manager) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];

    return [{ recipientUserId: manager.id, recipientEmployeeId: null }];
  }

  private static async resolveByRole(companyId: string, role: string): Promise<ResolvedRecipient[]> {
    const users = await prisma.user.findMany({ where: { companyId, role: role as any, isActive: true } });
    if (users.length === 0) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];
    return users.map((u) => ({ recipientUserId: u.id, recipientEmployeeId: null }));
  }

  private static async resolveSpecificUser(companyId: string, recipientReference: string | null): Promise<ResolvedRecipient[]> {
    if (!recipientReference) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];

    // Same-company enforcement is mandatory: never resolve a user from another tenant.
    const user = await prisma.user.findFirst({ where: { id: recipientReference, companyId, isActive: true } });
    if (!user) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];

    return [{ recipientUserId: user.id, recipientEmployeeId: null }];
  }

  private static resolveFromContext(context: Record<string, unknown>, key: string): ResolvedRecipient[] {
    const userId = context[key] as string | undefined;
    if (!userId) return [{ recipientUserId: null, recipientEmployeeId: null, skipReasonCode: 'NOTIFICATION_RECIPIENT_NOT_FOUND' }];
    return [{ recipientUserId: userId, recipientEmployeeId: null }];
  }
}
