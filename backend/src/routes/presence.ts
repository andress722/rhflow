import { FastifyInstance } from 'fastify';
import { RemoteCheckinService } from '../services/remote-checkin.service';
import { prisma } from '../lib/prisma';
import { EventEmitter } from 'events';

export const presenceEmitter = new EventEmitter();

export default async function presenceRoutes(fastify: FastifyInstance) {
  // Apply JWT authentication globally for these routes
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/presence (Lists check-ins for the day)
  fastify.get('/presence', async (request, reply) => {
    const { companyId, role, sub } = request.user;
    const { date, status, employeeId, workModel, sector, managerUserId } = request.query as {
      date?: string;
      status?: string;
      employeeId?: string;
      workModel?: string;
      sector?: string;
      managerUserId?: string;
    };

    try {
      const checkins = await RemoteCheckinService.listCheckins({
        companyId,
        role,
        sub,
        status,
        employeeId,
        date,
        workModel,
        sector,
        managerUserId,
      });

      return reply.status(200).send({
        success: true,
        data: checkins,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao listar presença remota.',
        },
      });
    }
  });

  // GET /api/presence/summary (Dashboard summary counts)
  fastify.get('/presence/summary', async (request, reply) => {
    const { companyId, role, sub } = request.user;
    const { date, graceMinutes } = request.query as {
      date?: string;
      graceMinutes?: string;
    };

    try {
      const summary = await RemoteCheckinService.getSummary({
        companyId,
        role,
        sub,
        date,
        graceMinutes: graceMinutes ? parseInt(graceMinutes, 10) : undefined,
      });

      return reply.status(200).send({
        success: true,
        data: summary,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao calcular sumário de presença.',
        },
      });
    }
  });

  // POST /api/presence/:id/simulate-response
  fastify.post('/presence/:id/simulate-response', async (request, reply) => {
    const { companyId } = request.user;
    const { id } = request.params as { id: string };
    const {
      message,
      latitude,
      longitude,
      selfieUrl,
      clientCapturedAt,
      timezone,
      deviceIdHash,
      offlineEventId,
      offlineSequence,
      previousEventHash,
      payloadHash,
      accuracyMeters,
      syncStatus,
    } = request.body as {
      message: string;
      latitude?: number;
      longitude?: number;
      selfieUrl?: string;
      clientCapturedAt?: string;
      timezone?: string;
      deviceIdHash?: string;
      offlineEventId?: string;
      offlineSequence?: number;
      previousEventHash?: string;
      payloadHash?: string;
      accuracyMeters?: number;
      syncStatus?: string;
    };

    const checkin = await prisma.remoteCheckin.findFirst({
      where: { id, companyId },
      include: { employee: true },
    });

    if (!checkin) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Check-in não encontrado.',
        },
      });
    }

    if (offlineEventId) {
      const existing = await prisma.remoteCheckin.findFirst({
        where: { offlineEventId },
      });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'DUPLICATE_EVENT', message: 'Replay de evento offline bloqueado.' },
        });
      }
    }

    // Validate Payload Integrity and Hashing
    if (payloadHash) {
      const crypto = require('crypto');
      const rawPayloadString = JSON.stringify({
        checkinId: id,
        message,
        latitude,
        longitude,
        selfieUrl,
        clientCapturedAt,
        offlineEventId,
        offlineSequence
      });

      const calculatedSha = crypto.createHash('sha256').update(rawPayloadString).digest('hex');
      
      // Calculate simple fallback hash
      let simpleHash = 0;
      for (let i = 0; i < rawPayloadString.length; i++) {
        const char = rawPayloadString.charCodeAt(i);
        simpleHash = (simpleHash << 5) - simpleHash + char;
        simpleHash = simpleHash & simpleHash;
      }
      const calculatedSimple = 'fallback_hash_' + Math.abs(simpleHash).toString(16);

      if (calculatedSha !== payloadHash && calculatedSimple !== payloadHash) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INTEGRITY_VIOLATION', message: 'Assinatura/Integridade do payload offline adulterada.' },
        });
      }
    }

    // Validate Chronological Sequencing order
    if (offlineSequence && offlineSequence > 1 && previousEventHash) {
      const previousCheckin = await prisma.remoteCheckin.findFirst({
        where: {
          employeeId: checkin.employeeId,
          companyId,
          payloadHash: previousEventHash
        }
      });

      if (!previousCheckin) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'OUT_OF_ORDER_SEQUENCE',
            message: 'Sequência de sincronização offline fora de ordem. Sincronize os eventos anteriores primeiro.'
          }
        });
      }
    }

    try {
      const serverReceivedAt = new Date();
      const capturedDate = clientCapturedAt ? new Date(clientCapturedAt) : serverReceivedAt;

      const result = await RemoteCheckinService.processResponse({
        companyId,
        employeeId: checkin.employeeId,
        message,
        timestamp: capturedDate,
        latitude,
        longitude,
      });

      if (result) {
        const settings = await prisma.companySettings.findUnique({
          where: { companyId },
        });

        let faceMatchScore = null;
        let faceVerificationStatus = 'NOT_VERIFIED';

        if (settings?.enableFacialRecognition) {
          if (selfieUrl) {
            const isMockDivergent = selfieUrl.toLowerCase().includes('divergent') || selfieUrl.toLowerCase().includes('fraud');
            faceMatchScore = isMockDivergent ? 34.2 : 95.8;
            faceVerificationStatus = isMockDivergent ? 'DIVERGENT' : 'CONFIRMED';
          } else {
            faceMatchScore = 0.0;
            faceVerificationStatus = 'DIVERGENT';
          }
        }

        let clockDriftSeconds = 0;
        let offlineEvidenceStatus = 'ACCEPTED';
        if (clientCapturedAt) {
          clockDriftSeconds = Math.abs(Math.floor((serverReceivedAt.getTime() - capturedDate.getTime()) / 1000));
          if (clockDriftSeconds > 60) {
            offlineEvidenceStatus = 'ACCEPTED_WITH_WARNING';
          }
        }

        let geofenceResult = 'UNAVAILABLE';
        if (latitude && longitude) {
          if (accuracyMeters && accuracyMeters > 100) {
            geofenceResult = 'UNCERTAIN';
          } else {
            geofenceResult = checkin.isOutOfBounds ? 'OUTSIDE' : 'INSIDE';
          }
        }

        const updated = await prisma.remoteCheckin.update({
          where: { id: result.checkin.id },
          data: {
            selfieUrl: selfieUrl || null,
            faceMatchScore,
            faceVerificationStatus,
            clientCapturedAt: capturedDate,
            timezone: timezone || 'America/Sao_Paulo',
            deviceIdHash: deviceIdHash || 'mock_device_hash',
            offlineEventId: offlineEventId || null,
            offlineSequence: offlineSequence || null,
            previousEventHash: previousEventHash || null,
            payloadHash: payloadHash || null,
            syncStatus: syncStatus || 'ONLINE',
            clockDriftSeconds,
            offlineEvidenceStatus,
            accuracyMeters: accuracyMeters || null,
            geofenceResult,
          },
          include: {
            employee: {
              select: { id: true, fullName: true, sector: true, jobTitle: true },
            },
          },
        });

        // Publish live event
        presenceEmitter.emit('new_checkin', { companyId, checkin: updated });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Erro ao simular resposta do check-in.',
        },
      });
    }
  });

  // GET /api/presence/live-feed (Real-time SSE Radar feed)
  fastify.get('/presence/live-feed', async (request, reply) => {
    const { companyId } = request.user;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const onNewCheckin = (data: { companyId: string; checkin: any }) => {
      // Multitenant isolation check
      if (data.companyId === companyId) {
        reply.raw.write(`data: ${JSON.stringify(data.checkin)}\n\n`);
      }
    };

    presenceEmitter.on('new_checkin', onNewCheckin);

    // Keep-alive heartbeat every 15 seconds
    const interval = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(interval);
      presenceEmitter.off('new_checkin', onNewCheckin);
    });
  });
}
