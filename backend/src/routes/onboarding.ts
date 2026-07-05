import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/auth-middleware';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

// Helper to sanitize inputs and prevent script/HTML injection
function sanitizeInputString(str: string | null | undefined, maxLength = 255): string | null {
  if (!str) return null;
  const clean = str.replace(/<[^>]*>?/gm, '').trim();
  return clean.substring(0, maxLength);
}

const manualStepSchema = z.object({
  key: z.enum([
    'kickoff_done',
    'customer_trained',
    'pilot_approved',
    'contract_signed',
    'first_week_review_done'
  ], {
    errorMap: () => ({ message: 'Chave de etapa manual inválida.' })
  }),
  completed: z.boolean({
    required_error: 'Status de conclusão (completed) é obrigatório.'
  }),
  note: z.string().max(1000, 'A nota deve ter no máximo 1000 caracteres.').optional().nullable()
});

async function getManualStepStatus(companyId: string, key: string): Promise<boolean> {
  const latestLog = await prisma.auditLog.findFirst({
    where: {
      companyId,
      action: 'ONBOARDING_STEP_UPDATED',
      metadata: {
        path: ['key'],
        equals: key
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!latestLog) return false;
  return (latestLog.metadata as any)?.completed === true;
}

export async function getOnboardingData(companyId: string) {
  // 1. companyProfileCompleted (CNPJ and name)
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });
  const companyProfileCompleted = !!company?.name && !!company?.cnpj;

  // 2. adminUserReady (at least 1 ADMIN active)
  const adminCount = await prisma.user.count({
    where: { companyId, role: 'ADMIN', isActive: true },
  });
  const adminUserReady = adminCount > 0;

  // 3. companySettingsConfigured (CompanySettings exist)
  const companySettings = await prisma.companySettings.findUnique({
    where: { companyId },
  });
  const companySettingsConfigured = !!companySettings;

  // 4. whatsappChannelConfigured
  const whatsappChannel = await prisma.whatsAppChannel.findUnique({
    where: { companyId },
  });
  const whatsappChannelConfigured =
    !!whatsappChannel &&
    (whatsappChannel.status === 'CONNECTED' ||
      whatsappChannel.status === 'SIMULATION' ||
      whatsappChannel.provider === 'SIMULATED');

  // 5. employeesImported
  const employeeCount = await prisma.employee.count({
    where: { companyId, status: 'ACTIVE' },
  });
  const employeesImported = employeeCount > 0;

  // 6. schedulesConfigured
  const scheduleCount = await prisma.workSchedule.count({
    where: { companyId, isActive: true },
  });
  const schedulesConfigured = scheduleCount > 0;

  // 7. managersAssigned
  const managersCount = await prisma.employee.count({
    where: { companyId, managerUserId: { not: null } },
  });
  const managersAssigned = managersCount > 0;

  // 8. remoteCheckinEnabled
  const remoteCheckinEnabled = !!companySettings?.enableRemoteCheckin;

  // 9. medicalCertificatesEnabled
  const medicalCertificatesEnabled = !!companySettings?.enableMedicalCertificates;

  // 10. firstRemoteCheckinSent
  const checkinCount = await prisma.remoteCheckin.count({
    where: { companyId },
  });
  const firstRemoteCheckinSent = checkinCount > 0;

  // 11. firstOccurrenceCreated
  const occurrenceCount = await prisma.occurrence.count({
    where: { companyId },
  });
  const firstOccurrenceCreated = occurrenceCount > 0;

  // 12. firstReportViewed
  const reportViewedLog = await prisma.auditLog.findFirst({
    where: {
      companyId,
      action: { in: ['REPORT_VIEWED', 'REPORT_EXPORTED', 'EXPORT_CREATED'] },
    },
  });
  const firstReportViewed = !!reportViewedLog;

  // Manual steps
  const kickoff_done = await getManualStepStatus(companyId, 'kickoff_done');
  const customer_trained = await getManualStepStatus(companyId, 'customer_trained');
  const pilot_approved = await getManualStepStatus(companyId, 'pilot_approved');
  const contract_signed = await getManualStepStatus(companyId, 'contract_signed');
  const first_week_review_done = await getManualStepStatus(companyId, 'first_week_review_done');

  // Subscription/Plan details
  const subscription = await prisma.companySubscription.findUnique({
    where: { companyId },
    include: { plan: true },
  });

  // Calculate blockers & warnings
  const blockers: string[] = [];
  if (!adminUserReady) blockers.push('Sem administrador ativo na plataforma');
  if (!employeesImported) blockers.push('Sem funcionários ativos cadastrados');
  if (!schedulesConfigured) blockers.push('Sem jornada de trabalho (escala) ativa');
  if (!companySettingsConfigured) blockers.push('Regras da empresa (CompanySettings) ausentes');
  if (!whatsappChannelConfigured) blockers.push('Canal de WhatsApp não configurado');
  if (company?.isActive === false) blockers.push('Empresa inativa no sistema');

  const warnings: string[] = [];
  if (whatsappChannel?.provider === 'SIMULATED' || whatsappChannel?.status === 'SIMULATION') {
    warnings.push('WhatsApp operando em modo simulação');
  }
  if (!managersAssigned) warnings.push('Nenhum gestor atribuído a funcionários');
  if (!firstRemoteCheckinSent) warnings.push('Nenhum check-in remoto enviado ou testado');
  if (!firstOccurrenceCreated) warnings.push('Nenhuma ocorrência registrada no sistema');
  if (!firstReportViewed) warnings.push('Nenhum relatório visualizado ou exportado');
  if (!medicalCertificatesEnabled && !!subscription?.plan.enableMedicalModule) {
    warnings.push('Módulo de atestados desligado quando o plano contratado permite');
  }

  // Define checklist items with keys, labels, actionUrls, descriptions, required status, and completed status
  const checklistItems = [
    {
      key: 'companyProfileCompleted',
      label: 'Perfil da Empresa Preenchido',
      completed: companyProfileCompleted,
      required: true,
      actionUrl: '/app/settings/company',
      description: 'Preencha a Razão Social e o CNPJ da empresa nas configurações.'
    },
    {
      key: 'adminUserReady',
      label: 'Administrador Ativo',
      completed: adminUserReady,
      required: true,
      actionUrl: '/app/settings/team',
      description: 'Cadastre pelo menos um usuário administrador ativo.'
    },
    {
      key: 'companySettingsConfigured',
      label: 'Regras da Empresa Configuradas',
      completed: companySettingsConfigured,
      required: true,
      actionUrl: '/app/settings/company',
      description: 'Configure as regras padrão e limites da empresa.'
    },
    {
      key: 'whatsappChannelConfigured',
      label: 'WhatsApp Configurado',
      completed: whatsappChannelConfigured,
      required: true,
      actionUrl: '/app/settings/whatsapp',
      description: 'Conecte a API de WhatsApp ou ative a simulação.'
    },
    {
      key: 'employeesImported',
      label: 'Funcionários Importados',
      completed: employeesImported,
      required: true,
      actionUrl: '/app/employees/import/v2',
      description: 'Cadastre ou importe os funcionários ativos do piloto.'
    },
    {
      key: 'schedulesConfigured',
      label: 'Jornadas Criadas',
      completed: schedulesConfigured,
      required: true,
      actionUrl: '/app/work-schedules',
      description: 'Cadastre pelo menos uma jornada de trabalho ativa.'
    },
    {
      key: 'managersAssigned',
      label: 'Gestores Atribuídos',
      completed: managersAssigned,
      required: false,
      actionUrl: '/app/employees',
      description: 'Atribua gestores responsáveis para os funcionários.'
    },
    {
      key: 'remoteCheckinEnabled',
      label: 'Check-in Remoto Ativado',
      completed: remoteCheckinEnabled,
      required: true,
      actionUrl: '/app/settings/company',
      description: 'Ative o check-in remoto nas configurações gerais.'
    },
    {
      key: 'medicalCertificatesEnabled',
      label: 'Módulo de Atestados Ativado',
      completed: medicalCertificatesEnabled,
      required: false,
      actionUrl: '/app/settings/company',
      description: 'Ative o módulo de atestados médicos nas configurações.'
    },
    {
      key: 'firstRemoteCheckinSent',
      label: 'Primeiro Check-in Testado',
      completed: firstRemoteCheckinSent,
      required: false,
      actionUrl: '/app/presence',
      description: 'Envie ou simule o primeiro check-in para teste.'
    },
    {
      key: 'firstOccurrenceCreated',
      label: 'Primeira Ocorrência Criada',
      completed: firstOccurrenceCreated,
      required: false,
      actionUrl: '/app/occurrences',
      description: 'Registre uma ocorrência operacional (manual ou automática).'
    },
    {
      key: 'firstReportViewed',
      label: 'Relatório Exportado/Visualizado',
      completed: firstReportViewed,
      required: false,
      actionUrl: '/app/reports',
      description: 'Acesse e exporte/visualize a tela de relatórios gerenciais.'
    },
    {
      key: 'kickoff_done',
      label: 'Reunião de Alinhamento (Kickoff)',
      completed: kickoff_done,
      required: true,
      actionUrl: '/app/onboarding',
      description: 'Realizar a reunião inicial de alinhamento com o cliente piloto.'
    },
    {
      key: 'customer_trained',
      label: 'Cliente Treinado',
      completed: customer_trained,
      required: true,
      actionUrl: '/app/onboarding',
      description: 'Treinar a equipe administrativa e de liderança do cliente.'
    },
    {
      key: 'pilot_approved',
      label: 'Piloto Aprovado',
      completed: pilot_approved,
      required: true,
      actionUrl: '/app/onboarding',
      description: 'Aprovação formal do escopo e início da fase piloto.'
    },
    {
      key: 'contract_signed',
      label: 'Contrato Assinado',
      completed: contract_signed,
      required: false,
      actionUrl: '/app/onboarding',
      description: 'Assinatura do contrato de prestação de serviços ou termo de adesão.'
    },
    {
      key: 'first_week_review_done',
      label: 'Revisão da Primeira Semana',
      completed: first_week_review_done,
      required: false,
      actionUrl: '/app/onboarding',
      description: 'Acompanhamento e revisão dos indicadores após 7 dias de uso.'
    }
  ];

  // Calculate score based on required items
  const requiredItems = checklistItems.filter(item => item.required);
  const requiredTotal = requiredItems.length;
  const requiredCompleted = requiredItems.filter(item => item.completed).length;
  const score = requiredTotal > 0 ? Math.round((requiredCompleted / requiredTotal) * 100) : 0;

  // pilotReady conditions: no blockers, score >= 80, required items completed
  const pilotReady = blockers.length === 0 && score >= 80 && requiredCompleted === requiredTotal;

  return {
    checklistItems,
    score,
    blockers,
    warnings,
    pilotReady,
    completedItems: checklistItems.filter(item => item.completed).map(item => item.key),
    subscription,
    company
  };
}

export default async function onboardingRoutes(fastify: FastifyInstance) {
  // Require authentication and restrict to ADMIN/HR
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole(['ADMIN', 'HR']));

  // GET /api/onboarding/checklist
  fastify.get('/onboarding/checklist', async (request, reply) => {
    const { companyId } = request.user;

    try {
      const data = await getOnboardingData(companyId);

      return reply.status(200).send({
        success: true,
        data: [
          ...data.checklistItems,
          {
            key: 'pilotReady',
            label: 'Pronto para Operar',
            completed: data.pilotReady,
            required: true,
            actionUrl: '/app/onboarding',
            description: 'Status de prontidão para iniciar a operação oficial.'
          }
        ]
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar checklist de onboarding.',
        },
      });
    }
  });

  // GET /api/onboarding/pilot-readiness
  fastify.get('/onboarding/pilot-readiness', async (request, reply) => {
    const { companyId } = request.user;

    try {
      const data = await getOnboardingData(companyId);

      let nextRecommendedAction = 'Cliente pronto para piloto';
      if (data.blockers.length > 0) {
        nextRecommendedAction = data.blockers[0];
      } else {
        const pendingRequired = data.checklistItems.find(item => item.required && !item.completed);
        if (pendingRequired) {
          nextRecommendedAction = `Concluir etapa obrigatória: ${pendingRequired.label}`;
        } else if (data.warnings.length > 0) {
          nextRecommendedAction = data.warnings[0];
        }
      }

      return reply.status(200).send({
        success: true,
        score: data.score,
        pilotReady: data.pilotReady,
        blockers: data.blockers,
        warnings: data.warnings,
        completedItems: data.completedItems,
        nextRecommendedAction
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao carregar prontidão do piloto.',
        },
      });
    }
  });

  // POST /api/onboarding/manual-step
  fastify.post('/onboarding/manual-step', async (request, reply) => {
    const { companyId } = request.user;
    const bodyResult = manualStepSchema.safeParse(request.body || {});

    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
          details: bodyResult.error.errors,
        },
      });
    }

    const { key, completed, note } = bodyResult.data;
    const sanitizedNote = note ? sanitizeInputString(note, 1000) : null;

    try {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId: request.user.sub,
          action: 'ONBOARDING_STEP_UPDATED',
          entity: 'Company',
          entityId: companyId,
          metadata: {
            key,
            completed,
            note: sanitizedNote
          },
          ip: request.ip,
          userAgent: request.headers['user-agent'] || null
        }
      });

      return reply.status(200).send({
        success: true,
        message: 'Etapa manual atualizada com sucesso.'
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao salvar etapa manual.'
        }
      });
    }
  });

  // POST /api/onboarding/run-pilot-test
  fastify.post('/onboarding/run-pilot-test', async (request, reply) => {
    const { companyId } = request.user;

    const checks: { name: string; status: 'ok' | 'fail' | 'warning'; message: string }[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];

    try {
      const data = await getOnboardingData(companyId);

      // 1. Empresa ativa
      if (data.company && data.company.isActive) {
        checks.push({ name: 'empresa_ativa', status: 'ok', message: 'Empresa ativa e registrada.' });
      } else {
        checks.push({ name: 'empresa_ativa', status: 'fail', message: 'Empresa inativa ou não encontrada.' });
        blockers.push('Empresa inativa ou não encontrada no sistema.');
      }

      // 2. ADMIN/HR ativo
      const adminCount = await prisma.user.count({ where: { companyId, role: 'ADMIN', isActive: true } });
      if (adminCount > 0) {
        checks.push({ name: 'admin_configurado', status: 'ok', message: 'Usuário administrador configurado.' });
      } else {
        checks.push({ name: 'admin_configurado', status: 'fail', message: 'Nenhum administrador ativo encontrado.' });
        blockers.push('Sem administrador ativo na plataforma.');
      }

      // 3. Funcionários ativos
      const employeeCount = await prisma.employee.count({ where: { companyId, status: 'ACTIVE' } });
      if (employeeCount > 0) {
        checks.push({ name: 'funcionarios_ativos', status: 'ok', message: `${employeeCount} funcionário(s) ativo(s) cadastrado(s).` });
      } else {
        checks.push({ name: 'funcionarios_ativos', status: 'fail', message: 'Nenhum funcionário ativo cadastrado.' });
        blockers.push('Sem funcionários ativos cadastrados.');
      }

      // 4. Jornada ativa
      const scheduleCount = await prisma.workSchedule.count({ where: { companyId, isActive: true } });
      if (scheduleCount > 0) {
        checks.push({ name: 'jornada_ativa', status: 'ok', message: `${scheduleCount} jornada(s) ativa(s) encontrada(s).` });
      } else {
        checks.push({ name: 'jornada_ativa', status: 'fail', message: 'Nenhuma jornada de trabalho ativa cadastrada.' });
        blockers.push('Sem jornada de trabalho (escala) ativa.');
      }

      // 5. CompanySettings existente
      const companySettings = await prisma.companySettings.findUnique({ where: { companyId } });
      if (companySettings) {
        checks.push({ name: 'regras_empresa', status: 'ok', message: 'Regras da empresa (CompanySettings) configuradas.' });
      } else {
        checks.push({ name: 'regras_empresa', status: 'fail', message: 'Regras da empresa (CompanySettings) ausentes.' });
        blockers.push('Regras da empresa (CompanySettings) ausentes.');
      }

      // 6. WhatsApp CONNECTED/SIMULATION/SIMULATED
      const whatsappChannel = await prisma.whatsAppChannel.findUnique({ where: { companyId } });
      if (whatsappChannel && (whatsappChannel.status === 'CONNECTED' || whatsappChannel.status === 'SIMULATION' || whatsappChannel.provider === 'SIMULATED')) {
        checks.push({ name: 'whatsapp_configurado', status: 'ok', message: `WhatsApp canal configurado (${whatsappChannel.status}).` });
        if (whatsappChannel.provider === 'SIMULATED' || whatsappChannel.status === 'SIMULATION') {
          warnings.push('WhatsApp operando em modo simulação.');
        }
      } else {
        checks.push({ name: 'whatsapp_configurado', status: 'fail', message: 'Canal de WhatsApp não configurado.' });
        blockers.push('Canal de WhatsApp não configurado.');
      }

      // 7. Plano permite recursos principais
      const sub = data.subscription;
      if (sub && (sub.status === 'ACTIVE' || sub.status === 'TRIALING')) {
        checks.push({ name: 'plano_ativo', status: 'ok', message: `Plano ativo contratado: ${sub.plan.name}.` });
      } else {
        checks.push({ name: 'plano_ativo', status: 'warning', message: 'Sem plano ou assinatura ativa.' });
        warnings.push('Sem plano ou assinatura ativa.');
      }

      // 8. Storage pronto para atestados se habilitado
      if (companySettings?.enableMedicalCertificates) {
        const storagePath = env.STORAGE_PATH || path.resolve(__dirname, '../../storage');
        const tempFilePath = path.join(storagePath, `temp_write_test_${Date.now()}.txt`);
        try {
          if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
          }
          fs.writeFileSync(tempFilePath, 'Technical write test for onboarding readiness');
          fs.unlinkSync(tempFilePath);
          checks.push({ name: 'storage_atestados', status: 'ok', message: 'Diretório de atestados com permissão de escrita.' });
        } catch (e: any) {
          checks.push({ name: 'storage_atestados', status: 'fail', message: `Erro ao testar storage de atestados: ${e.message}` });
          blockers.push('Diretório de atestados inacessível ou sem permissão de escrita.');
        }
      } else {
        checks.push({ name: 'storage_atestados', status: 'warning', message: 'Módulo de atestados desativado nas configurações.' });
        warnings.push('Módulo de atestados desativado nas configurações.');
      }

      const success = blockers.length === 0;

      return reply.status(200).send({
        success,
        checks,
        warnings,
        blockers
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao executar teste de prontidão do piloto.'
        }
      });
    }
  });
}
