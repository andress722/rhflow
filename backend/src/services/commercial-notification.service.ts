import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { WhatsAppService } from './whatsapp.service';
import { getSaoPauloDayRange, getSaoPauloMonthRange } from '../lib/date-helpers';

const logger = {
  info: (msg: string, meta?: any) => {
    console.log(JSON.stringify({ level: 'info', msg, ...meta }));
  },
  error: (msg: string, err?: any, meta?: any) => {
    console.error(JSON.stringify({ level: 'error', msg, error: err?.message || err, ...meta }));
  },
  warn: (msg: string, meta?: any) => {
    console.warn(JSON.stringify({ level: 'warn', msg, ...meta }));
  }
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return '***';
  return `${phone.substring(0, 4)}****${phone.substring(phone.length - 4)}`;
}

export function getSaoPauloDateStr(date: Date): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date); // "YYYY-MM-DD"
}

export interface SummaryData {
  newLeadsToday: number;
  overdueFollowUps: number;
  demosToday: number;
  staleQualifiedLeads: number;
}

export class CommercialNotificationService {
  private static getRecipients(): { emails: string[]; phones: string[] } {
    const emails = env.COMMERCIAL_ALERT_EMAILS
      ? env.COMMERCIAL_ALERT_EMAILS.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];
    const phones = env.COMMERCIAL_ALERT_WHATSAPP_NUMBERS
      ? env.COMMERCIAL_ALERT_WHATSAPP_NUMBERS.split(',').map((p: string) => p.trim().replace(/\D/g, '')).filter(Boolean)
      : [];
    return { emails, phones };
  }

  private static async isIdempotent(
    alertType: 'NEW_LEAD' | 'OVERDUE_FOLLOW_UPS' | 'DEMOS_TODAY' | 'STALE_QUALIFIED_LEADS' | 'DAILY_SUMMARY' | 'TEST',
    channel: 'EMAIL' | 'WHATSAPP' | 'SIMULATED',
    dateStr: string,
    leadId?: string
  ): Promise<boolean> {
    if (alertType === 'TEST') {
      return false; // TEST is never idempotent
    }

    const andConditions: any[] = [
      {
        metadata: {
          path: ['alertType'],
          equals: alertType
        }
      },
      {
        metadata: {
          path: ['channel'],
          equals: channel
        }
      }
    ];

    if (alertType === 'NEW_LEAD') {
      if (!leadId) return false;
      andConditions.push({
        metadata: {
          path: ['leadId'],
          equals: leadId
        }
      });
    } else {
      andConditions.push({
        metadata: {
          path: ['date'],
          equals: dateStr
        }
      });
    }

    const existing = await prisma.auditLog.findFirst({
      where: {
        action: 'COMMERCIAL_ALERT_SENT',
        AND: andConditions
      }
    });

    return !!existing;
  }

  private static async recordAuditLog(options: {
    alertType: string;
    channel: 'EMAIL' | 'WHATSAPP' | 'SIMULATED';
    status: 'sent' | 'simulated' | 'failed' | 'skipped';
    leadId?: string;
    count?: number;
    emailRecipientsCount: number;
    whatsappRecipientsCount: number;
  }) {
    try {
      const now = new Date();
      await prisma.auditLog.create({
        data: {
          companyId: 'SYSTEM',
          userId: null,
          action: 'COMMERCIAL_ALERT_SENT',
          entity: 'PilotLead',
          entityId: options.leadId || null,
          metadata: {
            alertType: options.alertType,
            channel: options.channel,
            date: getSaoPauloDateStr(now),
            leadId: options.leadId || null,
            count: options.count ?? null,
            emailRecipientsCount: options.emailRecipientsCount,
            whatsappRecipientsCount: options.whatsappRecipientsCount,
            status: options.status
          }
        }
      });
    } catch (err) {
      logger.error('Failed to write AuditLog for commercial alert', err);
    }
  }

  /**
   * 1. Alert for New Lead
   */
  static async sendNewLeadAlert(lead: any): Promise<{ emailStatus: string; whatsappStatus: string }> {
    const { emails, phones } = this.getRecipients();
    const dateStr = getSaoPauloDateStr(new Date());

    let emailStatus = 'disabled';
    let whatsappStatus = 'disabled';

    // A. EMAIL alert
    if (env.ENABLE_COMMERCIAL_EMAIL_ALERTS) {
      const alreadySent = await this.isIdempotent('NEW_LEAD', 'EMAIL', dateStr, lead.id);
      if (alreadySent) {
        emailStatus = 'skipped';
      } else {
        try {
          // Simulate email sending
          logger.info(`[SIMULATED EMAIL ALERT] Novo Lead: ${lead.name} (${lead.companyName})`, {
            to: emails.map(maskEmail),
            leadId: lead.id,
            email: maskEmail(lead.email),
            whatsapp: lead.whatsapp ? maskPhone(lead.whatsapp) : null
          });
          
          await this.recordAuditLog({
            alertType: 'NEW_LEAD',
            channel: 'SIMULATED',
            status: 'simulated',
            leadId: lead.id,
            emailRecipientsCount: emails.length,
            whatsappRecipientsCount: 0
          });
          emailStatus = 'simulated';
        } catch (err) {
          logger.error('Failed to send new lead email alert', err);
          emailStatus = 'failed';
        }
      }
    }

    // B. WHATSAPP alert
    if (env.ENABLE_COMMERCIAL_WHATSAPP_ALERTS) {
      const alreadySent = await this.isIdempotent('NEW_LEAD', 'WHATSAPP', dateStr, lead.id);
      if (alreadySent) {
        whatsappStatus = 'skipped';
      } else {
        try {
          const appUrl = env.FRONTEND_URL || 'https://presencaflow.com.br';
          const text = `*Novo Lead no PresençaFlow!*
*Nome:* ${lead.name}
*Empresa:* ${lead.companyName}
*E-mail:* ${lead.email}
${lead.whatsapp ? `*WhatsApp:* ${lead.whatsapp}\n` : ''}${lead.employeeCount ? `*Funcionários:* ${lead.employeeCount}\n` : ''}*Dor:* ${lead.mainPain || 'N/A'}
Link: ${appUrl}/app/admin/leads?search=${encodeURIComponent(lead.email)}`;

          // Send WhatsApp messages asynchronously to each recipient
          for (const phone of phones) {
            await WhatsAppService.sendMessage({ to: phone, message: text });
          }

          await this.recordAuditLog({
            alertType: 'NEW_LEAD',
            channel: 'WHATSAPP',
            status: 'sent',
            leadId: lead.id,
            emailRecipientsCount: 0,
            whatsappRecipientsCount: phones.length
          });
          whatsappStatus = 'sent';
        } catch (err) {
          logger.error('Failed to send new lead WhatsApp alert', err);
          whatsappStatus = 'failed';
        }
      }
    }

    return { emailStatus, whatsappStatus };
  }

  /**
   * 2. Alert for Overdue Follow-ups
   */
  static async sendOverdueFollowUpsAlert(count: number): Promise<{ emailStatus: string; whatsappStatus: string }> {
    if (count <= 0) return { emailStatus: 'skipped_zero', whatsappStatus: 'skipped_zero' };

    const { emails, phones } = this.getRecipients();
    const dateStr = getSaoPauloDateStr(new Date());

    let emailStatus = 'disabled';
    let whatsappStatus = 'disabled';

    if (env.ENABLE_COMMERCIAL_EMAIL_ALERTS) {
      const alreadySent = await this.isIdempotent('OVERDUE_FOLLOW_UPS', 'EMAIL', dateStr);
      if (alreadySent) {
        emailStatus = 'skipped';
      } else {
        try {
          logger.info(`[SIMULATED EMAIL ALERT] Alerta de Follow-ups Vencidos: ${count} pendentes`, {
            to: emails.map(maskEmail),
            count
          });
          await this.recordAuditLog({
            alertType: 'OVERDUE_FOLLOW_UPS',
            channel: 'SIMULATED',
            status: 'simulated',
            count,
            emailRecipientsCount: emails.length,
            whatsappRecipientsCount: 0
          });
          emailStatus = 'simulated';
        } catch (err) {
          logger.error('Failed to send overdue follow-ups email alert', err);
          emailStatus = 'failed';
        }
      }
    }

    if (env.ENABLE_COMMERCIAL_WHATSAPP_ALERTS) {
      const alreadySent = await this.isIdempotent('OVERDUE_FOLLOW_UPS', 'WHATSAPP', dateStr);
      if (alreadySent) {
        whatsappStatus = 'skipped';
      } else {
        try {
          const appUrl = env.FRONTEND_URL || 'https://presencaflow.com.br';
          const text = `*Alerta PresençaFlow CRM:* Você possui *${count}* follow-up(s) vencido(s) precisando de atenção.
Acesse o painel: ${appUrl}/app/admin/leads`;

          for (const phone of phones) {
            await WhatsAppService.sendMessage({ to: phone, message: text });
          }

          await this.recordAuditLog({
            alertType: 'OVERDUE_FOLLOW_UPS',
            channel: 'WHATSAPP',
            status: 'sent',
            count,
            emailRecipientsCount: 0,
            whatsappRecipientsCount: phones.length
          });
          whatsappStatus = 'sent';
        } catch (err) {
          logger.error('Failed to send overdue follow-ups WhatsApp alert', err);
          whatsappStatus = 'failed';
        }
      }
    }

    return { emailStatus, whatsappStatus };
  }

  /**
   * 3. Alert for Demos Today
   */
  static async sendDemosTodayAlert(count: number): Promise<{ emailStatus: string; whatsappStatus: string }> {
    if (count <= 0) return { emailStatus: 'skipped_zero', whatsappStatus: 'skipped_zero' };

    const { emails, phones } = this.getRecipients();
    const dateStr = getSaoPauloDateStr(new Date());

    let emailStatus = 'disabled';
    let whatsappStatus = 'disabled';

    if (env.ENABLE_COMMERCIAL_EMAIL_ALERTS) {
      const alreadySent = await this.isIdempotent('DEMOS_TODAY', 'EMAIL', dateStr);
      if (alreadySent) {
        emailStatus = 'skipped';
      } else {
        try {
          logger.info(`[SIMULATED EMAIL ALERT] Alerta de Demos do Dia: ${count} demonstrações agendadas`, {
            to: emails.map(maskEmail),
            count
          });
          await this.recordAuditLog({
            alertType: 'DEMOS_TODAY',
            channel: 'SIMULATED',
            status: 'simulated',
            count,
            emailRecipientsCount: emails.length,
            whatsappRecipientsCount: 0
          });
          emailStatus = 'simulated';
        } catch (err) {
          logger.error('Failed to send demos today email alert', err);
          emailStatus = 'failed';
        }
      }
    }

    if (env.ENABLE_COMMERCIAL_WHATSAPP_ALERTS) {
      const alreadySent = await this.isIdempotent('DEMOS_TODAY', 'WHATSAPP', dateStr);
      if (alreadySent) {
        whatsappStatus = 'skipped';
      } else {
        try {
          const appUrl = env.FRONTEND_URL || 'https://presencaflow.com.br';
          const text = `*Alerta PresençaFlow CRM:* Há *${count}* demonstração(ões) comercial(is) agendada(s) para hoje.
Acesse o painel: ${appUrl}/app/admin/leads`;

          for (const phone of phones) {
            await WhatsAppService.sendMessage({ to: phone, message: text });
          }

          await this.recordAuditLog({
            alertType: 'DEMOS_TODAY',
            channel: 'WHATSAPP',
            status: 'sent',
            count,
            emailRecipientsCount: 0,
            whatsappRecipientsCount: phones.length
          });
          whatsappStatus = 'sent';
        } catch (err) {
          logger.error('Failed to send demos today WhatsApp alert', err);
          whatsappStatus = 'failed';
        }
      }
    }

    return { emailStatus, whatsappStatus };
  }

  /**
   * 4. Alert for Stale Qualified Leads
   */
  static async sendStaleQualifiedAlert(count: number): Promise<{ emailStatus: string; whatsappStatus: string }> {
    if (count <= 0) return { emailStatus: 'skipped_zero', whatsappStatus: 'skipped_zero' };

    const { emails, phones } = this.getRecipients();
    const dateStr = getSaoPauloDateStr(new Date());

    let emailStatus = 'disabled';
    let whatsappStatus = 'disabled';

    if (env.ENABLE_COMMERCIAL_EMAIL_ALERTS) {
      const alreadySent = await this.isIdempotent('STALE_QUALIFIED_LEADS', 'EMAIL', dateStr);
      if (alreadySent) {
        emailStatus = 'skipped';
      } else {
        try {
          logger.info(`[SIMULATED EMAIL ALERT] Alerta de Leads Qualificados Parados: ${count} qualificados sem atividade`, {
            to: emails.map(maskEmail),
            count
          });
          await this.recordAuditLog({
            alertType: 'STALE_QUALIFIED_LEADS',
            channel: 'SIMULATED',
            status: 'simulated',
            count,
            emailRecipientsCount: emails.length,
            whatsappRecipientsCount: 0
          });
          emailStatus = 'simulated';
        } catch (err) {
          logger.error('Failed to send stale qualified email alert', err);
          emailStatus = 'failed';
        }
      }
    }

    if (env.ENABLE_COMMERCIAL_WHATSAPP_ALERTS) {
      const alreadySent = await this.isIdempotent('STALE_QUALIFIED_LEADS', 'WHATSAPP', dateStr);
      if (alreadySent) {
        whatsappStatus = 'skipped';
      } else {
        try {
          const appUrl = env.FRONTEND_URL || 'https://presencaflow.com.br';
          const text = `*Alerta PresençaFlow CRM:* Você possui *${count}* lead(s) qualificado(s) paralisado(s) há mais de 7 dias.
Acesse o painel: ${appUrl}/app/admin/leads`;

          for (const phone of phones) {
            await WhatsAppService.sendMessage({ to: phone, message: text });
          }

          await this.recordAuditLog({
            alertType: 'STALE_QUALIFIED_LEADS',
            channel: 'WHATSAPP',
            status: 'sent',
            count,
            emailRecipientsCount: 0,
            whatsappRecipientsCount: phones.length
          });
          whatsappStatus = 'sent';
        } catch (err) {
          logger.error('Failed to send stale qualified WhatsApp alert', err);
          whatsappStatus = 'failed';
        }
      }
    }

    return { emailStatus, whatsappStatus };
  }

  /**
   * 5. Alert for Daily Summary
   */
  static async sendDailySummaryAlert(summary: SummaryData): Promise<{ emailStatus: string; whatsappStatus: string }> {
    const { emails, phones } = this.getRecipients();
    const dateStr = getSaoPauloDateStr(new Date());

    let emailStatus = 'disabled';
    let whatsappStatus = 'disabled';

    const text = `*Resumo Comercial Diário — PresençaFlow CRM*
- Novos leads hoje: ${summary.newLeadsToday}
- Follow-ups vencidos: ${summary.overdueFollowUps}
- Demonstrações hoje: ${summary.demosToday}
- Leads qualificados parados: ${summary.staleQualifiedLeads}`;

    if (env.ENABLE_COMMERCIAL_EMAIL_ALERTS) {
      const alreadySent = await this.isIdempotent('DAILY_SUMMARY', 'EMAIL', dateStr);
      if (alreadySent) {
        emailStatus = 'skipped';
      } else {
        try {
          logger.info(`[SIMULATED EMAIL ALERT] Resumo Diário Comercial`, {
            to: emails.map(maskEmail),
            summary
          });
          await this.recordAuditLog({
            alertType: 'DAILY_SUMMARY',
            channel: 'SIMULATED',
            status: 'simulated',
            emailRecipientsCount: emails.length,
            whatsappRecipientsCount: 0
          });
          emailStatus = 'simulated';
        } catch (err) {
          logger.error('Failed to send daily summary email alert', err);
          emailStatus = 'failed';
        }
      }
    }

    if (env.ENABLE_COMMERCIAL_WHATSAPP_ALERTS) {
      const alreadySent = await this.isIdempotent('DAILY_SUMMARY', 'WHATSAPP', dateStr);
      if (alreadySent) {
        whatsappStatus = 'skipped';
      } else {
        try {
          for (const phone of phones) {
            await WhatsAppService.sendMessage({ to: phone, message: text });
          }

          await this.recordAuditLog({
            alertType: 'DAILY_SUMMARY',
            channel: 'WHATSAPP',
            status: 'sent',
            emailRecipientsCount: 0,
            whatsappRecipientsCount: phones.length
          });
          whatsappStatus = 'sent';
        } catch (err) {
          logger.error('Failed to send daily summary WhatsApp alert', err);
          whatsappStatus = 'failed';
        }
      }
    }

    return { emailStatus, whatsappStatus };
  }

  /**
   * 6. Test Notification Discharger (Forces send/simulate bypass)
   */
  static async sendTestNotification(): Promise<{ emailStatus: string; whatsappStatus: string }> {
    const { emails, phones } = this.getRecipients();

    let emailStatus = 'disabled';
    let whatsappStatus = 'disabled';

    const text = `[TESTE] PresençaFlow CRM — Notificação comercial de teste disparada com sucesso.`;

    if (env.ENABLE_COMMERCIAL_EMAIL_ALERTS) {
      try {
        logger.info(`[SIMULATED EMAIL ALERT] [TESTE] Alerta de teste`, {
          to: emails.map(maskEmail)
        });
        await this.recordAuditLog({
          alertType: 'TEST',
          channel: 'SIMULATED',
          status: 'simulated',
          emailRecipientsCount: emails.length,
          whatsappRecipientsCount: 0
        });
        emailStatus = 'simulated';
      } catch (err) {
        emailStatus = 'failed';
      }
    }

    if (env.ENABLE_COMMERCIAL_WHATSAPP_ALERTS) {
      try {
        for (const phone of phones) {
          await WhatsAppService.sendMessage({ to: phone, message: text });
        }
        await this.recordAuditLog({
          alertType: 'TEST',
          channel: 'WHATSAPP',
          status: 'sent',
          emailRecipientsCount: 0,
          whatsappRecipientsCount: phones.length
        });
        whatsappStatus = 'sent';
      } catch (err) {
        whatsappStatus = 'failed';
      }
    }

    return { emailStatus, whatsappStatus };
  }
}
