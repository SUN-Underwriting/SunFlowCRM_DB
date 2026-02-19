/**
 * Email delivery service interface.
 *
 * v1: console/log mock — swap for SendGrid/SES/SMTP in production.
 * v2: inject provider via environment variable or tenant config.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body — if not provided, text is used. */
  html?: string;
}

export interface EmailServiceResult {
  providerMsgId?: string;
}

export interface IEmailService {
  send(message: EmailMessage): Promise<EmailServiceResult>;
}

/**
 * Console mock for development/testing.
 * Replace with real implementation before production use.
 */
class ConsoleEmailService implements IEmailService {
  async send(message: EmailMessage): Promise<EmailServiceResult> {
    console.log('[EmailService] [MOCK] Sending email:', {
      to: message.to,
      subject: message.subject,
    });
    return { providerMsgId: `mock-${Date.now()}` };
  }
}

export const emailService: IEmailService = new ConsoleEmailService();
