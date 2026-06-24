import { prisma } from '../lib/prisma';

export interface RiskSignal {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  description: string;
  actionUrl: string;
}

export interface Recommendation {
  key: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  description: string;
  actionUrl: string;
}

export class CustomerSuccessService {
  /**
   * Helper to check if the company has ever viewed or exported a report in AuditLog
   */
  private static async hasReportViewedEver(companyId: string): Promise<boolean> {
    const reportViewedLog = await prisma.auditLog.findFirst({
      where: {
        companyId,
        action: { in: ['REPORT_VIEWED', 'REPORT_EXPORTED', 'EXPORT_CREATED'] },
      },
    });
    return !!reportViewedLog;
  }

  /**
   * Calculates metrics, health score, risk signals, and recommendations for a company
   */
  static async calculateCompanyHealth(companyId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Fetch necessary counts and relations
    const [
      activeEmployees,
      remoteCheckinsSent7d,
      remoteCheckinsResponded7d,
      reportsViewedOrExported7d,
      occurrencesCreated7d,
      occurrencesResolved7d,
      openOccurrences,
      medicalCertificatesUploaded7d,
      medicalCertificatesReviewed7d,
      whatsappErrors7d,
      operationalErrors7d,
      companySettings,
      whatsappChannel,
      schedulesCount,
      managerCount,
      adminCount
    ] = await Promise.all([
      prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.remoteCheckin.count({ where: { companyId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.remoteCheckin.count({ where: { companyId, createdAt: { gte: sevenDaysAgo }, respondedAt: { not: null } } }),
      prisma.auditLog.count({
        where: {
          companyId,
          action: { in: ['REPORT_VIEWED', 'REPORT_EXPORTED', 'EXPORT_CREATED'] },
          createdAt: { gte: sevenDaysAgo }
        }
      }),
      prisma.occurrence.count({ where: { companyId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.occurrence.count({ where: { companyId, status: 'RESOLVED', resolvedAt: { gte: sevenDaysAgo } } }),
      prisma.occurrence.count({ where: { companyId, status: 'OPEN' } }),
      prisma.medicalCertificate.count({ where: { companyId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.medicalCertificate.count({ where: { companyId, status: { in: ['APPROVED', 'REJECTED'] }, updatedAt: { gte: sevenDaysAgo } } }),
      prisma.whatsAppMessageLog.count({ where: { companyId, status: 'FAILED', createdAt: { gte: sevenDaysAgo } } }),
      prisma.operationalErrorLog.count({ where: { companyId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.companySettings.findUnique({ where: { companyId } }),
      prisma.whatsAppChannel.findUnique({ where: { companyId } }),
      prisma.workSchedule.count({ where: { companyId, isActive: true } }),
      prisma.employee.count({ where: { companyId, managerUserId: { not: null } } }),
      prisma.user.count({ where: { companyId, role: 'ADMIN', isActive: true } })
    ]);

    // 2. Calculate responseRate7d
    const responseRate7d = remoteCheckinsSent7d > 0
      ? Math.round((remoteCheckinsResponded7d / remoteCheckinsSent7d) * 100)
      : 0;

    // 3. Calculate lastActivityAt
    const [latestAudit, latestCheckin, latestOccurrence, latestCertificate] = await Promise.all([
      prisma.auditLog.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.remoteCheckin.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.occurrence.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.medicalCertificate.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
    ]);

    const activityDates = [
      latestAudit?.createdAt,
      latestCheckin?.createdAt,
      latestOccurrence?.createdAt,
      latestCertificate?.createdAt
    ].filter((d): d is Date => !!d);

    const lastActivityAt = activityDates.length > 0
      ? new Date(Math.max(...activityDates.map(d => d.getTime())))
      : null;

    // 4. Calculate Health Score Components
    let adoptionScore = 0;
    if (activeEmployees > 0) adoptionScore += 15;
    
    const enableRemoteCheckin = companySettings?.enableRemoteCheckin ?? true;
    if (enableRemoteCheckin) {
      if (remoteCheckinsSent7d > 0) adoptionScore += 15;
    } else {
      // If remote checkin is disabled, automatically award adoption points
      adoptionScore += 15;
    }

    const hasRecentActivity = lastActivityAt && (now.getTime() - lastActivityAt.getTime()) <= 7 * 24 * 60 * 60 * 1000;
    if (hasRecentActivity) adoptionScore += 10;

    let responseScore = 0;
    if (enableRemoteCheckin) {
      if (responseRate7d >= 75) {
        responseScore = 25;
      } else if (responseRate7d >= 50) {
        responseScore = 15;
      } else if (responseRate7d >= 25) {
        responseScore = 8;
      } else {
        responseScore = 0;
      }
    } else {
      // If remote checkin is disabled, response rate does not penalize
      responseScore = 25;
    }

    let errorScore = 0;
    const isWhatsappHealthy = whatsappChannel && 
      (whatsappChannel.status === 'CONNECTED' || 
       whatsappChannel.status === 'SIMULATION' || 
       whatsappChannel.provider === 'SIMULATED');
    if (isWhatsappHealthy) {
      errorScore += 10;
    }

    if (whatsappErrors7d === 0) {
      errorScore += 5;
    } else if (whatsappErrors7d <= 5) {
      errorScore += 3;
    }

    if (operationalErrors7d === 0) {
      errorScore += 5;
    } else if (operationalErrors7d <= 5) {
      errorScore += 3;
    }

    let managementScore = 0;
    const hasReportActivity = reportsViewedOrExported7d > 0 || (await this.hasReportViewedEver(companyId));
    if (hasReportActivity) {
      managementScore += 5;
    }

    const hasCleanOccurrences = openOccurrences === 0 || occurrencesResolved7d > 0;
    if (hasCleanOccurrences) {
      managementScore += 5;
    }

    const isMedicalEnabled = companySettings?.enableMedicalCertificates ?? true;
    if (!isMedicalEnabled) {
      managementScore += 5;
    } else {
      const pendingCount = await prisma.medicalCertificate.count({
        where: { companyId, status: 'RECEIVED' }
      });
      if (pendingCount === 0 || medicalCertificatesReviewed7d > 0) {
        managementScore += 5;
      }
    }

    const healthScore = Math.min(100, adoptionScore + responseScore + errorScore + managementScore);

    // 5. Generate Risk Signals
    const riskSignals: RiskSignal[] = [];

    if (activeEmployees === 0) {
      riskSignals.push({
        type: 'NO_ACTIVE_EMPLOYEES',
        severity: 'HIGH',
        title: 'Sem colaboradores ativos',
        description: 'A empresa não possui funcionários ativos cadastrados para o piloto.',
        actionUrl: '/app/employees'
      });
    }

    if (schedulesCount === 0) {
      riskSignals.push({
        type: 'NO_ACTIVE_SCHEDULES',
        severity: 'HIGH',
        title: 'Sem jornadas ativas',
        description: 'Nenhuma jornada de trabalho (escala) ativa foi configurada no sistema.',
        actionUrl: '/app/work-schedules'
      });
    }

    if (whatsappChannel?.status === 'ERROR') {
      riskSignals.push({
        type: 'WHATSAPP_ERROR',
        severity: 'HIGH',
        title: 'WhatsApp com erro',
        description: 'O canal de envio do WhatsApp está inoperante ou com falha de conexão.',
        actionUrl: '/app/settings/whatsapp'
      });
    }

    if (enableRemoteCheckin) {
      if (remoteCheckinsSent7d > 0) {
        if (responseRate7d < 25) {
          riskSignals.push({
            type: 'LOW_RESPONSE_RATE',
            severity: 'HIGH',
            title: 'Taxa de resposta crítica',
            description: `A taxa de resposta dos check-ins nos últimos 7 dias está muito baixa (${responseRate7d}%).`,
            actionUrl: '/app/presence'
          });
        } else if (responseRate7d < 50) {
          riskSignals.push({
            type: 'LOW_RESPONSE_RATE',
            severity: 'MEDIUM',
            title: 'Taxa de resposta sob atenção',
            description: `A taxa de resposta dos check-ins nos últimos 7 dias está abaixo de 50% (${responseRate7d}%).`,
            actionUrl: '/app/presence'
          });
        }
      } else {
        riskSignals.push({
          type: 'NO_RECENT_CHECKINS',
          severity: activeEmployees > 0 ? 'HIGH' : 'MEDIUM',
          title: 'Nenhum check-in enviado nos últimos 7 dias',
          description: 'O check-in remoto está habilitado, mas nenhum disparo foi feito no período.',
          actionUrl: '/app/presence'
        });
      }
    }

    if (operationalErrors7d > 10) {
      riskSignals.push({
        type: 'MANY_OPERATIONAL_ERRORS',
        severity: 'HIGH',
        title: 'Alto volume de erros operacionais',
        description: `Foram detectados ${operationalErrors7d} erros operacionais de sistema nos últimos 7 dias.`,
        actionUrl: '/app/customer-success'
      });
    } else if (operationalErrors7d > 2) {
      riskSignals.push({
        type: 'MANY_OPERATIONAL_ERRORS',
        severity: 'MEDIUM',
        title: 'Erros operacionais recentes',
        description: `Foram detectados ${operationalErrors7d} erros operacionais nos últimos 7 dias.`,
        actionUrl: '/app/customer-success'
      });
    }

    if (openOccurrences > 5) {
      riskSignals.push({
        type: 'MANY_OPEN_OCCURRENCES',
        severity: 'MEDIUM',
        title: 'Ocorrências pendentes acumuladas',
        description: `Existem ${openOccurrences} ocorrências em aberto aguardando tratamento.`,
        actionUrl: '/app/occurrences'
      });
    }

    if (isMedicalEnabled) {
      const pendingMedicalCount = await prisma.medicalCertificate.count({
        where: { companyId, status: 'RECEIVED' }
      });
      if (pendingMedicalCount > 0) {
        riskSignals.push({
          type: 'PENDING_MEDICAL_CERTIFICATES',
          severity: 'MEDIUM',
          title: 'Atestados aguardando revisão',
          description: `Existem ${pendingMedicalCount} atestados médicos pendentes de revisão pelo RH.`,
          actionUrl: '/app/medical-certificates'
        });
      }
    }

    if (!hasReportActivity) {
      riskSignals.push({
        type: 'NO_REPORT_ACTIVITY',
        severity: 'MEDIUM',
        title: 'Sem uso de relatórios',
        description: 'Nenhum relatório de presença foi visualizado ou exportado pelo RH até o momento.',
        actionUrl: '/app/reports'
      });
    }

    // 6. Generate Recommendations
    const recommendations: Recommendation[] = [];

    if (activeEmployees === 0) {
      recommendations.push({
        key: 'IMPORT_EMPLOYEES',
        priority: 'HIGH',
        title: 'Importar funcionários piloto',
        description: 'Cadastre os colaboradores piloto para iniciar o fluxo operacional.',
        actionUrl: '/app/employees'
      });
    }

    if (schedulesCount === 0) {
      recommendations.push({
        key: 'CONFIGURE_SCHEDULES',
        priority: 'HIGH',
        title: 'Configurar jornadas de trabalho',
        description: 'Crie e configure pelo menos uma escala de trabalho ativa.',
        actionUrl: '/app/work-schedules'
      });
    }

    if (activeEmployees > 0 && managerCount === 0) {
      recommendations.push({
        key: 'ASSIGN_MANAGERS',
        priority: 'MEDIUM',
        title: 'Atribuir gestores operacionais',
        description: 'Vincule gestores aos colaboradores para descentralizar o tratamento.',
        actionUrl: '/app/employees'
      });
    }

    const isChannelConfigured = whatsappChannel && 
      (whatsappChannel.status === 'CONNECTED' || 
       whatsappChannel.status === 'SIMULATION' || 
       whatsappChannel.provider === 'SIMULATED');
    if (!isChannelConfigured) {
      recommendations.push({
        key: 'TEST_WHATSAPP',
        priority: 'HIGH',
        title: 'Configurar e conectar WhatsApp',
        description: 'Conecte a API ou ative a simulação para enviar alertas automáticos.',
        actionUrl: '/app/settings/whatsapp'
      });
    }

    if (enableRemoteCheckin && remoteCheckinsSent7d === 0 && activeEmployees > 0) {
      recommendations.push({
        key: 'SEND_FIRST_CHECKIN',
        priority: 'HIGH',
        title: 'Enviar primeiro check-in',
        description: 'Faça um disparo de check-in para testar a comunicação.',
        actionUrl: '/app/presence'
      });
    }

    if (openOccurrences > 0) {
      recommendations.push({
        key: 'REVIEW_OPEN_OCCURRENCES',
        priority: 'MEDIUM',
        title: 'Revisar ocorrências em aberto',
        description: `Existem ${openOccurrences} ocorrências aguardando justificativa ou fechamento.`,
        actionUrl: '/app/occurrences'
      });
    }

    if (isMedicalEnabled) {
      const pendingMedicalCount = await prisma.medicalCertificate.count({
        where: { companyId, status: 'RECEIVED' }
      });
      if (pendingMedicalCount > 0) {
        recommendations.push({
          key: 'REVIEW_MEDICAL_CERTIFICATES',
          priority: 'MEDIUM',
          title: 'Revisar atestados pendentes',
          description: `Analise e aprove os ${pendingMedicalCount} atestados médicos pendentes.`,
          actionUrl: '/app/medical-certificates'
        });
      }
    }

    if (!hasReportActivity) {
      recommendations.push({
        key: 'EXPORT_FIRST_REPORT',
        priority: 'MEDIUM',
        title: 'Exportar primeiro relatório',
        description: 'Exporte um relatório consolidado para avaliar a adesão operacional.',
        actionUrl: '/app/reports'
      });
    }

    if (healthScore < 100) {
      recommendations.push({
        key: 'OPEN_ONBOARDING',
        priority: 'LOW',
        title: 'Revisar checklist de onboarding',
        description: 'Consulte o checklist guiado para garantir conformidade técnica.',
        actionUrl: '/app/onboarding'
      });
    }

    // 7. Calculate status
    let status: 'HEALTHY' | 'ATTENTION' | 'CRITICAL' = 'HEALTHY';
    const hasHighRisk = riskSignals.some(r => r.severity === 'HIGH');
    const hasMediumRisk = riskSignals.some(r => r.severity === 'MEDIUM');

    if (healthScore < 50 || hasHighRisk) {
      status = 'CRITICAL';
    } else if (healthScore < 80 || hasMediumRisk) {
      status = 'ATTENTION';
    }

    // 8. Determine isOnboardingIncomplete
    const isOnboardingIncomplete = activeEmployees === 0 || 
      schedulesCount === 0 || 
      adminCount === 0 || 
      !companySettings || 
      !isChannelConfigured;

    return {
      healthScore,
      status,
      periodStart: sevenDaysAgo.toISOString(),
      periodEnd: now.toISOString(),
      isOnboardingIncomplete,
      adoptionMetrics: {
        activeEmployees,
        remoteCheckinsSent7d,
        remoteCheckinsResponded7d,
        responseRate7d,
        reportsViewedOrExported7d,
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      },
      operationalMetrics: {
        occurrencesCreated7d,
        occurrencesResolved7d,
        openOccurrences,
        medicalCertificatesUploaded7d,
        medicalCertificatesReviewed7d,
        whatsappErrors7d,
        operationalErrors7d,
      },
      riskSignals,
      recommendations
    };
  }
}
