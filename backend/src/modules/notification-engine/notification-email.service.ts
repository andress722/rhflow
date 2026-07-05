import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../../config';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type SendEmailResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE' | 'NOTIFICATION_PROVIDER_UNAVAILABLE' | 'NOTIFICATION_PROVIDER_TIMEOUT'; error?: string };

/**
 * Thin Nodemailer wrapper. If SMTP is not configured, every send() call
 * reports NOTIFICATION_CHANNEL_UNAVAILABLE explicitly — it never reports a
 * fabricated success.
 */
export class NotificationEmailService {
  private static transporter: Transporter | null | undefined;

  private static getTransporter(): Transporter | null {
    if (this.transporter !== undefined) return this.transporter;

    if (!config.smtp.host || !config.smtp.port) {
      this.transporter = null;
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user && config.smtp.password
        ? { user: config.smtp.user, pass: config.smtp.password }
        : undefined,
    });
    return this.transporter;
  }

  static isConfigured(): boolean {
    return this.getTransporter() !== null;
  }

  static async send(input: SendEmailInput): Promise<SendEmailResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { ok: false, reasonCode: 'NOTIFICATION_CHANNEL_UNAVAILABLE' };
    }

    try {
      const info = await transporter.sendMail({
        from: config.smtp.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return { ok: true, providerMessageId: info.messageId };
    } catch (err: any) {
      const code = err?.code as string | undefined;
      const isTimeoutOrTransient = code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ESOCKET' || err?.responseCode >= 500;
      return {
        ok: false,
        reasonCode: isTimeoutOrTransient ? 'NOTIFICATION_PROVIDER_TIMEOUT' : 'NOTIFICATION_PROVIDER_UNAVAILABLE',
        error: String(err?.message || err),
      };
    }
  }
}
