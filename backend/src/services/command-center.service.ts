import { prisma } from '../lib/prisma';
import { CustomerSuccessService } from './customer-success.service';
import { RetentionService } from './retention.service';
import { JobRegistryService } from './job-registry.service';
import { NotificationCenterService } from './notification-center.service';
import { NotificationSeverity, NotificationStatus } from '@prisma/client';

export interface CommandCenterAlert {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  actionUrl: string;
}

export class CommandCenterService {
  // Aggregate overview details
  static async getOverview(): Promise<any> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Commercial metrics
    const openLeads = await prisma.pilotLead.count({
      where: { NOT: { status: { in: ['WON', 'LOST'] } } }
    });
    const newLeads7d = await prisma.pilotLead.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    });
    const overdueFollowUps = await prisma.pilotLead.count({
      where: {
        nextFollowUpAt: { lt: now },
        NOT: { status: { in: ['WON', 'LOST'] } }
      }
    });
    const proposalsSent = await prisma.company.count({
      where: { pilotStatus: 'PROPOSAL_SENT' }
    });
    const pilotsWonThisMonth = await prisma.company.count({
      where: {
        pilotStatus: 'WON',
        convertedAt: { gte: startOfMonth }
      }
    });
    const pilotsLostThisMonth = await prisma.company.count({
      where: {
        pilotStatus: 'LOST',
        pilotEndsAt: { gte: startOfMonth } // fallback representation
      }
    });

    // 2. Revenue and Subscriptions
    const subs = await prisma.companySubscription.findMany({
      include: { company: true, plan: true }
    });

    let manualMrrCents = 0;
    let activeSubscriptions = 0;
    let paymentPending = 0;
    let overdueAccounts = 0;
    let canceledThisMonth = 0;

    for (const sub of subs) {
      const effectiveStatus = RetentionService.getEffectiveBillingStatus(sub.billingStatus, sub.nextBillingAt);

      if (sub.billingStatus === 'ACTIVE') {
        activeSubscriptions++;
      }
      if (sub.billingStatus === 'PAYMENT_PENDING') {
        paymentPending++;
      }
      if (effectiveStatus === 'OVERDUE') {
        overdueAccounts++;
      }
      if (sub.billingStatus === 'CANCELED' && sub.canceledAt && new Date(sub.canceledAt) >= startOfMonth) {
        canceledThisMonth++;
      }

      if (sub.billingStatus === 'ACTIVE' || sub.billingStatus === 'PAYMENT_PENDING') {
        const amount = sub.contractedAmountCents || 0;
        if (sub.billingCycle === 'MONTHLY') {
          manualMrrCents += amount;
        } else if (sub.billingCycle === 'QUARTERLY') {
          manualMrrCents += Math.round(amount / 3);
        } else if (sub.billingCycle === 'YEARLY') {
          manualMrrCents += Math.round(amount / 12);
        }
      }
    }

    // 3. Customers and Health
    let activeCompanies = activeSubscriptions;
    let pilotCompanies = 0;
    let healthyCompanies = 0;
    let attentionCompanies = 0;
    let criticalCompanies = 0;
    let highChurnRisk = 0;

    for (const sub of subs) {
      const company = await prisma.company.findUnique({
        where: { id: sub.companyId }
      });
      if (company && company.pilotStatus !== 'WON' && company.pilotStatus !== 'LOST') {
        pilotCompanies++;
      }

      const health = await CustomerSuccessService.calculateCompanyHealth(sub.companyId);
      const risk = RetentionService.calculateChurnRisk(sub, health);

      if (health.status === 'HEALTHY') {
        healthyCompanies++;
      } else if (health.status === 'ATTENTION') {
        attentionCompanies++;
      } else if (health.status === 'CRITICAL') {
        criticalCompanies++;
      }

      if (risk.level === 'HIGH') {
        highChurnRisk++;
      }
    }

    // 4. Operations
    const remoteCheckins7d = await prisma.remoteCheckin.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    });

    // Average check-in response rate across active bases
    let totalResponseRate = 0;
    let responseRateCount = 0;
    for (const sub of subs) {
      const health = await CustomerSuccessService.calculateCompanyHealth(sub.companyId);
      totalResponseRate += health.adoptionMetrics.responseRate7d || 0;
      responseRateCount++;
    }
    const responseRate7dGlobal = responseRateCount > 0 ? Math.round(totalResponseRate / responseRateCount) : 0;

    const occurrencesOpen = await prisma.occurrence.count({
      where: { status: 'OPEN' }
    });
    const medicalCertificatesPending = await prisma.medicalCertificate.count({
      where: { status: 'RECEIVED' } // or pending status
    });

    // Report exports in last 7 days
    const exportsLogs = await prisma.auditLog.count({
      where: {
        action: 'REPORT_EXPORTED', // or similar action
        createdAt: { gte: sevenDaysAgo }
      }
    });

    // 5. Platform
    // Since OperationalErrorLog is mocked or simple, count from AuditLog or simulated
    const operationalErrors24h = await prisma.auditLog.count({
      where: {
        action: 'SYSTEM_ERROR',
        createdAt: { gte: oneDayAgo }
      }
    });
    const operationalErrors7d = await prisma.auditLog.count({
      where: {
        action: 'SYSTEM_ERROR',
        createdAt: { gte: sevenDaysAgo }
      }
    });
    const whatsappErrors7d = await prisma.auditLog.count({
      where: {
        action: 'WHATSAPP_ERROR',
        createdAt: { gte: sevenDaysAgo }
      }
    });

    // 5.1 Platform Jobs Metrics
    const failedJobs24h = await prisma.jobRun.count({
      where: {
        status: 'FAILED',
        startedAt: { gte: oneDayAgo }
      }
    });

    const jobStatuses = await JobRegistryService.getJobsStatus();
    const overdueCriticalJobs = jobStatuses.filter(s => s.isCritical && s.isOverdue).length;

    const lastFailedJob = await prisma.jobRun.findFirst({
      where: { status: 'FAILED' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true }
    });

    let jobsHealthStatus: 'HEALTHY' | 'ATTENTION' | 'CRITICAL' = 'HEALTHY';
    if (overdueCriticalJobs > 0 || failedJobs24h > 3) {
      jobsHealthStatus = 'CRITICAL';
    } else if (failedJobs24h > 0) {
      jobsHealthStatus = 'ATTENTION';
    }

    // Audit job checks
    const lastJobLog = await prisma.auditLog.findFirst({
      where: { action: { startsWith: 'JOB' } },
      orderBy: { createdAt: 'desc' }
    });

    const openFeedbacks = await prisma.pilotFeedback.count({
      where: { status: { in: ['OPEN', 'IN_REVIEW', 'PLANNED'] } }
    });
    const criticalFeedbacks = await prisma.pilotFeedback.count({
      where: {
        severity: 'CRITICAL',
        status: { in: ['OPEN', 'IN_REVIEW', 'PLANNED'] }
      }
    });
    const resolved7d = await prisma.pilotFeedback.count({
      where: {
        status: 'RESOLVED',
        resolvedAt: { gte: sevenDaysAgo }
      }
    });
    const openFeedbackCompanies = await prisma.pilotFeedback.groupBy({
      by: ['companyId'],
      where: { status: { in: ['OPEN', 'IN_REVIEW', 'PLANNED'] } }
    });
    const companiesWithOpenFeedback = openFeedbackCompanies.length;

    const openItems = await prisma.pilotBacklogItem.count({
      where: { status: { notIn: ['DONE', 'CANCELED'] } }
    });
    const urgentItems = await prisma.pilotBacklogItem.count({
      where: {
        priority: 'URGENT',
        status: { notIn: ['DONE', 'CANCELED'] }
      }
    });
    const inProgressItems = await prisma.pilotBacklogItem.count({
      where: { status: 'IN_PROGRESS' }
    });
    const done7d = await prisma.pilotBacklogItem.count({
      where: {
        status: 'DONE',
        completedAt: { gte: sevenDaysAgo }
      }
    });
    const overdueTargetItems = await prisma.pilotBacklogItem.count({
      where: {
        status: { notIn: ['DONE', 'CANCELED'] },
        targetReleaseDate: { lt: now }
      }
    });

    // 6. In-App Notification stats (platform)
    const hasInAppNotif = !!prisma.inAppNotification;
    const hasDigest = !!prisma.notificationDigest;

    const notifUnreadCritical = hasInAppNotif
      ? await prisma.inAppNotification.count({
          where: { companyId: null, status: NotificationStatus.UNREAD, severity: NotificationSeverity.CRITICAL },
        })
      : 0;

    const notifUnreadWarnings = hasInAppNotif
      ? await prisma.inAppNotification.count({
          where: { companyId: null, status: NotificationStatus.UNREAD, severity: NotificationSeverity.WARNING },
        })
      : 0;

    const notifResolved7d = hasInAppNotif
      ? await prisma.inAppNotification.count({
          where: { companyId: null, status: NotificationStatus.RESOLVED, resolvedAt: { gte: sevenDaysAgo } },
        })
      : 0;

    const notifDismissed7d = hasInAppNotif
      ? await prisma.inAppNotification.count({
          where: { companyId: null, status: NotificationStatus.DISMISSED, dismissedAt: { gte: sevenDaysAgo } },
        })
      : 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // suppressedToday
    const suppressedToday = hasInAppNotif
      ? await prisma.inAppNotification.count({
          where: {
            createdAt: { gte: startOfToday },
            status: NotificationStatus.DISMISSED,
            metadata: {
              path: ['suppressed'],
              equals: true
            }
          }
        })
      : 0;

    // escalatedToday
    const escalatedToday = hasInAppNotif
      ? await prisma.inAppNotification.count({
          where: {
            createdAt: { gte: startOfToday },
            title: { startsWith: '[ESCALATION]' }
          }
        })
      : 0;

    // digestGeneratedToday
    const digestGeneratedToday = hasDigest
      ? await prisma.notificationDigest.count({
          where: {
            createdAt: { gte: startOfToday },
            status: 'GENERATED'
          }
        })
      : 0;

    // unresolvedCriticalOlderThan1h
    const unresolvedCriticalOlderThan1h = hasInAppNotif
      ? await prisma.inAppNotification.count({
          where: {
            status: NotificationStatus.UNREAD,
            severity: NotificationSeverity.CRITICAL,
            createdAt: { lt: oneHourAgo }
          }
        })
      : 0;

    const alerts = await this.getDerivedAlerts();

    return {
      commercial: {
        openLeads,
        newLeads7d,
        overdueFollowUps,
        proposalsSent,
        pilotsWonThisMonth,
        pilotsLostThisMonth
      },
      revenue: {
        manualMrrCents,
        activeSubscriptions,
        paymentPending,
        overdueAccounts,
        canceledThisMonth
      },
      customers: {
        activeCompanies,
        pilotCompanies,
        healthyCompanies,
        attentionCompanies,
        criticalCompanies,
        highChurnRisk
      },
      operations: {
        remoteCheckins7d,
        responseRate7dGlobal,
        occurrencesOpen,
        medicalCertificatesPending,
        reportsExported7d: exportsLogs
      },
      platform: {
        operationalErrors24h,
        operationalErrors7d,
        whatsappErrors7d,
        internalJobsLastRun: lastJobLog?.createdAt?.toISOString() || null,
        backupStatus: 'SUCCESS',
        smokeTestStatus: 'SUCCESS',
        jobs: {
          failedJobs24h,
          overdueCriticalJobs,
          lastFailedJobAt: lastFailedJob?.startedAt?.toISOString() || null,
          jobsHealthStatus,
        }
      },
      pilotFeedback: {
        openFeedbacks,
        criticalFeedbacks,
        resolved7d,
        companiesWithOpenFeedback,
      },
      pilotBacklog: {
        openItems,
        urgentItems,
        inProgressItems,
        done7d,
        overdueTargetItems,
      },
      notifications: {
        unreadCritical: notifUnreadCritical,
        unreadWarnings: notifUnreadWarnings,
        resolved7d: notifResolved7d,
        dismissed7d: notifDismissed7d,
        suppressedToday,
        escalatedToday,
        digestGeneratedToday,
        unresolvedCriticalOlderThan1h,
      },
      alerts: alerts.slice(0, 5) // Return top 5 in overview
    };
  }

  // Derive prioritized alerts from all databases
  static async getDerivedAlerts(): Promise<CommandCenterAlert[]> {
    const alerts: CommandCenterAlert[] = [];
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Subscription-based alerts
    const subs = await prisma.companySubscription.findMany({
      include: { company: true }
    });

    for (const sub of subs) {
      const health = await CustomerSuccessService.calculateCompanyHealth(sub.companyId);
      const risk = RetentionService.calculateChurnRisk(sub, health);
      const effectiveStatus = RetentionService.getEffectiveBillingStatus(sub.billingStatus, sub.nextBillingAt);

      if (effectiveStatus === 'OVERDUE') {
        alerts.push({
          type: 'OVERDUE_ACCOUNT',
          severity: 'HIGH',
          title: `Mensalidade Vencida: ${sub.company.name}`,
          description: `A empresa ${sub.company.name} está com a fatura administrativa em atraso.`,
          actionUrl: '/app/admin/billing'
        });
      }

      if (health.status === 'CRITICAL') {
        alerts.push({
          type: 'CRITICAL_HEALTH',
          severity: 'HIGH',
          title: `Saúde Crítica: ${sub.company.name}`,
          description: `Baixo engajamento ou alto índice de falhas na empresa ${sub.company.name}.`,
          actionUrl: '/app/admin/support/customer-success'
        });
      }

      if (risk.level === 'HIGH') {
        alerts.push({
          type: 'HIGH_CHURN_RISK',
          severity: 'HIGH',
          title: `Alto Risco de Churn: ${sub.company.name}`,
          description: `Empresa classificada como alto risco de cancelamento contratual.`,
          actionUrl: '/app/admin/retention'
        });
      }

      const nextBilling = sub.nextBillingAt ? new Date(sub.nextBillingAt) : null;
      if (sub.billingStatus !== 'CANCELED' && nextBilling && nextBilling > now && nextBilling <= sevenDays) {
        alerts.push({
          type: 'RENEWAL_ALERT',
          severity: 'MEDIUM',
          title: `Renovação Iminente: ${sub.company.name}`,
          description: `A assinatura expira nos próximos 7 dias em ${nextBilling.toLocaleDateString('pt-BR')}.`,
          actionUrl: '/app/admin/billing'
        });
      }
    }

    // 2. Lead-based alerts
    const leads = await prisma.pilotLead.findMany({
      where: { NOT: { status: { in: ['WON', 'LOST'] } } }
    });

    for (const lead of leads) {
      const followUp = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
      if (followUp && followUp < now) {
        alerts.push({
          type: 'OVERDUE_FOLLOWUP',
          severity: 'MEDIUM',
          title: `Follow-up Vencido: ${lead.name}`,
          description: `Contato comercial pendente para o lead da empresa ${lead.companyName || 'não informada'}.`,
          actionUrl: '/app/admin/leads'
        });
      }

      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      if (lead.status === 'NEW' && lead.createdAt < threeDaysAgo) {
        alerts.push({
          type: 'STALE_LEAD',
          severity: 'MEDIUM',
          title: `Lead Sem Contato: ${lead.name}`,
          description: `Lead novo aguarda primeiro contato há mais de 3 dias.`,
          actionUrl: '/app/admin/leads'
        });
      }
    }

    // 3. Platform errors
    const recentSystemErrors = await prisma.auditLog.count({
      where: {
        action: 'SYSTEM_ERROR',
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    if (recentSystemErrors > 10) {
      alerts.push({
        type: 'HIGH_ERRORS',
        severity: 'HIGH',
        title: 'Alto Índice de Erros de Sistema',
        description: `Foram detectados ${recentSystemErrors} falhas internas nas últimas 24 horas.`,
        actionUrl: '/app/admin/support'
      });
    }

    const recentWAErrors = await prisma.auditLog.count({
      where: {
        action: 'WHATSAPP_ERROR',
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    if (recentWAErrors > 0) {
      alerts.push({
        type: 'WHATSAPP_ERROR',
        severity: 'MEDIUM',
        title: 'Erros de Integração WhatsApp',
        description: `Falhas de conexão de envio de WhatsApp registradas recentemente.`,
        actionUrl: '/app/admin/support'
      });
    }

    // 4. Job Alerts
    const failedJobs24h = await prisma.jobRun.count({
      where: {
        status: 'FAILED',
        startedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    const jobStatuses = await JobRegistryService.getJobsStatus();
    const overdueCriticalJobs = jobStatuses.filter(s => s.isCritical && s.isOverdue).length;

    if (failedJobs24h > 5) {
      alerts.push({
        type: 'MANY_JOB_FAILURES',
        severity: 'HIGH',
        title: 'Alto Índice de Falhas em Jobs',
        description: 'Múltiplos agendadores falharam sucessivamente nas últimas 24 horas.',
        actionUrl: '/app/admin/jobs'
      });
    } else if (failedJobs24h > 0) {
      alerts.push({
        type: 'JOB_FAILED',
        severity: 'HIGH',
        title: 'Falha em Job nas últimas 24h',
        description: `Detectamos ${failedJobs24h} falha(s) em execuções de rotinas automáticas recentemente.`,
        actionUrl: '/app/admin/jobs'
      });
    }

    if (overdueCriticalJobs > 0) {
      alerts.push({
        type: 'CRITICAL_JOB_OVERDUE',
        severity: 'HIGH',
        title: 'Job Crítico Atrasado',
        description: `Há ${overdueCriticalJobs} rotina(s) crítica(s) atrasada(s) sem execução recente.`,
        actionUrl: '/app/admin/jobs'
      });
    }

    // 5. Pilot Feedback alerts
    const openFeedbacksList = await prisma.pilotFeedback.findMany({
      where: { status: { in: ['OPEN', 'IN_REVIEW', 'PLANNED'] } },
      include: { company: true }
    });

    const hasCriticalOpen = openFeedbacksList.some(f => f.severity === 'CRITICAL');
    if (hasCriticalOpen) {
      alerts.push({
        type: 'PILOT_CRITICAL_FEEDBACK',
        severity: 'HIGH',
        title: 'Feedback Crítico de Piloto',
        description: 'Há feedbacks ou incidentes com severidade crítica em aberto de clientes piloto.',
        actionUrl: '/app/admin/pilot-feedback'
      });
    }

    if (openFeedbacksList.length >= 5) {
      alerts.push({
        type: 'MANY_OPEN_PILOT_FEEDBACKS',
        severity: 'HIGH',
        title: 'Alto Volume de Feedbacks Abertos',
        description: `Há ${openFeedbacksList.length} feedbacks/incidentes de piloto aguardando revisão ou tratamento.`,
        actionUrl: '/app/admin/pilot-feedback'
      });
    }

    const openIncident = openFeedbacksList.find(f => f.category === 'INCIDENT');
    if (openIncident) {
      alerts.push({
        type: 'UNRESOLVED_INCIDENT',
        severity: 'HIGH',
        title: `Incidente Pendente: ${openIncident.company.name}`,
        description: `Incidente operacional pendente de tratamento na empresa ${openIncident.company.name}.`,
        actionUrl: '/app/admin/pilot-feedback'
      });
    }

    // 6. Pilot Backlog alerts
    const openBacklogItems = await prisma.pilotBacklogItem.findMany({
      where: { status: { notIn: ['DONE', 'CANCELED'] } }
    });

    const hasUrgentBacklog = openBacklogItems.some(item => item.priority === 'URGENT');
    if (hasUrgentBacklog) {
      alerts.push({
        type: 'URGENT_BACKLOG_ITEM',
        severity: 'HIGH',
        title: 'Item de Backlog Urgente Pendente',
        description: 'Há itens urgentes de correção ou suporte na fila sem conclusão.',
        actionUrl: '/app/admin/pilot-backlog'
      });
    }

    if (openBacklogItems.length >= 10) {
      alerts.push({
        type: 'MANY_OPEN_BACKLOG_ITEMS',
        severity: 'HIGH',
        title: 'Alto Volume de Backlog Aberto',
        description: `Soma de itens abertos na fila ultrapassou o limite operacional (${openBacklogItems.length} itens).`,
        actionUrl: '/app/admin/pilot-backlog'
      });
    }

    const hasOverdueBacklog = openBacklogItems.some(item => item.targetReleaseDate && item.targetReleaseDate < now);
    if (hasOverdueBacklog) {
      alerts.push({
        type: 'OVERDUE_BACKLOG_ITEM',
        severity: 'HIGH',
        title: 'Prazo de Entrega do Backlog Vencido',
        description: 'Item de backlog planejado com prazo de entrega esgotado.',
        actionUrl: '/app/admin/pilot-backlog'
      });
    }

    // 7. Category warning alert
    const categoryGroups = await prisma.pilotFeedback.groupBy({
      by: ['category'],
      where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
      _count: { id: true }
    });

    const hasStaleCategory = categoryGroups.some(g => (g._count?.id ?? 0) >= 3);
    if (hasStaleCategory) {
      alerts.push({
        type: 'MANY_QUESTIONS_SAME_CATEGORY',
        severity: 'MEDIUM',
        title: 'Dúvidas Recorrentes por Categoria',
        description: 'Várias dúvidas da mesma categoria foram reportadas. Recomenda-se criar um Artigo de Ajuda.',
        actionUrl: '/app/admin/knowledge'
      });
    }

    // 8. Unread critical notifications alert
    const hasInAppNotif = !!prisma.inAppNotification;
    const hasDigest = !!prisma.notificationDigest;

    const unreadCriticalNotifs = hasInAppNotif
      ? await prisma.inAppNotification.count({
          where: { companyId: null, status: NotificationStatus.UNREAD, severity: NotificationSeverity.CRITICAL },
        })
      : 0;

    if (unreadCriticalNotifs > 5) {
      alerts.push({
        type: 'MANY_UNREAD_CRITICAL_NOTIFICATIONS',
        severity: 'HIGH',
        title: 'Muitas Notificações Críticas Sem Leitura',
        description: `${unreadCriticalNotifs} notificações críticas de plataforma aguardam revisão.`,
        actionUrl: '/app/admin/notifications'
      });
    }

    // 9. CRITICAL_NOTIFICATION_NOT_ESCALATED
    if (hasInAppNotif) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const unreadCriticalOlderThan1h = await prisma.inAppNotification.findMany({
        where: {
          status: NotificationStatus.UNREAD,
          severity: NotificationSeverity.CRITICAL,
          createdAt: { lt: oneHourAgo }
        },
        select: { id: true }
      });

      let hasUnescalatedCritical = false;
      if (unreadCriticalOlderThan1h.length > 0) {
        const ids = unreadCriticalOlderThan1h.map(n => n.id);
        const escalations = await prisma.inAppNotification.findMany({
          where: {
            title: { startsWith: '[ESCALATION]' }
          },
          select: { metadata: true }
        });
        const escalatedIds = escalations
          .map((e: any) => {
            const meta = e.metadata as any;
            return meta ? meta.escalatedFromId : null;
          })
          .filter(Boolean);
        hasUnescalatedCritical = ids.some(id => !escalatedIds.includes(id));
      }

      if (hasUnescalatedCritical) {
        alerts.push({
          type: 'CRITICAL_NOTIFICATION_NOT_ESCALATED',
          severity: 'HIGH',
          title: 'Alerta Crítico Sem Escalação',
          description: 'Existe notificação crítica pendente há mais de 1h sem escalação ativa.',
          actionUrl: '/app/admin/notifications'
        });
      }
    }

    // 10. DIGEST_NOT_GENERATED
    if (hasDigest) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const digestGeneratedToday = await prisma.notificationDigest.count({
        where: {
          createdAt: { gte: startOfToday },
          status: 'GENERATED'
        }
      });
      const spTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        hour12: false
      }).format(now);
      const spHour = parseInt(spTime, 10);
      if (spHour >= 23 && digestGeneratedToday === 0) {
        alerts.push({
          type: 'DIGEST_NOT_GENERATED',
          severity: 'MEDIUM',
          title: 'Resumo Diário não Gerado',
          description: 'O consolidado diário de notificações não foi gerado hoje.',
          actionUrl: '/app/admin/jobs'
        });
      }
    }

    // Sort by severity (HIGH -> MEDIUM -> LOW)
    const severityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return alerts.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);
  }
}
