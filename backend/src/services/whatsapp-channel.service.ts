import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import { WhatsAppProvider, WhatsAppChannelStatus, WhatsAppMessageDirection, WhatsAppMessageStatus } from '@prisma/client';
import { RemoteCheckinService } from './remote-checkin.service';
import { WhatsAppIntentService } from './whatsapp-intent.service';
import { OccurrenceService } from './occurrence.service';
import { OccurrenceSource } from '@prisma/client';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || 'dev-safe-encryption-secret-default-32-chars';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptToken(token: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptToken(encryptedText: string): string {
  const key = getKey();
  const parts = encryptedText.split(':');
  if (parts.length < 3) {
    throw new Error('Formato de token criptografado inválido.');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskSecret(secret: string | null): string | null {
  if (!secret) return null;
  if (secret.length <= 8) return 'sec_***';
  return `${secret.substring(0, 4)}***${secret.substring(secret.length - 4)}`;
}

export function sanitizeProviderConfig(config: any, provider: string): any {
  if (!config || typeof config !== 'object') return {};
  const clean: any = {};
  if (provider === 'META_CLOUD') {
    const allowedKeys = ['phoneNumberId', 'businessAccountId', 'apiVersion'];
    for (const key of allowedKeys) {
      if (config[key] !== undefined) {
        clean[key] = String(config[key]);
      }
    }
  } else {
    const sensitiveWords = ['accesstoken', 'token', 'secret', 'password', 'authorization'];
    for (const key of Object.keys(config)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveWords.some(word => lowerKey.includes(word));
      if (!isSensitive) {
        clean[key] = config[key];
      }
    }
  }
  return clean;
}

function sanitizeMetadata(meta: any): any {
  if (!meta || typeof meta !== 'object') return {};
  const clean: any = {};
  const sensitiveWords = ['accesstoken', 'token', 'secret', 'password', 'authorization'];
  for (const key of Object.keys(meta)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveWords.some(word => lowerKey.includes(word));
    if (!isSensitive) {
      clean[key] = meta[key];
    }
  }
  return clean;
}

export class WhatsAppChannelService {
  static async getOrCreateSimulatedChannel(companyId: string) {
    let channel = await prisma.whatsAppChannel.findUnique({
      where: { companyId },
    });

    if (!channel) {
      channel = await prisma.whatsAppChannel.create({
        data: {
          companyId,
          provider: WhatsAppProvider.SIMULATED,
          status: WhatsAppChannelStatus.SIMULATION,
          channelKey: crypto.randomUUID(),
          webhookSecret: `sec_${crypto.randomBytes(16).toString('hex')}`,
          providerConfig: {},
        },
      });
    }

    return channel;
  }

  static async getChannelByKey(channelKey: string) {
    return prisma.whatsAppChannel.findUnique({
      where: { channelKey },
    });
  }

  static async recordInbound(
    companyId: string,
    provider: WhatsAppProvider,
    to: string,
    from: string,
    body: string,
    status: WhatsAppMessageStatus,
    metadata?: any
  ) {
    await prisma.whatsAppMessageLog.create({
      data: {
        companyId,
        direction: WhatsAppMessageDirection.INBOUND,
        provider,
        to,
        from,
        body: body.substring(0, 4000),
        status,
        metadata: sanitizeMetadata(metadata),
      },
    });

    await prisma.whatsAppChannel.updateMany({
      where: { companyId },
      data: { lastInboundAt: new Date() },
    });
  }

  static async recordOutbound(
    companyId: string,
    provider: WhatsAppProvider,
    to: string,
    from: string,
    body: string,
    status: WhatsAppMessageStatus,
    metadata?: any
  ) {
    await prisma.whatsAppMessageLog.create({
      data: {
        companyId,
        direction: WhatsAppMessageDirection.OUTBOUND,
        provider,
        to,
        from,
        body: body.substring(0, 4000),
        status,
        metadata: sanitizeMetadata(metadata),
      },
    });

    await prisma.whatsAppChannel.updateMany({
      where: { companyId },
      data: { lastOutboundAt: new Date() },
    });
  }

  static async recordError(channelId: string, errorMessage: string) {
    await prisma.whatsAppChannel.update({
      where: { id: channelId },
      data: {
        status: WhatsAppChannelStatus.ERROR,
        lastError: errorMessage,
      },
    });
  }

  static async sendMessage(
    companyId: string,
    to: string,
    message: string,
    metadata?: any
  ): Promise<{ success: boolean; messageId: string }> {
    let channel = await prisma.whatsAppChannel.findUnique({
      where: { companyId },
    });

    if (!channel) {
      channel = await this.getOrCreateSimulatedChannel(companyId);
    }

    const bodyLog = message.substring(0, 4000);

    if (channel.provider === WhatsAppProvider.SIMULATED) {
      const messageId = `sim_${crypto.randomBytes(8).toString('hex')}`;
      console.log(`[WhatsApp Simulated Outbound] Co: ${companyId} To: ${to} Msg: "${message}"`);
      
      await this.recordOutbound(
        companyId,
        WhatsAppProvider.SIMULATED,
        to,
        channel.phoneNumber || 'simulated-system',
        bodyLog,
        WhatsAppMessageStatus.SIMULATED,
        metadata
      );

      return { success: true, messageId };
    }

    if (channel.provider === WhatsAppProvider.META_CLOUD) {
      if (!channel.accessTokenEnc) {
        const errorMsg = 'Meta Cloud Access Token não configurado.';
        await this.recordError(channel.id, errorMsg);
        await this.recordOutbound(
          companyId,
          WhatsAppProvider.META_CLOUD,
          to,
          channel.phoneNumber || 'meta-cloud',
          bodyLog,
          WhatsAppMessageStatus.FAILED,
          { error: errorMsg, ...metadata }
        );
        return { success: false, messageId: '' };
      }

      let accessToken = '';
      try {
        accessToken = decryptToken(channel.accessTokenEnc);
      } catch (err: any) {
        const errorMsg = `Erro ao descriptografar token: ${err.message}`;
        await this.recordError(channel.id, errorMsg);
        await this.recordOutbound(
          companyId,
          WhatsAppProvider.META_CLOUD,
          to,
          channel.phoneNumber || 'meta-cloud',
          bodyLog,
          WhatsAppMessageStatus.FAILED,
          { error: errorMsg, ...metadata }
        );
        return { success: false, messageId: '' };
      }

      const config: any = channel.providerConfig || {};
      const phoneNumberId = config.phoneNumberId;
      const apiVersion = config.apiVersion || 'v18.0';

      if (!phoneNumberId) {
        const errorMsg = 'providerConfig.phoneNumberId não configurado para Meta Cloud.';
        await this.recordError(channel.id, errorMsg);
        await this.recordOutbound(
          companyId,
          WhatsAppProvider.META_CLOUD,
          to,
          channel.phoneNumber || 'meta-cloud',
          bodyLog,
          WhatsAppMessageStatus.FAILED,
          { error: errorMsg, ...metadata }
        );
        return { success: false, messageId: '' };
      }

      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: message },
          }),
        });

        const json = await response.json() as any;

        if (response.ok && json.messages?.[0]?.id) {
          const messageId = json.messages[0].id;
          
          // Set status to CONNECTED upon successful real transmission
          await prisma.whatsAppChannel.update({
            where: { id: channel.id },
            data: {
              status: WhatsAppChannelStatus.CONNECTED,
              lastError: null,
            },
          });

          await this.recordOutbound(
            companyId,
            WhatsAppProvider.META_CLOUD,
            to,
            channel.phoneNumber || 'meta-cloud',
            bodyLog,
            WhatsAppMessageStatus.SENT,
            { ...metadata, metaResponse: json }
          );

          return { success: true, messageId };
        } else {
          const errorMsg = json.error?.message || `Meta API error (status: ${response.status})`;
          await this.recordError(channel.id, errorMsg);
          await this.recordOutbound(
            companyId,
            WhatsAppProvider.META_CLOUD,
            to,
            channel.phoneNumber || 'meta-cloud',
            bodyLog,
            WhatsAppMessageStatus.FAILED,
            { error: errorMsg, metaResponse: json, ...metadata }
          );
          return { success: false, messageId: '' };
        }
      } catch (err: any) {
        const errorMsg = `Exceção de rede: ${err.message}`;
        await this.recordError(channel.id, errorMsg);
        await this.recordOutbound(
          companyId,
          WhatsAppProvider.META_CLOUD,
          to,
          channel.phoneNumber || 'meta-cloud',
          bodyLog,
          WhatsAppMessageStatus.FAILED,
          { error: errorMsg, ...metadata }
        );
        return { success: false, messageId: '' };
      }
    }

    return { success: false, messageId: '' };
  }

  static validateWebhook(channel: any, headers: any, rawPayload: string): boolean {
    const signature = headers['x-hub-signature-256'] as string;
    if (!signature) return false;

    const parts = signature.split('=');
    if (parts.length < 2 || parts[0] !== 'sha256') return false;
    const hexSig = parts[1];

    const secret = channel.webhookSecret;
    if (!secret) return false;

    const expected = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

    try {
      const bufferHexSig = Buffer.from(hexSig, 'hex');
      const bufferExpected = Buffer.from(expected, 'hex');
      if (bufferHexSig.length !== bufferExpected.length) return false;
      return crypto.timingSafeEqual(bufferHexSig, bufferExpected);
    } catch (e) {
      return false;
    }
  }

  static normalizeInboundMessage(provider: WhatsAppProvider, payload: any) {
    if (provider === WhatsAppProvider.SIMULATED) {
      return {
        from: String(payload.from),
        message: String(payload.message),
        timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      };
    }

    if (provider === WhatsAppProvider.META_CLOUD) {
      const messageObj = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!messageObj) return null;

      const from = messageObj.from;
      const body = messageObj.text?.body;
      const timestamp = messageObj.timestamp ? new Date(Number(messageObj.timestamp) * 1000) : new Date();

      if (from && body) {
        return { from, message: body, timestamp };
      }
    }

    return null;
  }

  static async processInboundMessage(
    companyId: string,
    from: string,
    message: string,
    timestamp: Date
  ) {
    const cleanFrom = from.replace(/\D/g, '');

    const employee = await prisma.employee.findFirst({
      where: {
        companyId,
        whatsapp: {
          contains: cleanFrom.length >= 11 ? cleanFrom.substring(cleanFrom.length - 11) : cleanFrom,
        },
        status: 'ACTIVE',
      },
    });

    if (!employee) {
      return {
        success: false,
        error: 'EMPLOYEE_NOT_FOUND',
        message: `Nenhum funcionário ativo localizado para o número ${from} na empresa selecionada.`,
      };
    }

    const checkinResult = await RemoteCheckinService.processResponse({
      companyId,
      employeeId: employee.id,
      message,
      timestamp,
    });

    if (checkinResult) {
      return {
        success: true,
        type: 'CHECKIN_RESPONSE',
        data: checkinResult.checkin,
        linkedOccurrence: checkinResult.occurrence || null,
      };
    }

    const occurrenceType = WhatsAppIntentService.classifyIntent(message);

    const titleMap: Record<string, string> = {
      ABSENCE: 'Ausência reportada pelo WhatsApp',
      LATE_ARRIVAL: 'Atraso reportado pelo WhatsApp',
      REMOTE_TECHNICAL_ISSUE: 'Instabilidade técnica remota',
      MISSED_CLOCK_IN: 'Ponto não registrado - Entrada',
      MISSED_CLOCK_OUT: 'Ponto não registrado - Saída',
      TEMPORARY_ABSENCE: 'Ausência temporária',
      MEDICAL_CERTIFICATE: 'Atestado médico informado',
    };

    const title = titleMap[occurrenceType] || 'Ocorrência via WhatsApp';

    const { occurrence, isDuplicate } = await OccurrenceService.createOccurrence({
      companyId,
      employeeId: employee.id,
      type: occurrenceType,
      title,
      description: message,
      occurrenceDate: timestamp,
      source: OccurrenceSource.WHATSAPP,
      severity: 'MEDIUM',
      managerUserId: employee.managerUserId || undefined,
      actorType: 'WHATSAPP',
      metadata: { from, rawMessage: message, timestamp: timestamp.toISOString() },
    });

    if (!isDuplicate) {
      await prisma.occurrenceEvent.create({
        data: {
          companyId,
          occurrenceId: occurrence.id,
          actorType: 'WHATSAPP',
          eventType: 'WHATSAPP_INBOUND_RECEIVED',
          message: `Mensagem recebida via WhatsApp (Inbound): "${message}"`,
          metadata: {
            from,
            message,
            timestamp: timestamp.toISOString(),
            intent: occurrenceType,
          },
        },
      });
    }

    return {
      success: true,
      type: 'OCCURRENCE_CREATED',
      data: occurrence,
      isDuplicate,
    };
  }
}
