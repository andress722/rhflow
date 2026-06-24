import { prisma } from '../lib/prisma';
import { OccurrenceType, OccurrenceStatus, OccurrenceSource, RemoteCheckinStatus, MedicalCertificateStatus } from '@prisma/client';

export class ReportsService {
  /**
   * Helper to format CPF as ***.***.***-** for privacy compliance
   */
  static maskCpf(cpf: string | null): string {
    return '***.***.***-**';
  }

  /**
   * Consolidates occurrences and remote check-ins in the period, applying RBAC scopes and filters
   */
  static async getOperationalReport(options: {
    companyId: string;
    role: string;
    sub: string;
    from: string;
    to: string;
    employeeId?: string;
    managerUserId?: string;
    sector?: string;
    occurrenceType?: string;
    status?: string;
    workModel?: string;
  }) {
    const { companyId, role, sub, from, to, employeeId, managerUserId, sector, occurrenceType, status, workModel } = options;

    if (!from || !to) {
      throw new Error('MISSING_PERIOD');
    }

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    if (fromDate > toDate) {
      throw new Error('INVALID_PERIOD_ORDER');
    }

    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      throw new Error('LIMIT_EXCEEDED');
    }

    // 1. Build where conditions for Occurrence
    const occWhere: any = {
      companyId,
      occurrenceDate: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (employeeId) occWhere.employeeId = employeeId;
    if (occurrenceType) occWhere.type = occurrenceType as OccurrenceType;
    if (status) occWhere.status = status as OccurrenceStatus;

    const empConditions: any = {};
    if (sector) empConditions.sector = sector;
    if (workModel) empConditions.workModel = workModel;
    if (managerUserId) empConditions.managerUserId = managerUserId;
    if (role === 'MANAGER') {
      empConditions.managerUserId = sub;
    }

    if (Object.keys(empConditions).length > 0) {
      occWhere.employee = empConditions;
    }

    // Fetch occurrences
    const occurrences = await prisma.occurrence.findMany({
      where: occWhere,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            cpf: true,
            sector: true,
            workModel: true,
            manager: { select: { name: true } },
          },
        },
        medicalCertificates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        absenceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        remoteCheckins: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { occurrenceDate: 'desc' },
    });

    // 2. Build where conditions for RemoteCheckins without occurrenceId
    const checkinWhere: any = {
      companyId,
      occurrenceId: null,
      checkinDate: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (employeeId) checkinWhere.employeeId = employeeId;
    if (status) checkinWhere.status = status as RemoteCheckinStatus;

    if (Object.keys(empConditions).length > 0) {
      checkinWhere.employee = empConditions;
    }

    let checkins: any[] = [];
    // If filtering by occurrenceType, check-ins are skipped as they don't have occurrences
    if (!occurrenceType) {
      checkins = await prisma.remoteCheckin.findMany({
        where: checkinWhere,
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              cpf: true,
              sector: true,
              workModel: true,
              manager: { select: { name: true } },
            },
          },
        },
        orderBy: { checkinDate: 'desc' },
      });
    }

    // 3. Map both lists to unified operational items
    const items: any[] = [];
    const uniqueEmployees = new Set<string>();

    occurrences.forEach((occ) => {
      const emp = occ.employee;
      uniqueEmployees.add(emp.id);

      const latestCert = occ.medicalCertificates[0] || null;
      const latestAbsence = occ.absenceRecords[0] || null;
      const latestCheckin = occ.remoteCheckins[0] || null;

      items.push({
        date: occ.occurrenceDate.toISOString().split('T')[0],
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeCpfMasked: ReportsService.maskCpf(emp.cpf),
        managerName: emp.manager?.name || '-',
        sector: emp.sector || '-',
        workModel: emp.workModel,
        type: occ.type,
        status: occ.status,
        source: occ.source,
        hasMedicalCertificate: !!latestCert,
        medicalCertificateStatus: latestCert ? latestCert.status : null,
        absenceDays: latestAbsence ? latestAbsence.days : (latestCert?.approvedDays || latestCert?.suggestedDays || null),
        notes: occ.description || latestCert?.notes || latestCheckin?.responseText || '-',
        createdAt: occ.createdAt,
        resolvedAt: occ.resolvedAt,
      });
    });

    checkins.forEach((c) => {
      const emp = c.employee;
      uniqueEmployees.add(emp.id);

      items.push({
        date: c.checkinDate.toISOString().split('T')[0],
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeCpfMasked: ReportsService.maskCpf(emp.cpf),
        managerName: emp.manager?.name || '-',
        sector: emp.sector || '-',
        workModel: emp.workModel,
        type: 'REMOTE_CHECKIN',
        status: c.status,
        source: c.source,
        hasMedicalCertificate: false,
        medicalCertificateStatus: null,
        absenceDays: null,
        notes: c.responseText ? `[Opção: ${c.responseOption || '-'}] Resposta: ${c.responseText}` : (c.status === 'PENDING' ? 'Aguardando resposta' : '-'),
        createdAt: c.createdAt,
        resolvedAt: c.respondedAt || null,
      });
    });

    // Sort: Date Descending, then CreatedAt Descending
    items.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Summary calculations
    let absences = 0;
    let lateArrivals = 0;
    let notResponded = 0;
    let medicalCertificates = 0;
    let technicalIssues = 0;

    items.forEach((item) => {
      if (item.type === 'ABSENCE') {
        absences++;
      }
      if (item.type === 'LATE_ARRIVAL') {
        lateArrivals++;
      }
      if (item.type === 'REMOTE_CHECKIN_NOT_RESPONDED' || item.status === 'NOT_RESPONDED') {
        notResponded++;
      }
      if (item.type === 'MEDICAL_CERTIFICATE' || item.hasMedicalCertificate) {
        medicalCertificates++;
      }
      if (item.type === 'REMOTE_TECHNICAL_ISSUE') {
        technicalIssues++;
      }
    });

    // Query active absences in the period
    const activeAbsenceWhere: any = {
      companyId,
      status: 'ACTIVE',
    };
    if (employeeId) activeAbsenceWhere.employeeId = employeeId;

    const activeAbsenceEmpConditions: any = {};
    if (sector) activeAbsenceEmpConditions.sector = sector;
    if (workModel) activeAbsenceEmpConditions.workModel = workModel;
    if (role === 'MANAGER') activeAbsenceEmpConditions.managerUserId = sub;

    if (Object.keys(activeAbsenceEmpConditions).length > 0) {
      activeAbsenceWhere.employee = activeAbsenceEmpConditions;
    }

    const activeAbsencesCount = await prisma.absenceRecord.count({
      where: activeAbsenceWhere,
    });

    return {
      period: {
        from,
        to,
      },
      summary: {
        employees: uniqueEmployees.size,
        absences,
        lateArrivals,
        notResponded,
        medicalCertificates,
        activeAbsences: activeAbsencesCount,
        technicalIssues,
      },
      items,
    };
  }

  /**
   * Retrieves operational closing pendencies grouped by category and severity
   */
  static async getClosingPendencies(companyId: string, role: string, sub: string) {
    const empCondition = role === 'MANAGER' ? { managerUserId: sub } : {};

    const occurrences = await prisma.occurrence.findMany({
      where: {
        companyId,
        status: { in: ['OPEN', 'WAITING_EMPLOYEE', 'WAITING_MANAGER', 'WAITING_HR'] },
        employee: empCondition,
      },
      include: { employee: true },
    });

    const medicalCertificates = await prisma.medicalCertificate.findMany({
      where: {
        companyId,
        status: { in: ['RECEIVED', 'UNDER_REVIEW'] },
        employee: empCondition,
      },
      include: { employee: true },
    });

    const checkins = await prisma.remoteCheckin.findMany({
      where: {
        companyId,
        status: { in: ['PENDING', 'NOT_RESPONDED'] },
        employee: empCondition,
      },
      include: { employee: true },
    });

    const activeAbsences = await prisma.absenceRecord.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        employee: empCondition,
      },
      include: { employee: true },
    });

    const items: any[] = [];

    // 1. Map open occurrences
    occurrences.forEach((occ) => {
      let category = 'OPEN_OCCURRENCE';
      let severity = 'WARNING';
      let description = `Ocorrência aberta: ${occ.title}`;

      if (occ.type === 'ABSENCE') {
        category = 'UNRESOLVED_ABSENCE';
        severity = 'CRITICAL';
        description = `Falta sem decisão: ${occ.title}`;
      } else if (occ.type === 'REMOTE_TECHNICAL_ISSUE') {
        category = 'OPEN_TECHNICAL_ISSUE';
        severity = 'WARNING';
        description = `Problema técnico pendente: ${occ.title}`;
      } else if (occ.severity === 'HIGH') {
        severity = 'CRITICAL';
      }

      items.push({
        category,
        severity,
        employeeId: occ.employeeId,
        employeeName: occ.employee.fullName,
        description,
        createdAt: occ.createdAt,
        targetUrl: `/app/occurrences?id=${occ.id}`,
      });
    });

    // 2. Map medical certificates pending review
    medicalCertificates.forEach((cert) => {
      items.push({
        category: 'MEDICAL_CERTIFICATE_PENDING_REVIEW',
        severity: 'CRITICAL',
        employeeId: cert.employeeId,
        employeeName: cert.employee.fullName,
        description: `Atestado aguardando revisão do RH (${cert.originalFilename})`,
        createdAt: cert.createdAt,
        targetUrl: `/app/medical-certificates?id=${cert.id}`,
      });
    });

    // 3. Map check-ins pending or not responded
    checkins.forEach((c) => {
      const isPending = c.status === 'PENDING';
      items.push({
        category: isPending ? 'PENDING_CHECKIN' : 'NOT_RESPONDED_CHECKIN',
        severity: isPending ? 'INFO' : 'WARNING',
        employeeId: c.employeeId,
        employeeName: c.employee.fullName,
        description: isPending ? 'Check-in remoto pendente de resposta' : 'Check-in remoto não respondido (tolerância estourada)',
        createdAt: c.createdAt,
        targetUrl: '/app/presence',
      });
    });

    // 4. Map active absences
    activeAbsences.forEach((a) => {
      items.push({
        category: 'ACTIVE_ABSENCE',
        severity: 'INFO',
        employeeId: a.employeeId,
        employeeName: a.employee.fullName,
        description: `Funcionário em afastamento ativo (término em ${a.endDate.toLocaleDateString('pt-BR')})`,
        createdAt: a.createdAt,
        targetUrl: '/app/medical-certificates',
      });
    });

    // Calculate aggregations
    let total = items.length;
    let critical = 0;
    let warning = 0;
    let info = 0;

    items.forEach((item) => {
      if (item.severity === 'CRITICAL') critical++;
      else if (item.severity === 'WARNING') warning++;
      else if (item.severity === 'INFO') info++;
    });

    // Sort by severity order (CRITICAL > WARNING > INFO), then date desc
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    items.sort((a, b) => {
      const orderA = severityOrder[a.severity as keyof typeof severityOrder];
      const orderB = severityOrder[b.severity as keyof typeof severityOrder];
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return {
      summary: {
        total,
        critical,
        warning,
        info,
      },
      items,
    };
  }

  /**
   * Generates a CSV file from the operational report data, registers reporting audit logs
   */
  static async exportOperationalReport(
    options: {
      companyId: string;
      role: string;
      sub: string;
      from: string;
      to: string;
      employeeId?: string;
      managerUserId?: string;
      sector?: string;
      occurrenceType?: string;
      status?: string;
      workModel?: string;
    },
    ip?: string,
    userAgent?: string
  ) {
    const reportData = await ReportsService.getOperationalReport(options);

    // Escape CSV cell contents
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      // Double quotes, newlines or semicolons must be escaped
      if (str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(';')) {
        str = str.replace(/"/g, '""');
        return `"${str}"`;
      }
      return str;
    };

    const headers = [
      'Data',
      'Funcionário',
      'CPF mascarado',
      'Setor',
      'Gestor',
      'Modelo de trabalho',
      'Tipo',
      'Status',
      'Origem',
      'Atestado vinculado',
      'Status do atestado',
      'Dias de afastamento',
      'Observação',
      'Criado em',
      'Resolvido em',
    ];

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.join(';') + '\n';

    reportData.items.forEach((item) => {
      const typeLabel = item.type === 'REMOTE_CHECKIN' ? 'Check-in Remoto' : item.type;
      const workModelLabel = item.workModel === 'PRESENTIAL' ? 'Presencial' : (item.workModel === 'REMOTE' ? 'Remoto' : 'Híbrido');

      const row = [
        item.date,
        item.employeeName,
        item.employeeCpfMasked,
        item.sector,
        item.managerName,
        workModelLabel,
        typeLabel,
        item.status,
        item.source,
        item.hasMedicalCertificate ? 'Sim' : 'Não',
        item.medicalCertificateStatus || '-',
        item.absenceDays !== null ? item.absenceDays : '-',
        item.notes,
        new Date(item.createdAt).toLocaleString('pt-BR'),
        item.resolvedAt ? new Date(item.resolvedAt).toLocaleString('pt-BR') : '-',
      ];

      csvContent += row.map(escapeCsv).join(';') + '\n';
    });

    // Create AuditLog
    await prisma.auditLog.create({
      data: {
        companyId: options.companyId,
        userId: options.sub,
        action: 'REPORT_EXPORTED',
        entity: 'Report',
        entityId: 'operational',
        ip: ip || null,
        userAgent: userAgent || null,
        metadata: {
          report: 'operational',
          format: 'csv',
          filters: {
            from: options.from,
            to: options.to,
            employeeId: options.employeeId || null,
            managerUserId: options.managerUserId || null,
            sector: options.sector || null,
            occurrenceType: options.occurrenceType || null,
            status: options.status || null,
            workModel: options.workModel || null,
          },
          rowCount: reportData.items.length,
        },
      },
    });

    return csvContent;
  }
}
