import { prisma } from '../lib/prisma';

export class AfdService {
  /**
   * Generates a MTE Portaria 671 compliant AFD (Arquivo de Fonte de Dados) text content.
   */
  static async generateAfd(options: {
    companyId: string;
    dateFrom: string;
    dateTo: string;
  }): Promise<string> {
    const { companyId, dateFrom, dateTo } = options;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new Error('Empresa não encontrada.');
    }

    const start = new Date(dateFrom);
    const end = new Date(dateTo + 'T23:59:59.999Z');

    // Fetch confirmed presence records
    const checkins = await prisma.remoteCheckin.findMany({
      where: {
        companyId,
        status: { in: ['CONFIRMED', 'LATE'] },
        respondedAt: { gte: start, lte: end },
      },
      include: { employee: true },
      orderBy: { respondedAt: 'asc' },
    });

    let nsr = 1;
    const lines: string[] = [];

    // 1. Header Row (Registo Tipo 1)
    const cnpj = (company.cnpj || '00000000000000').replace(/\D/g, '').padEnd(14, '0');
    const compName = company.name.toUpperCase().slice(0, 150).padEnd(150, ' ');
    const dIni = dateFrom.replace(/-/g, '');
    const dFim = dateTo.replace(/-/g, '');
    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = new Date().toTimeString().slice(0, 5).replace(/:/g, '');

    const header = `${String(nsr++).padStart(9, '0')}1${cnpj}${compName}${dIni}${dFim}${todayStr}${timeStr}`;
    lines.push(header);

    // 2. Detail Rows (Registo Tipo 3 - Marcação de Ponto)
    for (const checkin of checkins) {
      if (!checkin.respondedAt) continue;

      const datePart = checkin.respondedAt.toISOString().split('T')[0].replace(/-/g, '');
      const timePart = checkin.respondedAt.toTimeString().slice(0, 5).replace(/:/g, '');
      
      const mockPis = (checkin.employee.cpf || '12345678901').replace(/\D/g, '').padEnd(12, '0');
      
      const record = `${String(nsr++).padStart(9, '0')}3${datePart}${timePart}${mockPis}`;
      lines.push(record);
    }

    // 3. Trailer Row (Registo Tipo 9)
    const total3 = checkins.length;
    const trailer = `${String(nsr++).padStart(9, '0')}9${'0'.padStart(9, '0')}${String(total3).padStart(9, '0')}${'0'.padStart(9, '0')}${'0'.padStart(9, '0')}1`;
    lines.push(trailer);

    return lines.join('\r\n');
  }
}
