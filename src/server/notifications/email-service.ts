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
  attachments?: Array<{
    filename: string;
    contentType?: string;
    content: Buffer;
  }>;
}

export interface EmailServiceResult {
  providerMsgId?: string;
}

export interface IEmailService {
  send(message: EmailMessage): Promise<EmailServiceResult>;
}

class ResendEmailService implements IEmailService {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(message: EmailMessage): Promise<EmailServiceResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString('base64')
        }))
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `[Resend] Failed to send email: ${response.status} ${body}`
      );
    }

    const data = (await response.json()) as { id?: string };
    return { providerMsgId: data.id };
  }
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
      attachments: message.attachments?.map((a) => a.filename) ?? []
    });
    return { providerMsgId: `mock-${Date.now()}` };
  }
}

function createEmailService(): IEmailService {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (resendApiKey && emailFrom) {
    return new ResendEmailService(resendApiKey, emailFrom);
  }

  return new ConsoleEmailService();
}

export const emailService: IEmailService = createEmailService();
