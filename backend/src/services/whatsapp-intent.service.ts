import { OccurrenceType } from '@prisma/client';

export class WhatsAppIntentService {
  /**
   * Classifies user intent from a WhatsApp message using text matching rules
   */
  static classifyIntent(message: string): OccurrenceType {
    const text = message.toLowerCase().trim();

    // "vou faltar" / "não vou hoje" / "faltei" -> ABSENCE
    if (text.includes('vou faltar') || text.includes('não vou hoje') || text.includes('nao vou hoje') || text.includes('faltei')) {
      return OccurrenceType.ABSENCE;
    }

    // "estou atrasado" / "vou atrasar" -> LATE_ARRIVAL
    if (text.includes('estou atrasado') || text.includes('vou atrasar') || text.includes('atrasar') || text.includes('atrasado')) {
      return OccurrenceType.LATE_ARRIVAL;
    }

    // "sem internet" / "internet caiu" / "sem energia" -> REMOTE_TECHNICAL_ISSUE
    if (text.includes('sem internet') || text.includes('internet caiu') || text.includes('sem energia') || text.includes('caiu a internet') || text.includes('caiu a luz')) {
      return OccurrenceType.REMOTE_TECHNICAL_ISSUE;
    }

    // "esqueci de bater" / "não bati ponto" -> MISSED_CLOCK_IN
    if (text.includes('esqueci de bater') || text.includes('não bati ponto') || text.includes('nao bati ponto') || text.includes('esqueci o ponto')) {
      return OccurrenceType.MISSED_CLOCK_IN;
    }

    // "consulta" / "médico" -> TEMPORARY_ABSENCE
    if (text.includes('consulta') || text.includes('médico') || text.includes('medico') || text.includes('dentista')) {
      return OccurrenceType.TEMPORARY_ABSENCE;
    }

    // "atestado" -> MEDICAL_CERTIFICATE
    if (text.includes('atestado') || text.includes('enviar atestado')) {
      return OccurrenceType.MEDICAL_CERTIFICATE;
    }

    // Default to ABSENCE if no match
    return OccurrenceType.ABSENCE;
  }
}
