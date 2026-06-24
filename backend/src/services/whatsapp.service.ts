import { prisma } from '../lib/prisma';
import { WhatsAppChannelService } from './whatsapp-channel.service';

export interface SendMessageOptions {
  to: string;
  message: string;
  occurrenceId?: string;
  companyId?: string;
}

export class WhatsAppService {
  /**
   * Legacy wrapper. Redirects to WhatsAppChannelService.sendMessage.
   */
  static async sendMessage(options: SendMessageOptions): Promise<{ success: boolean; messageId: string }> {
    const { to, message, occurrenceId, companyId } = options;

    let resolvedCompanyId = companyId;

    if (!resolvedCompanyId && occurrenceId) {
      const occ = await prisma.occurrence.findUnique({
        where: { id: occurrenceId },
      });
      if (occ) {
        resolvedCompanyId = occ.companyId;
      }
    }

    if (!resolvedCompanyId) {
      // If we still don't have companyId, try to find a company from database or default to something to avoid crash,
      // but usually companyId is always passed or resolvable.
      const firstCompany = await prisma.company.findFirst();
      resolvedCompanyId = firstCompany?.id;
    }

    if (!resolvedCompanyId) {
      return { success: false, messageId: '' };
    }

    const result = await WhatsAppChannelService.sendMessage(resolvedCompanyId, to, message, { occurrenceId });

    if (result.success && occurrenceId) {
      await prisma.occurrenceEvent.create({
        data: {
          companyId: resolvedCompanyId,
          occurrenceId,
          actorType: 'SYSTEM',
          eventType: 'WHATSAPP_OUTBOUND_SENT',
          message: `Mensagem enviada via WhatsApp para ${to}`,
          metadata: {
            messageId: result.messageId,
            recipient: to,
            content: message,
            sentAt: new Date().toISOString(),
          },
        },
      });
    }

    return result;
  }
}
