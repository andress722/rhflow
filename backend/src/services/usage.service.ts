import { prisma } from '../lib/prisma';

export class UsageService {
  /**
   * Increments the value of a usage counter for a company in the current month (America/Sao_Paulo).
   */
  static async incrementUsage(companyId: string, key: string, amount: number): Promise<void> {
    if (amount <= 0) return;

    // Get current period as YYYY-MM in America/Sao_Paulo
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    };
    const formatter = new Intl.DateTimeFormat('en-US', formatOptions);
    const parts = formatter.formatToParts(new Date());
    const month = parts.find(p => p.type === 'month')?.value;
    const year = parts.find(p => p.type === 'year')?.value;
    const period = `${year}-${month}`;

    await prisma.usageCounter.upsert({
      where: {
        companyId_period_key: {
          companyId,
          period,
          key,
        },
      },
      update: {
        value: {
          increment: amount,
        },
      },
      create: {
        companyId,
        period,
        key,
        value: amount,
      },
    });
  }
}
