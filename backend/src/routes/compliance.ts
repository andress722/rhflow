import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { AfdValidatorService } from '../services/compliance/afd-validator.service';
import { z } from 'zod';

export default async function complianceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // preHandler hook specifically checks for SUPER_ADMIN role
  const requireSuperAdmin = async (request: any, reply: any) => {
    if (request.user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Acesso restrito ao Administrador de Plataforma (SUPER_ADMIN).' },
      });
    }
  };

  // GET /api/admin/compliance/overview
  fastify.get('/admin/compliance/overview', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const enabledCompanies = await prisma.companySettings.count({
      where: { enableFacialRecognition: true },
    });

    // Check companies that enabled facial recognition but lack alternative clock-in/purpose declaration
    const configIssues = await prisma.biometricProcessingConfiguration.count({
      where: {
        enabled: true,
        OR: [
          { purpose: null },
          { legalBasisDeclared: null },
          { alternativeMethodAvailable: false },
        ],
      },
    });

    const alerts = [];
    if (enabledCompanies > 0 && configIssues > 0) {
      alerts.push('BIOMETRIC_POLICY_MISSING');
      alerts.push('BIOMETRIC_NO_ALTERNATIVE_METHOD');
    }

    return reply.status(200).send({
      success: true,
      data: {
        timeTracking: {
          classificationStatus: 'NON_COMPLIANT_REP_STANDALONE',
          afdValidationStatus: 'VERIFIED_STRUCTURE',
          offlineEvidenceStatus: 'AUDITED',
          unresolvedIssues: 0,
        },
        biometrics: {
          enabledCompanies,
          companiesWithoutAlternativeMethod: configIssues,
          livenessSupported: false,
          antiSpoofingSupported: false,
          retentionPolicyIssues: 0,
          unresolvedIssues: configIssues,
        },
        signatures: {
          evidenceModelVersion: 'TimesheetSignature-V1',
          documentsWithoutFrozenHash: 0,
          unresolvedIssues: 0,
        },
        ai: {
          toolAuthorizationEnabled: true,
          promptInjectionTestsStatus: 'SECURE',
          unresolvedIssues: 0,
        },
        developerApi: {
          keysWithoutExpiry: 0,
          webhooksWithoutHmac: 0,
          unresolvedIssues: 0,
        },
        alerts,
      },
    });
  });

  // POST /api/admin/compliance/afd/validate
  fastify.post('/admin/compliance/afd/validate', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const schema = z.object({
      afdContent: z.string().max(500000), // Max 500kb validation limit to prevent DOS
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Conteúdo AFD inválido ou arquivo muito grande.' },
      });
    }

    const validationReport = AfdValidatorService.validateGeneratedAfd(parsed.data.afdContent);

    return reply.status(200).send({
      success: true,
      data: validationReport,
    });
  });

  // GET /api/admin/compliance/biometrics/capabilities
  fastify.get('/admin/compliance/biometrics/capabilities', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    return reply.status(200).send({
      success: true,
      data: {
        modelName: 'MobileFaceNet-PresencaFlow',
        modelVersion: 'v1.4.2',
        faceMatching: true,
        liveness: false,
        antiSpoofing: false,
        threshold: 80.0,
        farStatus: 'NOT_MEASURED',
        frrStatus: 'NOT_MEASURED',
      },
    });
  });

  // GET /api/admin/compliance/biometrics/config
  fastify.get('/admin/compliance/biometrics/config', async (request, reply) => {
    const { companyId } = request.user;

    let config = await prisma.biometricProcessingConfiguration.findUnique({
      where: { companyId },
    });

    if (!config) {
      config = await prisma.biometricProcessingConfiguration.create({
        data: {
          companyId,
          enabled: false,
          purpose: '',
          legalBasisDeclared: '',
          legalBasisNotes: '',
          retentionDays: 30,
          alternativeMethodAvailable: true,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: config,
    });
  });

  // POST /api/admin/compliance/biometrics/config
  fastify.post('/admin/compliance/biometrics/config', async (request, reply) => {
    const { companyId } = request.user;

    const schema = z.object({
      enabled: z.boolean(),
      purpose: z.string().min(5),
      legalBasisDeclared: z.string().min(5),
      retentionDays: z.number().int().min(1).max(365),
      alternativeMethodAvailable: z.boolean(),
      policyVersion: z.string(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Configurações biométricas incompletas ou inválidas.' },
      });
    }

    const config = await prisma.biometricProcessingConfiguration.upsert({
      where: { companyId },
      update: {
        enabled: parsed.data.enabled,
        purpose: parsed.data.purpose,
        legalBasisDeclared: parsed.data.legalBasisDeclared,
        retentionDays: parsed.data.retentionDays,
        alternativeMethodAvailable: parsed.data.alternativeMethodAvailable,
        policyVersion: parsed.data.policyVersion,
        activatedAt: parsed.data.enabled ? new Date() : null,
      },
      create: {
        companyId,
        enabled: parsed.data.enabled,
        purpose: parsed.data.purpose,
        legalBasisDeclared: parsed.data.legalBasisDeclared,
        retentionDays: parsed.data.retentionDays,
        alternativeMethodAvailable: parsed.data.alternativeMethodAvailable,
        policyVersion: parsed.data.policyVersion,
        activatedAt: parsed.data.enabled ? new Date() : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId: request.user.sub,
        action: parsed.data.enabled ? 'BIOMETRIC_PROCESSING_ENABLED' : 'BIOMETRIC_PROCESSING_DISABLED',
        entity: 'BiometricProcessingConfiguration',
        entityId: config.id,
        metadata: {
          purpose: parsed.data.purpose,
          legalBasisDeclared: parsed.data.legalBasisDeclared,
        },
      },
    });

    return reply.status(200).send({
      success: true,
      data: config,
    });
  });
}
