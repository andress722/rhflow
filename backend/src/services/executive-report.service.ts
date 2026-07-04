import { prisma } from '../lib/prisma';
import { NotificationSeverity, NotificationStatus, OccurrenceStatus, MedicalCertificateStatus, PilotFeedbackStatus, PilotBacklogStatus } from '@prisma/client';

export class ExecutiveReportService {
  /**
   * Helper to format a date to YYYY-MM-DD
   */
  private static formatDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculates health score for a specific window
   */
  private static async calculateHealthScoreForWindow(companyId: string, start: Date, end: Date): Promise<number> {
    const [
      activeEmployees,
      remoteCheckinsSent,
      remoteCheckinsResponded,
      reportsViewedOrExported,
      openOccurrences,
      occurrencesResolved,
      medicalCertificatesUploaded,
      medicalCertificatesReviewed,
      whatsappErrors,
      operationalErrors,
      companySettings,
      whatsappChannel,
      schedulesCount,
      adminCount
    ] = await Promise.all([
      prisma.employee ? prisma.employee.count({ where: { companyId, status: 'ACTIVE', createdAt: { lt: end } } }) : Promise.resolve(0),
      prisma.remoteCheckin ? prisma.remoteCheckin.count({ where: { companyId, createdAt: { gte: start, lte: end } } }) : Promise.resolve(0),
      prisma.remoteCheckin ? prisma.remoteCheckin.count({ where: { companyId, createdAt: { gte: start, lte: end }, respondedAt: { not: null } } }) : Promise.resolve(0),
      prisma.auditLog ? prisma.auditLog.count({
        where: {
          companyId,
          action: { in: ['REPORT_VIEWED', 'REPORT_EXPORTED', 'EXPORT_CREATED'] },
          createdAt: { gte: start, lte: end }
        }
      }) : Promise.resolve(0),
      prisma.occurrence ? prisma.occurrence.count({ where: { companyId, status: 'OPEN', createdAt: { lt: end } } }) : Promise.resolve(0),
      prisma.occurrence ? prisma.occurrence.count({ where: { companyId, status: 'RESOLVED', resolvedAt: { gte: start, lte: end } } }) : Promise.resolve(0),
      prisma.medicalCertificate ? prisma.medicalCertificate.count({ where: { companyId, createdAt: { gte: start, lte: end } } }) : Promise.resolve(0),
      prisma.medicalCertificate ? prisma.medicalCertificate.count({ where: { companyId, status: { in: ['APPROVED', 'REJECTED'] }, updatedAt: { gte: start, lte: end } } }) : Promise.resolve(0),
      prisma.whatsAppMessageLog ? prisma.whatsAppMessageLog.count({ where: { companyId, status: 'FAILED', createdAt: { gte: start, lte: end } } }) : Promise.resolve(0),
      prisma.operationalErrorLog ? prisma.operationalErrorLog.count({ where: { companyId, createdAt: { gte: start, lte: end } } }) : Promise.resolve(0),
      prisma.companySettings ? prisma.companySettings.findUnique({ where: { companyId } }) : Promise.resolve(null),
      prisma.whatsAppChannel ? prisma.whatsAppChannel.findUnique({ where: { companyId } }) : Promise.resolve(null),
      prisma.workSchedule ? prisma.workSchedule.count({ where: { companyId, isActive: true, createdAt: { lt: end } } }) : Promise.resolve(0),
      prisma.user ? prisma.user.count({ where: { companyId, role: 'ADMIN', isActive: true, createdAt: { lt: end } } }) : Promise.resolve(0)
    ]);

    const responseRate = remoteCheckinsSent > 0 ? (remoteCheckinsResponded / remoteCheckinsSent) * 100 : 0;

    let adoptionScore = 0;
    if (activeEmployees > 0) adoptionScore += 15;
    const enableRemoteCheckin = companySettings?.enableRemoteCheckin ?? true;
    if (enableRemoteCheckin) {
      if (remoteCheckinsSent > 0) adoptionScore += 15;
    } else {
      adoptionScore += 15;
    }
    // Hardcode activity points for period
    adoptionScore += 10;

    let responseScore = 0;
    if (enableRemoteCheckin) {
      if (responseRate >= 75) responseScore = 25;
      else if (responseRate >= 50) responseScore = 15;
      else if (responseRate >= 25) responseScore = 8;
    } else {
      responseScore = 25;
    }

    let errorScore = 0;
    const isWhatsappHealthy = whatsappChannel && (whatsappChannel.status === 'CONNECTED' || whatsappChannel.status === 'SIMULATION' || whatsappChannel.provider === 'SIMULATED');
    if (isWhatsappHealthy) errorScore += 10;
    if (whatsappErrors === 0) errorScore += 5;
    else if (whatsappErrors <= 5) errorScore += 3;
    if (operationalErrors === 0) errorScore += 5;
    else if (operationalErrors <= 5) errorScore += 3;

    let managementScore = 0;
    if (reportsViewedOrExported > 0) managementScore += 5;
    if (openOccurrences === 0 || occurrencesResolved > 0) managementScore += 5;
    const isMedicalEnabled = companySettings?.enableMedicalCertificates ?? true;
    if (!isMedicalEnabled) {
      managementScore += 5;
    } else {
      const pendingCount = await prisma.medicalCertificate.count({ where: { companyId, status: 'RECEIVED', createdAt: { lt: end } } });
      if (pendingCount === 0 || medicalCertificatesReviewed > 0) managementScore += 5;
    }

    return Math.min(100, adoptionScore + responseScore + errorScore + managementScore);
  }

