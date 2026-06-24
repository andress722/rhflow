import { prisma } from '../lib/prisma';
import { RemoteCheckinService } from '../services/remote-checkin.service';
import { CompanySettingsService } from '../services/company-settings.service';
import { JobExecutionResult } from './remote-checkin-batch.job';

export async function runMarkNotRespondedJob(options: { companyId?: string; date?: string; graceMinutes?: number } = {}): Promise<JobExecutionResult> {
  const companies = options.companyId 
    ? [{ id: options.companyId }] 
    : await prisma.company.findMany({ select: { id: true } });

  let processedCount = 0;
  let errorCount = 0;
  const details: any[] = [];

  for (const company of companies) {
    try {
      const settings = await CompanySettingsService.getOrCreateSettings(company.id);
      const grace = options.graceMinutes !== undefined ? options.graceMinutes : settings.defaultCheckinGraceMinutes;
      const targetDate = options.date; // if undefined, remote service defaults to Sao Paulo local date

      const result = await RemoteCheckinService.markNotResponded(targetDate, grace, company.id);
      processedCount += result.updated;
      details.push({
        companyId: company.id,
        marked: result.updated,
      });
    } catch (err: any) {
      errorCount++;
      details.push({
        companyId: company.id,
        error: err.message || String(err),
      });
    }
  }

  return {
    processedCount,
    errorCount,
    details,
  };
}
