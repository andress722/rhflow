import { prisma } from '../lib/prisma';
import { RemoteCheckinService } from '../services/remote-checkin.service';
import { CompanySettingsService } from '../services/company-settings.service';
import { PlanLimitsService } from '../services/plan-limits.service';

export interface JobExecutionResult {
  processedCount: number;
  errorCount: number;
  details?: any;
}

export async function runRemoteCheckinBatchJob(options: { companyId?: string } = {}): Promise<JobExecutionResult> {
  const companies = options.companyId 
    ? [{ id: options.companyId }] 
    : await prisma.company.findMany({ select: { id: true } });

  let processedCount = 0;
  let errorCount = 0;
  const details: any[] = [];

  for (const company of companies) {
    try {
      const settings = await CompanySettingsService.getOrCreateSettings(company.id);
      if (!settings.enableBatchCheckin) {
        continue;
      }

      // Check billing limits
      try {
        const sub = await PlanLimitsService.getCurrentSubscription(company.id);
        if (!sub.plan.enableBatchCheckin) {
          continue;
        }
      } catch (err) {
        // No active subscription or disabled
        continue;
      }

      const result = await RemoteCheckinService.createCheckinBatch({}, company.id);
      processedCount += result.created;
      details.push({
        companyId: company.id,
        created: result.created,
        duplicates: result.duplicates,
        skipped: result.skipped,
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
