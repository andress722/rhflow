import { prisma } from '../lib/prisma';

export class CompanySettingsService {
  /**
   * Fetches settings for the company, creating them with default values if they don't exist.
   */
  static async getOrCreateSettings(companyId: string) {
    let settings = await prisma.companySettings.findUnique({
      where: { companyId },
    });

    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          companyId,
          defaultCheckinGraceMinutes: 30,
          allowManagerExport: true,
          allowViewerReports: true,
          enableRemoteCheckin: true,
          enableBatchCheckin: true,
          enableMedicalCertificates: true,
        },
      });
    }

    return settings;
  }

  /**
   * Updates settings for a company. Ignores read-only fields.
   * Generates AuditLog only if there's a real change.
   */
  static async updateSettings(companyId: string, payload: any, userId: string) {
    const before = await this.getOrCreateSettings(companyId);

    // Filter out forbidden fields: id, companyId, createdAt, updatedAt
    const { id, companyId: cId, createdAt, updatedAt, ...allowedPayload } = payload;

    // Check if there is any real change
    let hasChanges = false;
    const updateData: any = {};

    const fieldsToCompare = [
      'defaultCheckinGraceMinutes',
      'defaultCheckinSendTime',
      'allowManagerExport',
      'allowViewerReports',
      'enableRemoteCheckin',
      'enableBatchCheckin',
      'enableMedicalCertificates',
      'whatsappCheckinMessage',
      'whatsappNotRespondedMessage',
      'whatsappManagerAlertMessage',
    ];

    for (const field of fieldsToCompare) {
      if (allowedPayload[field] !== undefined) {
        const valBefore = (before as any)[field];
        const valAfter = allowedPayload[field];

        // Strict comparison (null vs undefined or different values)
        if (valBefore !== valAfter) {
          hasChanges = true;
        }
        updateData[field] = valAfter;
      }
    }

    if (!hasChanges) {
      return before; // Return without DB write or AuditLog if no changes
    }

    const updated = await prisma.companySettings.update({
      where: { companyId },
      data: updateData,
    });

    // Generate AuditLog COMPANY_SETTINGS_UPDATED with metadata before & after
    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'COMPANY_SETTINGS_UPDATED',
        entity: 'CompanySettings',
        entityId: updated.id,
        metadata: {
          before: {
            defaultCheckinGraceMinutes: before.defaultCheckinGraceMinutes,
            defaultCheckinSendTime: before.defaultCheckinSendTime,
            allowManagerExport: before.allowManagerExport,
            allowViewerReports: before.allowViewerReports,
            enableRemoteCheckin: before.enableRemoteCheckin,
            enableBatchCheckin: before.enableBatchCheckin,
            enableMedicalCertificates: before.enableMedicalCertificates,
            whatsappCheckinMessage: before.whatsappCheckinMessage,
            whatsappNotRespondedMessage: before.whatsappNotRespondedMessage,
            whatsappManagerAlertMessage: before.whatsappManagerAlertMessage,
          },
          after: {
            defaultCheckinGraceMinutes: updated.defaultCheckinGraceMinutes,
            defaultCheckinSendTime: updated.defaultCheckinSendTime,
            allowManagerExport: updated.allowManagerExport,
            allowViewerReports: updated.allowViewerReports,
            enableRemoteCheckin: updated.enableRemoteCheckin,
            enableBatchCheckin: updated.enableBatchCheckin,
            enableMedicalCertificates: updated.enableMedicalCertificates,
            whatsappCheckinMessage: updated.whatsappCheckinMessage,
            whatsappNotRespondedMessage: updated.whatsappNotRespondedMessage,
            whatsappManagerAlertMessage: updated.whatsappManagerAlertMessage,
          },
        },
      },
    });

    return updated;
  }
}
