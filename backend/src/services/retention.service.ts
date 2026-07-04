import { prisma } from '../lib/prisma';
import { CustomerSuccessService } from './customer-success.service';
import { env } from '../config/env';
import { WhatsAppService } from './whatsapp.service';
import { NotificationCenterService } from './notification-center.service';
import { NotificationSeverity } from '@prisma/client';

export interface ChurnRiskResult {
  companyId: string;
  companyName: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
  recommendedAction: string;
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

export class RetentionService {
  // Helper to resolve effective status
  static getEffectiveBillingStatus(billingStatus: string, nextBillingAt: Date | null): string {
    if (billingStatus === 'CANCELED') {
      return 'CANCELED';
    }
    if (nextBillingAt && nextBillingAt < new Date() && (billingStatus === 'ACTIVE' || billingStatus === 'PAYMENT_PENDING')) {
      return 'OVERDUE';
    }
    return billingStatus;
  }

  // Churn risk calculation rules
  static calculateChurnRisk(sub: any, healthData: any): ChurnRiskResult {
    const reasons: string[] = [];
    const effectiveStatus = this.getEffectiveBillingStatus(sub.billingStatus, sub.nextBillingAt);
    const now = new Date();

    // 1. HIGH Risk
    if (effectiveStatus === 'CANCELED') {
      reasons.push('Assinatura cancelada administrativamente');
    }
    if (effectiveStatus === 'OVERDUE' && healthData.status === 'CRITICAL') {
      reasons.push('Assinatura vencida com saúde crítica do cliente');
    }

    // Sem atividade recente (últimos 14 dias) e pagamento pendente/vencido
    const lastActivity = healthData.adoptionMetrics.lastActivityAt;
    const lastActivityDate = lastActivity ? new Date(lastActivity) : null;
    const isStale = !lastActivityDate || (now.getTime() - lastActivityDate.getTime()) > 14 * 24 * 60 * 60 * 1000;
    const isPaymentIssue = effectiveStatus === 'PAYMENT_PENDING' || effectiveStatus === 'OVERDUE';
    if (isStale && isPaymentIssue) {
      reasons.push('Sem atividade operacional nos últimos 14 dias e com pendência financeira');
    }

    if (healthData.healthScore < 40) {
      reasons.push(`Score de saúde crítico (${healthData.healthScore}/100)`);
    }

    if (reasons.length > 0) {
      let action = 'Agendar reunião de sucesso';
      if (effectiveStatus === 'CANCELED') {
        action = 'Registrar motivo de cancelamento';
      } else if (effectiveStatus === 'OVERDUE' || effectiveStatus === 'PAYMENT_PENDING') {
        action = 'Cobrar pagamento pendente';
      } else if (healthData.status === 'CRITICAL') {
        action = 'Reativar uso com RH';
      }

      return {
        companyId: sub.companyId,
        companyName: sub.company.name,
        level: 'HIGH',
        reasons,
        recommendedAction: action
      };
    }

    // 2. MEDIUM Risk
    if (healthData.status === 'ATTENTION') {
      reasons.push('Saúde sob atenção (engajamento moderado)');
    }

    // nextBillingAt nos próximos 7 dias e healthScore < 70
    const nextBilling = sub.nextBillingAt ? new Date(sub.nextBillingAt) : null;
    const isRenewalIn7d = nextBilling && nextBilling > now && (nextBilling.getTime() - now.getTime()) <= 7 * 24 * 60 * 60 * 1000;
    if (isRenewalIn7d && healthData.healthScore < 70) {
      reasons.push(`Renovação iminente em 7 dias com health score baixo (${healthData.healthScore}/100)`);
    }

    if (healthData.adoptionMetrics.responseRate7d < 50) {
      reasons.push(`Taxa de resposta de check-ins menor que 50% (${healthData.adoptionMetrics.responseRate7d}%)`);
    }

    const openOccs = healthData.operationalMetrics?.openOccurrences || 0;
    if (openOccs > 5) {
      reasons.push(`Alto volume de ocorrências de ponto em aberto (${openOccs} ocorrências)`);
    }

    if (reasons.length > 0) {
      let action = 'Agendar reunião de sucesso';
      if (isRenewalIn7d) {
        action = 'Preparar renovação';
      } else if (openOccs > 5) {
        action = 'Revisar ocorrências abertas';
      } else if (healthData.adoptionMetrics.responseRate7d < 50) {
        action = 'Reativar uso com RH';
      }

      return {
        companyId: sub.companyId,
        companyName: sub.company.name,
        level: 'MEDIUM',
        reasons,
        recommendedAction: action
      };
    }

    // 3. LOW Risk
    const isRenewalIn30d = nextBilling && nextBilling > now && (nextBilling.getTime() - now.getTime()) <= 30 * 24 * 60 * 60 * 1000;
    return {
      companyId: sub.companyId,
      companyName: sub.company.name,
      level: 'LOW',
      reasons: [],
      recommendedAction: isRenewalIn30d ? 'Preparar renovação' : 'Nenhuma ação recomendada no momento'
    };
  }

