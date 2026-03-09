import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface SendMailOptions {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  replyToMessageId?: string;
  attachments?: Array<{
    name: string;
    contentType: string;
    contentBytes: string; // base64
  }>;
  saveToSentItems?: boolean;
}

interface SendResult {
  messageId: string;
  conversationId: string | null;
  internetMessageId: string | null;
  sentAt: string;
}

@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      timeout: 30_000,
    });
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const tenantId = process.env.GRAPH_TENANT_ID;
    const clientId = process.env.GRAPH_CLIENT_ID;
    const clientSecret = process.env.GRAPH_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('Missing GRAPH_TENANT_ID, GRAPH_CLIENT_ID, or GRAPH_CLIENT_SECRET');
    }

    const response = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    this.cachedToken = response.data.access_token;
    this.tokenExpiresAt = now + response.data.expires_in * 1000 - 60_000;
    return this.cachedToken!;
  }

  /**
   * Send a new email (not a reply). Creates a draft first to capture the
   * messageId/conversationId, then sends.
   */
  async sendMail(opts: SendMailOptions): Promise<SendResult> {
    const token = await this.getAccessToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const message: any = {
      subject: opts.subject,
      body: {
        contentType: opts.bodyHtml ? 'HTML' : 'Text',
        content: opts.bodyHtml || opts.bodyText || '',
      },
      toRecipients: opts.to.map((email) => ({ emailAddress: { address: email } })),
    };

    if (opts.cc?.length) {
      message.ccRecipients = opts.cc.map((email) => ({ emailAddress: { address: email } }));
    }

    if (opts.attachments?.length) {
      message.attachments = opts.attachments.map((a) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: a.name,
        contentType: a.contentType,
        contentBytes: a.contentBytes,
      }));
    }

    const draftUrl = `/users/${opts.from}/messages`;
    const draftRes = await this.retryRequest(() =>
      this.http.post(draftUrl, message, { headers }),
    );

    const draft = draftRes.data;
    const graphMessageId: string = draft.id;
    const conversationId: string | null = draft.conversationId || null;
    const internetMessageId: string | null = draft.internetMessageId || null;

    const sendUrl = `/users/${opts.from}/messages/${graphMessageId}/send`;
    await this.retryRequest(() =>
      this.http.post(sendUrl, null, { headers }),
    );

    this.logger.log(
      `Email sent: from=${opts.from} to=${opts.to.join(',')} subject="${opts.subject}" msgId=${graphMessageId}`,
    );

    return {
      messageId: graphMessageId,
      conversationId,
      internetMessageId,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Reply to an existing email in-thread. Used for follow-ups.
   */
  async replyToMessage(
    from: string,
    originalMessageId: string,
    bodyHtml: string,
    attachments?: SendMailOptions['attachments'],
  ): Promise<SendResult> {
    const token = await this.getAccessToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const replyPayload: any = {
      message: {},
      comment: bodyHtml,
    };

    if (attachments?.length) {
      replyPayload.message.attachments = attachments.map((a) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: a.name,
        contentType: a.contentType,
        contentBytes: a.contentBytes,
      }));
    }

    const url = `/users/${from}/messages/${originalMessageId}/replyAll`;
    await this.retryRequest(() =>
      this.http.post(url, replyPayload, { headers }),
    );

    const sentItems = await this.retryRequest(() =>
      this.http.get(
        `/users/${from}/mailFolders/SentItems/messages?$top=1&$orderby=sentDateTime desc&$select=id,conversationId,internetMessageId`,
        { headers },
      ),
    );

    const latest = sentItems.data?.value?.[0];

    this.logger.log(
      `Reply sent in-thread: from=${from} replyTo=${originalMessageId} newMsgId=${latest?.id || 'unknown'}`,
    );

    return {
      messageId: latest?.id || originalMessageId,
      conversationId: latest?.conversationId || null,
      internetMessageId: latest?.internetMessageId || null,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Retry with exponential backoff for Graph API throttling (429).
   */
  private async retryRequest<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const status = err.response?.status;
        if (status === 429 || status === 503 || status === 504) {
          const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '0', 10);
          const delayMs = Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt));
          this.logger.warn(`Graph API ${status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }
}
