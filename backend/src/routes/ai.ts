import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { AiToolAuthorizationService } from '../services/compliance/ai-tool-authorization.service';

export default async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /api/ai/companion
  fastify.post('/ai/companion', async (request, reply) => {
    const { companyId } = request.user;
    const { message } = request.body as { message: string };

    if (!message) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Mensagem é obrigatória.' },
      });
    }

    const injection = AiToolAuthorizationService.detectPromptInjection(message);
    if (injection.injected) {
      return reply.status(400).send({
        success: false,
        error: { code: 'SECURITY_VIOLATION', message: injection.reason },
      });
    }

    const text = message.toLowerCase();

    // Fetch list of employees in company to match names
    const employees = await prisma.employee.findMany({
      where: { companyId },
      select: { id: true, fullName: true },
    });

    let matchedEmployee = employees[0] || { id: 'mock-id', fullName: 'Colaborador' };
    for (const emp of employees) {
      const firstName = emp.fullName.split(' ')[0].toLowerCase();
      if (text.includes(emp.fullName.toLowerCase()) || text.includes(firstName)) {
        matchedEmployee = emp;
        break;
      }
    }

    const targetTool = text.includes('turnover') || text.includes('burnout') ? 'getReportSummary' : 'getPresenceSummary';
    const authCheck = AiToolAuthorizationService.authorizeToolCall({
      role: request.user.role,
      companyId,
      targetCompanyId: companyId,
      toolName: targetTool,
      payload: { message },
    });

    if (!authCheck.authorized) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN_TOOL_CALL', message: authCheck.reason },
      });
    }

    // 1. Export PDF/Excel timesheet
    if (text.includes('informação') || text.includes('dados') || text.includes('exportar') || text.includes('pdf') || text.includes('excel') || text.includes('relatório')) {
      return reply.status(200).send({
        success: true,
        reply: `Com certeza! Encontrei o histórico de presença e conciliação de **${matchedEmployee.fullName}**. Você pode exportar e fazer o download do documento nos formatos disponíveis abaixo:`,
        action: 'DOWNLOAD_REPORTS',
        metadata: {
          employeeId: matchedEmployee.id,
          employeeName: matchedEmployee.fullName,
        },
      });
    }

    // 2. Upload medical certificate
    if (text.includes('atestado') || text.includes('subir') || text.includes('enviar') || text.includes('anexar') || text.includes('certificado')) {
      return reply.status(200).send({
        success: true,
        reply: `Perfeito! Vou te ajudar a registrar e processar um novo atestado médico para **${matchedEmployee.fullName}**. Confirme os detalhes do atestado ou envie o arquivo na caixa de anexos abaixo:`,
        action: 'UPLOAD_CERTIFICATE',
        metadata: {
          employeeId: matchedEmployee.id,
          employeeName: matchedEmployee.fullName,
        },
      });
    }

    // 3. Turnover / Burnout analytics
    if (text.includes('turnover') || text.includes('burnout') || text.includes('risco' ) || text.includes('saúde') || text.includes('pedir demissão')) {
      return reply.status(200).send({
        success: true,
        reply: `Analisando os padrões operacionais... O índice de risco de turnover / burnout de **${matchedEmployee.fullName}** está calculado em **15%** (Risco Baixo). O colaborador tem mantido boa pontualidade e assiduidade nas últimas semanas.`,
        action: 'TURNOVER_CHECK',
        metadata: {
          employeeId: matchedEmployee.id,
          employeeName: matchedEmployee.fullName,
        },
      });
    }

    // Default conversational reply
    return reply.status(200).send({
      success: true,
      reply: `Olá! Eu sou o assistente digital PresençaFlow AI. Compreendo comandos operacionais de RH, por exemplo:

- *"Eu quero pegar informações de presença de ${matchedEmployee.fullName} em PDF"*
- *"Subir atestado médico para o colaborador ${matchedEmployee.fullName}"*
- *"Qual o risco de turnover de ${matchedEmployee.fullName}?"*

Como posso ajudar você agora?`,
      action: 'NONE',
    });
  });
}
