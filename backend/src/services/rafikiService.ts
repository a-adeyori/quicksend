/**
 * Server-side Rafiki / ILP Service
 *
 * This service runs on your backend and holds the platform-level
 * GNAP service token. The mobile client never touches Rafiki directly —
 * it calls your API, and your API talks to Rafiki.
 *
 * Architecture:
 *
 *   Mobile App
 *       │  REST (JWT-authenticated)
 *       ▼
 *   QuickSend API  ◄──── Rafiki Webhooks
 *       │  GNAP (service token)
 *       ▼
 *   Rafiki Instance
 *       │  ILP/STREAM
 *       ▼
 *   Recipient Wallet
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletAddressInfo {
  id: string;
  publicName?: string;
  assetCode: string;
  assetScale: number;
  authServer: string;
  resourceServer: string;
}

export interface RafikiQuote {
  id: string;
  walletAddress: string;
  receiver: string;
  debitAmount: AmountSpec;
  receiveAmount: AmountSpec;
  expiresAt: string;
  createdAt: string;
  method: 'ilp';
}

export interface AmountSpec {
  value: string;
  assetCode: string;
  assetScale: number;
}

export interface RafikiOutgoingPayment {
  id: string;
  walletAddress: string;
  quoteId: string;
  state: 'FUNDING' | 'SENDING' | 'COMPLETED' | 'FAILED';
  debitAmount: AmountSpec;
  receiveAmount: AmountSpec;
  sentAmount: AmountSpec;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
  error?: string;
}

export interface RafikiIncomingPayment {
  id: string;
  walletAddress: string;
  state: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'EXPIRED';
  incomingAmount?: AmountSpec;
  receivedAmount: AmountSpec;
  expiresAt?: string;
  createdAt: string;
  ilpStreamConnection?: string;
}

export interface GrantResponse {
  access_token?: {
    value: string;
    manage: string;
    expires_in?: number;
    access: GrantAccess[];
  };
  interact?: {
    redirect: string;
    finish: string;
  };
  continue?: {
    access_token: { value: string };
    uri: string;
    wait?: number;
  };
}

export interface GrantAccess {
  type: string;
  actions: string[];
  identifier?: string;
  limits?: {
    debitAmount?: AmountSpec;
    receiveAmount?: AmountSpec;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function dollarsToUnits(dollars: number, scale: number): string {
  return Math.round(dollars * Math.pow(10, scale)).toString();
}

export function unitsToDollars(units: string, scale: number): number {
  return parseInt(units, 10) / Math.pow(10, scale);
}

export function formatCurrency(units: string, scale: number, code: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
  }).format(unitsToDollars(units, scale));
}

// ─── RafikiService ────────────────────────────────────────────────────────────

export class RafikiService {
  private readonly authClient: AxiosInstance;
  private readonly resourceClient: AxiosInstance;

  constructor() {
    this.authClient = axios.create({
      baseURL: config.rafikiAuthServerUrl,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15_000,
    });

    this.resourceClient = axios.create({
      baseURL: config.rafikiResourceServerUrl,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15_000,
    });

    // Response interceptor for uniform error handling
    [this.authClient, this.resourceClient].forEach((client) => {
      client.interceptors.response.use(
        (res) => res,
        (err) => {
          const status = err.response?.status;
          const message = err.response?.data?.message ?? err.message;
          logger.warn('Rafiki API error', { status, message, url: err.config?.url });
          throw AppError.ilpError(`Rafiki error (${status}): ${message}`);
        }
      );
    });
  }

  // ── Wallet Address ────────────────────────────────────────────────────────

  /**
   * Resolve an Open Payments wallet address URL.
   * Used to validate recipient addresses and fetch asset info.
   */
  async resolveWalletAddress(url: string): Promise<WalletAddressInfo> {
    const res = await axios.get<WalletAddressInfo>(url, {
      headers: { Accept: 'application/json' },
      timeout: 10_000,
    });
    return res.data;
  }

  // ── Grants ────────────────────────────────────────────────────────────────

  /**
   * Request a non-interactive (service-to-service) outgoing-payment grant.
   * Used for platform-initiated transfers using the service token.
   */
  async requestOutgoingPaymentGrant(
    walletAddress: string,
    debitAmountUnits: string,
    assetCode: string,
    assetScale: number
  ): Promise<string> {
    const body = {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['create', 'read', 'list'],
            identifier: walletAddress,
            limits: {
              debitAmount: { value: debitAmountUnits, assetCode, assetScale },
            },
          },
        ],
      },
      client: config.platformWalletAddress,
    };

    const res = await this.authClient.post<GrantResponse>('/', body);
    const grant = res.data;

    if (!grant.access_token?.value) {
      // Interactive grant — shouldn't happen for service accounts
      throw AppError.ilpError('Unexpected interactive grant from Rafiki auth server');
    }

    return grant.access_token.value;
  }

  /**
   * Request a grant for creating incoming payments (receiving money).
   */
  async requestIncomingPaymentGrant(walletAddress: string): Promise<string> {
    const body = {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['create', 'read', 'list', 'complete'],
            identifier: walletAddress,
          },
        ],
      },
      client: config.platformWalletAddress,
    };

    const res = await this.authClient.post<GrantResponse>('/', body);
    const grant = res.data;

    if (!grant.access_token?.value) {
      throw AppError.ilpError('Failed to obtain incoming-payment grant');
    }

    return grant.access_token.value;
  }

  // ── Incoming Payments ─────────────────────────────────────────────────────

  /**
   * Create an incoming payment at the receiver's wallet.
   * Returns the incoming payment ID which is used as the "receiver" in quotes.
   */
  async createIncomingPayment(
    receiverWalletAddress: string,
    accessToken: string,
    options?: {
      incomingAmountUnits?: string;
      assetCode?: string;
      assetScale?: number;
      expiresAt?: Date;
      metadata?: Record<string, string>;
    }
  ): Promise<RafikiIncomingPayment> {
    const body: Record<string, unknown> = {
      walletAddress: receiverWalletAddress,
    };

    if (options?.incomingAmountUnits && options?.assetCode && options?.assetScale !== undefined) {
      body.incomingAmount = {
        value: options.incomingAmountUnits,
        assetCode: options.assetCode,
        assetScale: options.assetScale,
      };
    }

    if (options?.expiresAt) {
      body.expiresAt = options.expiresAt.toISOString();
    }

    if (options?.metadata) {
      body.metadata = options.metadata;
    }

    const res = await this.resourceClient.post<RafikiIncomingPayment>(
      '/incoming-payments',
      body,
      { headers: { Authorization: `GNAP ${accessToken}` } }
    );

    return res.data;
  }

  // ── Quotes ────────────────────────────────────────────────────────────────

  /**
   * Create a payment quote. Always do this before creating an outgoing payment.
   * The quote locks in the exchange rate and calculates fees.
   *
   * @param senderWalletAddress - The sender's wallet address URL
   * @param incomingPaymentUrl  - URL of the incoming payment at recipient's wallet
   * @param debitAmountUnits    - Amount to debit (in smallest unit)
   * @param assetCode           - Asset code (e.g. "USD")
   * @param assetScale          - Asset scale (e.g. 2 for USD cents)
   * @param accessToken         - GNAP token with outgoing-payment:create access
   */
  async createQuote(
    senderWalletAddress: string,
    incomingPaymentUrl: string,
    debitAmountUnits: string,
    assetCode: string,
    assetScale: number,
    accessToken: string
  ): Promise<RafikiQuote> {
    const body = {
      walletAddress: senderWalletAddress,
      receiver: incomingPaymentUrl,
      debitAmount: {
        value: debitAmountUnits,
        assetCode,
        assetScale,
      },
    };

    const res = await this.resourceClient.post<RafikiQuote>('/quotes', body, {
      headers: { Authorization: `GNAP ${accessToken}` },
    });

    return res.data;
  }

  // ── Outgoing Payments ─────────────────────────────────────────────────────

  /**
   * Execute an outgoing payment against a quote.
   */
  async createOutgoingPayment(
    senderWalletAddress: string,
    quoteId: string,
    accessToken: string,
    metadata?: Record<string, string>
  ): Promise<RafikiOutgoingPayment> {
    const body = {
      walletAddress: senderWalletAddress,
      quoteId,
      metadata: metadata ?? {},
    };

    const res = await this.resourceClient.post<RafikiOutgoingPayment>(
      '/outgoing-payments',
      body,
      { headers: { Authorization: `GNAP ${accessToken}` } }
    );

    return res.data;
  }

  /**
   * Fetch the current state of an outgoing payment.
   */
  async getOutgoingPayment(
    paymentId: string,
    accessToken: string
  ): Promise<RafikiOutgoingPayment> {
    const res = await this.resourceClient.get<RafikiOutgoingPayment>(
      `/outgoing-payments/${paymentId}`,
      { headers: { Authorization: `GNAP ${accessToken}` } }
    );
    return res.data;
  }

  /**
   * Poll an outgoing payment until COMPLETED or FAILED.
   */
  async awaitPaymentCompletion(
    paymentId: string,
    accessToken: string,
    maxAttempts = 12,
    intervalMs = 2_000
  ): Promise<RafikiOutgoingPayment> {
    for (let i = 0; i < maxAttempts; i++) {
      const payment = await this.getOutgoingPayment(paymentId, accessToken);
      if (payment.state === 'COMPLETED' || payment.state === 'FAILED') {
        return payment;
      }
      logger.debug(`Payment ${paymentId} state: ${payment.state} (attempt ${i + 1})`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw AppError.ilpError('Payment timed out waiting for completion');
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listIncomingPayments(
    walletAddress: string,
    accessToken: string,
    cursor?: string
  ): Promise<{ result: RafikiIncomingPayment[]; pagination: { hasNextPage: boolean } }> {
    const res = await this.resourceClient.get('/incoming-payments', {
      params: { walletAddress, cursor },
      headers: { Authorization: `GNAP ${accessToken}` },
    });
    return res.data;
  }

  async listOutgoingPayments(
    walletAddress: string,
    accessToken: string,
    cursor?: string
  ): Promise<{ result: RafikiOutgoingPayment[]; pagination: { hasNextPage: boolean } }> {
    const res = await this.resourceClient.get('/outgoing-payments', {
      params: { walletAddress, cursor },
      headers: { Authorization: `GNAP ${accessToken}` },
    });
    return res.data;
  }

  // ── High-level orchestration ──────────────────────────────────────────────

  /**
   * Full send-money flow:
   *   1. Resolve recipient wallet
   *   2. Grant incoming-payment access at recipient
   *   3. Create incoming payment at recipient
   *   4. Grant outgoing-payment access at sender
   *   5. Create quote
   *   6. Execute outgoing payment
   *   7. Poll until complete
   *
   * Returns the completed outgoing payment + quote used.
   */
  async executeSendMoney(params: {
    senderWalletAddress: string;
    recipientWalletAddress: string;
    amountDollars: number;
    metadata?: Record<string, string>;
  }): Promise<{ payment: RafikiOutgoingPayment; quote: RafikiQuote }> {
    const { senderWalletAddress, recipientWalletAddress, amountDollars, metadata } = params;

    // 1. Resolve recipient
    const recipientInfo = await this.resolveWalletAddress(recipientWalletAddress);
    const { assetCode, assetScale } = recipientInfo;
    const debitUnits = dollarsToUnits(amountDollars, assetScale);

    // 2. Get incoming-payment grant for recipient
    const incomingPaymentToken = await this.requestIncomingPaymentGrant(recipientWalletAddress);

    // 3. Create incoming payment
    const incomingPayment = await this.createIncomingPayment(
      recipientWalletAddress,
      incomingPaymentToken,
      {
        incomingAmountUnits: debitUnits,
        assetCode,
        assetScale,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        metadata,
      }
    );

    // 4. Get outgoing-payment grant for sender
    const outgoingPaymentToken = await this.requestOutgoingPaymentGrant(
      senderWalletAddress,
      debitUnits,
      assetCode,
      assetScale
    );

    // 5. Create quote
    const quote = await this.createQuote(
      senderWalletAddress,
      incomingPayment.id,
      debitUnits,
      assetCode,
      assetScale,
      outgoingPaymentToken
    );

    // 6. Execute payment
    const payment = await this.createOutgoingPayment(
      senderWalletAddress,
      quote.id,
      outgoingPaymentToken,
      metadata
    );

    // 7. Await completion
    const completedPayment = await this.awaitPaymentCompletion(
      payment.id,
      outgoingPaymentToken
    );

    if (completedPayment.state === 'FAILED') {
      throw AppError.ilpError(
        `ILP payment failed: ${completedPayment.error ?? 'Unknown error'}`
      );
    }

    return { payment: completedPayment, quote };
  }
}

// Singleton
export const rafikiService = new RafikiService();