  // Idempotency check for batch logs
  static async isIdempotent(alertType: string, channel: 'EMAIL' | 'WHATSAPP', dateStr: string): Promise<boolean> {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'RETENTION_ALERT_SENT'
      }
    });

    for (const log of logs) {
      const meta = log.metadata as any;
      if (meta && meta.alertType === alertType && meta.channel === channel && meta.date === dateStr) {
        return true;
      }
    }
    return false;
  }

  // Run Retention Alerts Job
  static async runRetentionAlertsJob(): Promise<{
    processedCount: number;
    alertsSent: Array<{ alertType: string; channel: string; count: number }>;
  }> {
    const dateStr = getSaoPauloDateStr(new Date());
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const subs = await prisma.companySubscription.findMany({
      include: {
        company: true,
        plan: true
      }
    });

    const overdueList: any[] = [];
    const renewal7dList: any[] = [];
    const criticalList: any[] = [];
    const highRiskList: any[] = [];

    for (const sub of subs) {
      const health = await CustomerSuccessService.calculateCompanyHealth(sub.companyId);
      const risk = this.calculateChurnRisk(sub, health);
      const effectiveStatus = this.getEffectiveBillingStatus(sub.billingStatus, sub.nextBillingAt);

      if (effectiveStatus === 'OVERDUE') {
        overdueList.push(sub.company.name);
        // Platform notification: BILLING_OVERDUE
        NotificationCenterService.createOrUpdateByDedupeKey({
          companyId: null,
          role: null,
          type: 'BILLING_OVERDUE',
          severity: NotificationSeverity.CRITICAL,
          title: 'Fatura vencida',
          message: `A empresa "${sub.company.name}" possui fatura vencida.`,
          actionUrl: `/app/admin/billing`,
          entityType: 'CompanySubscription',
          entityId: sub.companyId,
          dedupeKey: `billing:${sub.companyId}:overdue:${dateStr}`,
          metadata: { companyId: sub.companyId, companyName: sub.company.name },
        }).catch(() => {/* silent */});
      }

      const nextBilling = sub.nextBillingAt ? new Date(sub.nextBillingAt) : null;
      if (sub.billingStatus !== 'CANCELED' && nextBilling && nextBilling > now && nextBilling <= sevenDays) {
        renewal7dList.push(sub.company.name);
        // Platform notification: PILOT_RENEWAL_IMMINENT
        NotificationCenterService.createOrUpdateByDedupeKey({
          companyId: null,
          role: null,
          type: 'PILOT_RENEWAL_IMMINENT',
          severity: NotificationSeverity.WARNING,
          title: 'Renovação próxima',
          message: `A empresa "${sub.company.name}" tem renovação em até 7 dias.`,
          actionUrl: `/app/admin/billing`,
          entityType: 'CompanySubscription',
          entityId: sub.companyId,
          dedupeKey: `billing:${sub.companyId}:renewal-7d:${dateStr}`,
          metadata: { companyId: sub.companyId, companyName: sub.company.name, nextBillingAt: nextBilling?.toISOString() },
        }).catch(() => {/* silent */});
      }

      if (health.status === 'CRITICAL') {
        criticalList.push(sub.company.name);
        // Corporate notification: HEALTH_CRITICAL (for company ADMIN/HR)
        NotificationCenterService.createOrUpdateByDedupeKey({
          companyId: sub.companyId,
          role: 'HR',
          type: 'HEALTH_CRITICAL',
          severity: NotificationSeverity.CRITICAL,
          title: 'Saúde da empresa em estado crítico',
          message: `O índice de saúde da sua empresa está em estado crítico. Ação imediata é recomendada.`,
          actionUrl: `/app/customer-success`,
          entityType: 'Company',
          entityId: sub.companyId,
          dedupeKey: `company:${sub.companyId}:health-critical:${dateStr}`,
          metadata: { companyId: sub.companyId, companyName: sub.company.name },
        }).catch(() => {/* silent */});
      }

      if (risk.level === 'HIGH') {
        highRiskList.push(sub.company.name);
        // Platform notification: HIGH_CHURN_RISK
        NotificationCenterService.createOrUpdateByDedupeKey({
          companyId: null,
          role: null,
          type: 'HIGH_CHURN_RISK',
          severity: NotificationSeverity.WARNING,
          title: 'Risco de churn alto',
          message: `A empresa "${sub.company.name}" apresenta risco de churn alto.`,
          actionUrl: `/app/admin/retention`,
          entityType: 'CompanySubscription',
          entityId: sub.companyId,
          dedupeKey: `billing:${sub.companyId}:high-churn:${dateStr}`,
          metadata: { companyId: sub.companyId, companyName: sub.company.name },
        }).catch(() => {/* silent */});
      }

      // Platform notification: COMPANY_INACTIVE_7D
      const lastAct = health.adoptionMetrics.lastActivityAt;
      const lastActDate = lastAct ? new Date(lastAct) : null;
      const isInactive7d = !lastActDate || (now.getTime() - lastActDate.getTime()) > 7 * 24 * 60 * 60 * 1000;
      if (isInactive7d) {
        NotificationCenterService.createOrUpdateByDedupeKey({
          companyId: null,
          role: null,
          type: 'COMPANY_INACTIVE_7D',
          severity: NotificationSeverity.WARNING,
          title: 'Empresa inativa há 7 dias',
          message: `A empresa "${sub.company.name}" não apresentou nenhuma atividade nos últimos 7 dias.`,
          actionUrl: `/app/admin/companies`,
          entityType: 'Company',
          entityId: sub.companyId,
          dedupeKey: `company:${sub.companyId}:inactive-7d:${dateStr}`,
          metadata: { companyId: sub.companyId, companyName: sub.company.name, lastActivityAt: lastAct },
        }).catch(() => {/* silent */});
      }
    }

    const alertCategories = [
      { type: 'OVERDUE_ACCOUNTS', list: overdueList, desc: 'Contas Vencidas' },
      { type: 'RENEWALS_7D', list: renewal7dList, desc: 'Renovações em 7 Dias' },
      { type: 'CRITICAL_HEALTH', list: criticalList, desc: 'Clientes com Saúde Crítica' },
      { type: 'HIGH_CHURN_RISK', list: highRiskList, desc: 'Contas com Risco de Churn Alto' },
    ];

    const recipientsEmails = env.COMMERCIAL_ALERT_EMAILS
      ? env.COMMERCIAL_ALERT_EMAILS.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];
    const recipientsPhones = env.COMMERCIAL_ALERT_WHATSAPP_NUMBERS
      ? env.COMMERCIAL_ALERT_WHATSAPP_NUMBERS.split(',').map((p: string) => p.trim().replace(/\D/g, '')).filter(Boolean)
      : [];

    const alertsSent: Array<{ alertType: string; channel: string; count: number }> = [];

    for (const cat of alertCategories) {
      if (cat.list.length === 0) continue;

      // 1. Email Alert
      const isEmailDone = await this.isIdempotent(cat.type, 'EMAIL', dateStr);
      if (!isEmailDone && recipientsEmails.length > 0) {
        console.log(JSON.stringify({
          level: 'info',
          msg: `[SIMULATED EMAIL ALERT] Alerta de Retenção - ${cat.desc}: ${cat.list.join(', ')}`,
          to: recipientsEmails,
          count: cat.list.length
        }));

        await prisma.auditLog.create({
          data: {
            companyId: subs[0]?.companyId || 'global-admin',
            action: 'RETENTION_ALERT_SENT',
            entity: 'CompanySubscription',
            metadata: {
              alertType: cat.type,
              channel: 'EMAIL',
              date: dateStr,
              companies: cat.list
            }
          }
        });

        alertsSent.push({ alertType: cat.type, channel: 'EMAIL', count: cat.list.length });
      }

      // 2. WhatsApp Alert
      const isWADone = await this.isIdempotent(cat.type, 'WHATSAPP', dateStr);
      if (!isWADone && recipientsPhones.length > 0) {
        const text = `[Alerta de Retenção] ${cat.desc}:\n${cat.list.map((name, i) => `${i + 1}. ${name}`).join('\n')}`;
        for (const phone of recipientsPhones) {
          try {
            await WhatsAppService.sendMessage({ to: phone, message: text });
          } catch (err: any) {
            console.error(`Failed to send retention alert to ${phone}:`, err.message);
          }
        }

        await prisma.auditLog.create({
          data: {
            companyId: subs[0]?.companyId || 'global-admin',
            action: 'RETENTION_ALERT_SENT',
            entity: 'CompanySubscription',
            metadata: {
              alertType: cat.type,
              channel: 'WHATSAPP',
              date: dateStr,
              companies: cat.list
            }
          }
        });

        alertsSent.push({ alertType: cat.type, channel: 'WHATSAPP', count: cat.list.length });
      }
    }

    return {
      processedCount: subs.length,
      alertsSent
    };
  }
}