  /**
   * Generates the consolidated executive report data and markdown
   */
  static async generateReport(companyId: string, fromDate: Date, toDate: Date, isCorporate: boolean) {
    // 1. Fetch Company Info
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        legalName: true,
        pilotStatus: true,
        pilotStartedAt: true,
        pilotEndsAt: true,
        proposalSentAt: true,
        convertedAt: true,
        commercialNotes: isCorporate ? undefined : true,
      }
    });

    if (!company) {
      throw new Error('Empresa não encontrada.');
    }

    if (isCorporate) {
      delete (company as any).commercialNotes;
    }

    // 2. Query Adoption Metrics
    const [
      activeEmployees,
      totalCheckinsSent,
      totalCheckinsResponded,
      reportsExported
    ] = await Promise.all([
      prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.remoteCheckin.count({ where: { companyId, sentAt: { gte: fromDate, lte: toDate } } }),
      prisma.remoteCheckin.count({ where: { companyId, sentAt: { gte: fromDate, lte: toDate }, respondedAt: { not: null } } }),
      prisma.auditLog.count({
        where: {
          companyId,
          action: { in: ['REPORT_VIEWED', 'REPORT_EXPORTED', 'EXPORT_CREATED'] },
          createdAt: { gte: fromDate, lte: toDate }
        }
      })
    ]);

    const checkinResponseRate = totalCheckinsSent > 0
      ? Math.round((totalCheckinsResponded / totalCheckinsSent) * 100)
      : 0;

    // 3. Query Operational Metrics
    const [
      occurrencesCreated,
      occurrencesResolved,
      openOccurrences,
      certificatesUploaded,
      certificatesReviewed
    ] = await Promise.all([
      prisma.occurrence.count({ where: { companyId, createdAt: { gte: fromDate, lte: toDate } } }),
      prisma.occurrence.count({ where: { companyId, status: OccurrenceStatus.RESOLVED, resolvedAt: { gte: fromDate, lte: toDate } } }),
      prisma.occurrence.count({ where: { companyId, status: OccurrenceStatus.OPEN } }),
      prisma.medicalCertificate.count({ where: { companyId, createdAt: { gte: fromDate, lte: toDate } } }),
      prisma.medicalCertificate.count({ where: { companyId, status: { in: [MedicalCertificateStatus.APPROVED, MedicalCertificateStatus.REJECTED] }, updatedAt: { gte: fromDate, lte: toDate } } })
    ]);

    // 4. Query Health Scores (Initial vs Final)
    const initialWindowEnd = new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const healthScoreInitial = await this.calculateHealthScoreForWindow(companyId, fromDate, initialWindowEnd);
    const healthScoreFinal = await this.calculateHealthScoreForWindow(companyId, new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000), toDate);

    // 5. Query Customer Success, Feedback & Backlog
    const [
      feedbacksReceived,
      feedbacksResolved,
      backlogDeliveredRaw,
      criticalNotificationsTreated
    ] = await Promise.all([
      prisma.pilotFeedback.count({ where: { companyId, createdAt: { gte: fromDate, lte: toDate } } }),
      prisma.pilotFeedback.count({ where: { companyId, status: PilotFeedbackStatus.RESOLVED, resolvedAt: { gte: fromDate, lte: toDate } } }),
      prisma.pilotBacklogItem.findMany({
        where: {
          companyId,
          status: PilotBacklogStatus.DONE,
          completedAt: { gte: fromDate, lte: toDate }
        },
        select: {
          id: true,
          title: true,
          type: true,
          priority: true,
          releaseNote: true,
          completedAt: true
        }
      }),
      prisma.inAppNotification.count({
        where: {
          companyId,
          severity: NotificationSeverity.CRITICAL,
          status: { in: [NotificationStatus.READ, NotificationStatus.DISMISSED, NotificationStatus.RESOLVED] },
          updatedAt: { gte: fromDate, lte: toDate }
        }
      })
    ]);

    // Sanitization: hide private notes/backlog items if it is corporate
    const backlogDelivered = backlogDeliveredRaw.map(item => ({
      ...item,
      title: item.title.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '***.***.***-**'),
      releaseNote: item.releaseNote ? item.releaseNote.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '***.***.***-**') : null,
    }));

    // 6. Help Articles telemetry usage
    const articleViews = await prisma.usageTelemetry.findMany({
      where: {
        companyId,
        eventName: 'ARTICLE_VIEW',
        createdAt: { gte: fromDate, lte: toDate }
      },
      select: { properties: true }
    });

    const articleCounts: Record<string, number> = {};
    for (const view of articleViews) {
      const props = view.properties as any;
      const title = props?.title || props?.articleTitle || 'Artigo de Ajuda';
      articleCounts[title] = (articleCounts[title] || 0) + 1;
    }

    const topArticles = Object.entries(articleCounts)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 7. Dynamic recommendations
    const recommendations: string[] = [];
    if (openOccurrences > 0) {
      recommendations.push(`Revisar e justificar as ${openOccurrences} ocorrências de presença atualmente em aberto.`);
    }
    const pendingCerts = certificatesUploaded - certificatesReviewed;
    if (pendingCerts > 0) {
      recommendations.push(`Avaliar e revisar os ${pendingCerts} atestados médicos pendentes na fila.`);
    }
    if (checkinResponseRate < 75 && totalCheckinsSent > 0) {
      recommendations.push(`Aumentar o engajamento dos colaboradores para elevar a taxa de resposta dos check-ins (atualmente em ${checkinResponseRate}%).`);
    }
    if (reportsExported === 0) {
      recommendations.push('Exportar relatórios mensais consolidados de fechamento para validação de dados.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Manter a rotina operacional atual e acompanhar os check-ins diários.');
    }

    // 8. Generate Markdown Report
    let markdown = `# Relatório Executivo de Adoção e Valor — ${company.name}\n\n`;
    markdown += `**Período analisado**: ${this.formatDateString(fromDate)} a ${this.formatDateString(toDate)}\n\n`;
    
    markdown += `## 1. Resumo Executivo\n`;
    markdown += `Este relatório apresenta a consolidação de métricas operacionais, engajamento e conformidade de presença da empresa no PresençaFlow.\n\n`;
    markdown += `- **Health Score Inicial (Primeira semana)**: ${healthScoreInitial}/100\n`;
    markdown += `- **Health Score Final (Última semana)**: ${healthScoreFinal}/100\n`;
    const scoreDiff = healthScoreFinal - healthScoreInitial;
    markdown += `- **Evolução do Índice**: ${scoreDiff >= 0 ? `+${scoreDiff}` : scoreDiff} pontos no período.\n\n`;

    markdown += `## 2. Adoção e Uso do Sistema\n`;
    markdown += `- **Colaboradores Ativos**: ${activeEmployees}\n`;
    markdown += `- **Check-ins de Presença Enviados**: ${totalCheckinsSent}\n`;
    markdown += `- **Check-ins Respondidos**: ${totalCheckinsResponded}\n`;
    markdown += `- **Taxa de Resposta Média**: ${checkinResponseRate}%\n`;
    markdown += `- **Relatórios Exportados**: ${reportsExported}\n\n`;

    markdown += `## 3. Operação de Recursos Humanos e Tratativas\n`;
    markdown += `- **Ocorrências de Presença Registradas**: ${occurrencesCreated}\n`;
    markdown += `- **Ocorrências Resolvidas**: ${occurrencesResolved}\n`;
    markdown += `- **Ocorrências Pendentes em Aberto**: ${openOccurrences}\n`;
    markdown += `- **Atestados Médicos Recebidos**: ${certificatesUploaded}\n`;
    markdown += `- **Atestados Revisados/Aprovados**: ${certificatesReviewed}\n`;
    markdown += `- **Alertas Críticos Operacionais Tratados**: ${criticalNotificationsTreated}\n\n`;

    markdown += `## 4. Feedbacks e Melhorias do Piloto\n`;
    markdown += `- **Feedbacks Reportados**: ${feedbacksReceived}\n`;
    markdown += `- **Feedbacks Resolvidos/Implementados**: ${feedbacksResolved}\n\n`;

    if (backlogDelivered.length > 0) {
      markdown += `### Melhorias e Ajustes Entregues no Período\n`;
      for (const item of backlogDelivered) {
        markdown += `- **${item.title}** (${item.type}): ${item.releaseNote || 'Melhoria implantada com sucesso.'}\n`;
      }
      markdown += `\n`;
    }

    if (topArticles.length > 0) {
      markdown += `## 5. Uso da Base de Conhecimento\n`;
      markdown += `Os artigos de ajuda mais consultados no período foram:\n`;
      for (const art of topArticles) {
        markdown += `- ${art.title} (${art.count} visualizações)\n`;
      }
      markdown += `\n`;
    }

    markdown += `## 6. Próximos Passos Recomendados\n`;
    for (const rec of recommendations) {
      markdown += `- ${rec}\n`;
    }
    markdown += `\n`;

    markdown += `---\n`;
    markdown += `**Nota de Privacidade (LGPD)**: Este documento foi consolidado de acordo com as normas da LGPD. Todos os dados médicos detalhados, diagnósticos (CIDs), CPFs e logs de comunicação direta foram ocultados ou agregados estatisticamente para garantir a segurança e a confidencialidade das informações.\n`;

    const summary = {
      totalCheckinsSent,
      totalCheckinsResponded,
      checkinResponseRate,
      occurrencesCreated,
      occurrencesResolved,
      openOccurrences,
      certificatesUploaded,
      certificatesReviewed,
      feedbacksReceived,
      feedbacksResolved,
      reportsExported
    };

    return {
      company,
      period: {
        dateFrom: this.formatDateString(fromDate),
        dateTo: this.formatDateString(toDate),
        diffDays: Math.ceil(Math.abs(toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
      },
      summary,
      operationalMetrics: {
        occurrencesCreated,
        occurrencesResolved,
        openOccurrences,
        certificatesUploaded,
        certificatesReviewed,
        reportsExported,
        criticalNotificationsTreated
      },
      adoptionMetrics: {
        activeEmployees,
        checkinResponseRate,
        totalCheckinsSent,
        totalCheckinsResponded
      },
      customerSuccess: {
        healthScoreInitial,
        healthScoreFinal,
        healthScoreEvolution: healthScoreFinal - healthScoreInitial
      },
      feedbackAndBacklog: {
        feedbacksReceived,
        feedbacksResolved,
        backlogDelivered
      },
      knowledgeUsage: {
        topArticles
      },
      recommendations,
      markdownReport: markdown
    };
  }
}
