import { prisma } from '../lib/prisma';

export interface RiskFactor {
  code: string;
  description: string;
  weight: number;
  observedValue: number;
}

export interface RiskSignalsResponse {
  level: 'LOW' | 'MODERATE' | 'HIGH';
  score: number;
  calculationType: 'HEURISTIC';
  windowDays: number;
  factors: RiskFactor[];
  humanReviewRequired: boolean;
  disclaimer: string;
}

export class WorkforceRiskSignalsService {
  /**
   * Computes risk signals based on absences, late clock-ins, and low climate survey scores in the past 30 days.
   * This is a purely advisory heuristic calculation.
   */
  static async calculate(employeeId: string, companyId: string): Promise<RiskSignalsResponse | null> {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });

    if (!employee) {
      return null;
    }

    const windowDays = 30;
    const thirtyDaysAgo = new Date(Date.now() - windowDays * 24 * 3600 * 1000);

    // 1. Absences count (Remote check-ins reported as absence)
    const absencesCount = await prisma.remoteCheckin.count({
      where: {
        employeeId,
        status: 'ABSENCE_REPORTED',
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // 2. Late check-ins count
    const latesCount = await prisma.remoteCheckin.count({
      where: {
        employeeId,
        status: 'LATE',
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // 3. Low climate survey responses (score <= 2)
    const lowClimates = await prisma.pulseSurveyResponse.count({
      where: {
        employeeId,
        score: { lte: 2 },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Base score calculation (capped at 100)
    let baseScore = 15;
    const factors: RiskFactor[] = [];

    if (absencesCount > 0) {
      const weight = absencesCount * 20;
      baseScore += weight;
      factors.push({
        code: 'ABSENCE_TREND',
        description: `Aumento de ausências injustificadas (${absencesCount} registros nos últimos 30 dias)`,
        weight,
        observedValue: absencesCount,
      });
    }

    if (latesCount > 0) {
      const weight = latesCount * 8;
      baseScore += weight;
      factors.push({
        code: 'LATE_TREND',
        description: `Atrasos recorrentes detectados (${latesCount} registros nos últimos 30 dias)`,
        weight,
        observedValue: latesCount,
      });
    }

    if (lowClimates > 0) {
      const weight = lowClimates * 25;
      baseScore += weight;
      factors.push({
        code: 'LOW_CLIMATE_SURVEY',
        description: `Avaliações baixas em pesquisas de clima (Pulse Surveys: ${lowClimates} nos últimos 30 dias)`,
        weight,
        observedValue: lowClimates,
      });
    }

    const score = Math.min(100, baseScore);
    const level = score <= 30 ? 'LOW' : score <= 70 ? 'MODERATE' : 'HIGH';

    // Persist score in DB for quick dashboard lookups
    await prisma.employee.update({
      where: { id: employeeId },
      data: { turnoverRiskScore: score },
    });

    return {
      level,
      score,
      calculationType: 'HEURISTIC',
      windowDays,
      factors,
      humanReviewRequired: true,
      disclaimer: 'Os sinais apresentados são indicadores auxiliares e não devem ser utilizados isoladamente para decisões trabalhistas, disciplinares ou de desligamento.',
    };
  }
}
