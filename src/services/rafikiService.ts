/**
 * ILP / Rafiki Wallet Integration Service
 *
 * This service wraps the Interledger Open Payments protocol (RFC 9635) and
 * connects to a Rafiki instance for sending/receiving money via ILP.
 *
 * Key concepts:
 *  - Wallet Address  : a URL like https://wallet.example.com/alice that identifies a payment account
 *  - Grant Request   : asks the wallet's Authorization Server for permission to act on an account
 *  - Quote           : a locked-in exchange rate + fee estimate for a specific payment
 *  - Outgoing Payment: the actual ILP payment once a quote is approved
 *
 * Integration map to the app:
 *  - sendMoney()       → SendMoney screen "Confirm & Send"
 *  - getWalletBalance()→ Dashboard balance card
 *  - getTransactions() → MoneyIn / SentOut screens
 *  - getQuote()        → SendMoney review sheet (fee preview)
 */

import axios from 'axios';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Replace these with your real Rafiki instance URLs.
 * In production these should come from environment variables (e.g. via expo-constants).
 *
 * Local dev  : npm run rafiki:dev  (see docker-compose in the repo root)
 * Testnet    : https://cloud.ilpv4.dev  (Interledger Foundation testnet)
 * Mainnet    : your own Rafiki deployment
 */
export const RAFIKI_CONFIG = {
  /** Auth server for Open Payments grants */
  authServerUrl: process.env.EXPO_PUBLIC_RAFIKI_AUTH_URL ?? 'https://auth.wallet.example.com',
  /** Resource server for wallet addresses, quotes, and payments */
  resourceServerUrl: process.env.EXPO_PUBLIC_RAFIKI_RESOURCE_URL ?? 'https://wallet.example.com',
  /** Your app's client wallet address (the "sending" account) */
  clientWalletAddress: process.env.EXPO_PUBLIC_CLIENT_WALLET_ADDRESS ?? 'https://wallet.example.com/quicksend-client',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletAddress {
  id: string;
  publicName: string;
  assetCode: string;
  assetScale: number;
  authServer: string;
  resourceServer: string;
}

export interface ILPGrant {
  accessToken: string;
  manageUrl: string;
  expiresIn: number;
  grantedAt: number; // unix ms
}

export interface ILPQuote {
  id: string;
  walletAddress: string;
  receiveAmount: { value: string; assetCode: string; assetScale: number };
  debitAmount: { value: string; assetCode: string; assetScale: number };
  expiresAt: string;
  estimatedFee: string; // human-readable, e.g. "$0.02"
}

export interface OutgoingPayment {
  id: string;
  walletAddress: string;
  quoteId: string;
  receiveAmount: { value: string; assetCode: string; assetScale: number };
  debitAmount: { value: string; assetCode: string; assetScale: number };
  state: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface ILPTransaction {
  id: string;
  type: 'incoming' | 'outgoing';
  amount: number;
  currency: string;
  counterparty: string;
  description?: string;
  state: string;
  createdAt: string;
}

export interface WalletBalance {
  assetCode: string;
  assetScale: number;
  value: string;       // raw integer string from Rafiki
  formatted: string;   // e.g. "$8,547.32"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Rafiki's integer amount to a display string */
function formatAmount(value: string, assetScale: number, assetCode: string): string {
  const num = parseInt(value, 10) / Math.pow(10, assetScale);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: assetCode,
  }).format(num);
}

/** Convert a dollar amount to Rafiki's integer representation */
function toRafikiBigInt(dollars: number, assetScale: number): string {
  return Math.round(dollars * Math.pow(10, assetScale)).toString();
}

// ─── RafikiService ────────────────────────────────────────────────────────────

class RafikiService {
  private cachedGrant: ILPGrant | null = null;

  // ── 1. Wallet Address Resolution ─────────────────────────────────────────

  /**
   * Resolve a wallet address URL to its metadata.
   * This is the first step in any Open Payments flow.
   *
   * Spec: GET {walletAddress}  (Accept: application/json)
   */
  async resolveWalletAddress(walletAddressUrl: string): Promise<WalletAddress> {
    try {
      const response = await axios.get<WalletAddress>(walletAddressUrl, {
        headers: { Accept: 'application/json' },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to resolve wallet address: ${walletAddressUrl}`);
    }
  }

  // ── 2. Grant / Auth ───────────────────────────────────────────────────────

  /**
   * Request an outgoing-payment grant from the Authorization Server.
   *
   * In a production app this triggers the GNAP interactive grant flow
   * (user is redirected to their bank/wallet to approve the payment).
   * Here we show the full request structure and handle both interactive
   * and non-interactive responses.
   *
   * Spec: POST {authServer}/  (Grant Request)
   */
  async requestOutgoingPaymentGrant(
    senderWalletAddress: string,
    debitAmountDollars: number,
    assetCode: string = 'USD',
    assetScale: number = 2
  ): Promise<ILPGrant> {
    const authServerUrl = RAFIKI_CONFIG.authServerUrl;

    const grantRequest = {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['create', 'read', 'list'],
            identifier: senderWalletAddress,
            limits: {
              debitAmount: {
                value: toRafikiBigInt(debitAmountDollars, assetScale),
                assetCode,
                assetScale,
              },
            },
          },
        ],
      },
      client: RAFIKI_CONFIG.clientWalletAddress,
    };

    const response = await axios.post(`${authServerUrl}/`, grantRequest, {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = response.data;

    // Non-interactive grant (auto-approved by AS)
    if (data.access_token) {
      const grant: ILPGrant = {
        accessToken: data.access_token.value,
        manageUrl: data.access_token.manage,
        expiresIn: data.access_token.expires_in ?? 3600,
        grantedAt: Date.now(),
      };
      this.cachedGrant = grant;
      return grant;
    }

    // Interactive grant — user must visit data.interact.redirect to approve
    // In a real app you'd open this URL in a WebBrowser and listen for the redirect
    throw new InteractiveGrantRequiredError(
      data.interact?.redirect ?? '',
      data.continue
    );
  }

  /**
   * Exchange an interact_ref (returned after user approves interactive grant)
   * for an access token.
   */
  async continueGrant(
    continueUri: string,
    continueToken: string,
    interactRef: string
  ): Promise<ILPGrant> {
    const response = await axios.post(
      continueUri,
      { interact_ref: interactRef },
      { headers: { Authorization: `GNAP ${continueToken}` } }
    );

    const data = response.data;
    const grant: ILPGrant = {
      accessToken: data.access_token.value,
      manageUrl: data.access_token.manage,
      expiresIn: data.access_token.expires_in ?? 3600,
      grantedAt: Date.now(),
    };
    this.cachedGrant = grant;
    return grant;
  }

  // ── 3. Quote ──────────────────────────────────────────────────────────────

  /**
   * Create a quote to get a locked-in rate before sending.
   * Always create a quote before creating an outgoing payment.
   *
   * Spec: POST {resourceServer}/quotes
   */
  async createQuote(
    senderWalletAddress: string,
    recipientWalletAddress: string,
    amountDollars: number,
    accessToken: string,
    assetCode: string = 'USD',
    assetScale: number = 2
  ): Promise<ILPQuote> {
    const resourceServer = RAFIKI_CONFIG.resourceServerUrl;

    const quoteBody = {
      walletAddress: senderWalletAddress,
      receiver: `${recipientWalletAddress}/incoming-payments`,
      debitAmount: {
        value: toRafikiBigInt(amountDollars, assetScale),
        assetCode,
        assetScale,
      },
    };

    const response = await axios.post(`${resourceServer}/quotes`, quoteBody, {
      headers: {
        Authorization: `GNAP ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const q = response.data;
    const fee = parseFloat(q.debitAmount.value) - parseFloat(q.receiveAmount.value);
    const feeFormatted = formatAmount(
      Math.max(0, fee).toString(),
      q.debitAmount.assetScale,
      q.debitAmount.assetCode
    );

    return {
      id: q.id,
      walletAddress: q.walletAddress,
      receiveAmount: q.receiveAmount,
      debitAmount: q.debitAmount,
      expiresAt: q.expiresAt,
      estimatedFee: feeFormatted,
    };
  }

  // ── 4. Outgoing Payment ───────────────────────────────────────────────────

  /**
   * Execute a payment using a previously created quote.
   *
   * Spec: POST {resourceServer}/outgoing-payments
   */
  async createOutgoingPayment(
    senderWalletAddress: string,
    quoteId: string,
    accessToken: string,
    metadata?: Record<string, string>
  ): Promise<OutgoingPayment> {
    const resourceServer = RAFIKI_CONFIG.resourceServerUrl;

    const paymentBody = {
      walletAddress: senderWalletAddress,
      quoteId,
      metadata: metadata ?? {},
    };

    const response = await axios.post(
      `${resourceServer}/outgoing-payments`,
      paymentBody,
      {
        headers: {
          Authorization: `GNAP ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data as OutgoingPayment;
  }

  /**
   * Poll a payment until it reaches a terminal state (COMPLETED or FAILED).
   */
  async pollPaymentUntilComplete(
    paymentId: string,
    accessToken: string,
    maxAttempts: number = 10,
    intervalMs: number = 1500
  ): Promise<OutgoingPayment> {
    const resourceServer = RAFIKI_CONFIG.resourceServerUrl;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await axios.get(
        `${resourceServer}/outgoing-payments/${paymentId}`,
        { headers: { Authorization: `GNAP ${accessToken}` } }
      );

      const payment = response.data as OutgoingPayment;

      if (payment.state === 'COMPLETED' || payment.state === 'FAILED') {
        return payment;
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error('Payment did not complete within expected time');
  }

  // ── 5. Incoming Payment (receive money) ───────────────────────────────────

  /**
   * Create an incoming payment address — share this URL with the sender.
   * Required before the sender can quote to your wallet.
   */
  async createIncomingPayment(
    receiverWalletAddress: string,
    accessToken: string,
    expiresAt?: string,
    incomingAmountDollars?: number,
    assetCode: string = 'USD',
    assetScale: number = 2
  ): Promise<{ id: string; ilpStreamConnection: string }> {
    const resourceServer = RAFIKI_CONFIG.resourceServerUrl;

    const body: Record<string, unknown> = {
      walletAddress: receiverWalletAddress,
    };

    if (expiresAt) body.expiresAt = expiresAt;
    if (incomingAmountDollars !== undefined) {
      body.incomingAmount = {
        value: toRafikiBigInt(incomingAmountDollars, assetScale),
        assetCode,
        assetScale,
      };
    }

    const response = await axios.post(
      `${resourceServer}/incoming-payments`,
      body,
      {
        headers: {
          Authorization: `GNAP ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      id: response.data.id,
      ilpStreamConnection: response.data.ilpStreamConnection,
    };
  }

  // ── 6. Balance & Transactions ─────────────────────────────────────────────

  /**
   * Fetch the current wallet balance.
   * NOTE: Rafiki doesn't expose a dedicated /balance endpoint in the Open Payments spec.
   * This typically comes from your own backend that aggregates completed payment amounts,
   * or from a wallet-provider specific API endpoint.
   *
   * Replace the URL below with your wallet provider's balance endpoint.
   */
  async getWalletBalance(
    walletAddress: string,
    accessToken: string
  ): Promise<WalletBalance> {
    // Example wallet-provider endpoint (non-standard)
    const response = await axios.get(
      `${RAFIKI_CONFIG.resourceServerUrl}/accounts/balance`,
      {
        params: { walletAddress },
        headers: { Authorization: `GNAP ${accessToken}` },
      }
    );

    const data = response.data;
    return {
      assetCode: data.assetCode,
      assetScale: data.assetScale,
      value: data.value,
      formatted: formatAmount(data.value, data.assetScale, data.assetCode),
    };
  }

  /**
   * List completed transactions (incoming + outgoing) for the account.
   * Merges both lists and sorts newest-first.
   */
  async getTransactions(
    walletAddress: string,
    accessToken: string
  ): Promise<ILPTransaction[]> {
    const resourceServer = RAFIKI_CONFIG.resourceServerUrl;

    const [incomingRes, outgoingRes] = await Promise.all([
      axios.get(`${resourceServer}/incoming-payments`, {
        params: { walletAddress },
        headers: { Authorization: `GNAP ${accessToken}` },
      }),
      axios.get(`${resourceServer}/outgoing-payments`, {
        params: { walletAddress },
        headers: { Authorization: `GNAP ${accessToken}` },
      }),
    ]);

    const incoming: ILPTransaction[] = (incomingRes.data.result ?? []).map(
      (p: Record<string, unknown>) => ({
        id: p.id as string,
        type: 'incoming' as const,
        amount:
          parseInt((p.receivedAmount as { value: string }).value, 10) /
          Math.pow(10, (p.receivedAmount as { assetScale: number }).assetScale),
        currency: (p.receivedAmount as { assetCode: string }).assetCode,
        counterparty: 'Incoming Transfer',
        state: p.state as string,
        createdAt: p.createdAt as string,
      })
    );

    const outgoing: ILPTransaction[] = (outgoingRes.data.result ?? []).map(
      (p: Record<string, unknown>) => ({
        id: p.id as string,
        type: 'outgoing' as const,
        amount:
          parseInt((p.debitAmount as { value: string }).value, 10) /
          Math.pow(10, (p.debitAmount as { assetScale: number }).assetScale),
        currency: (p.debitAmount as { assetCode: string }).assetCode,
        counterparty:
          typeof p.metadata === 'object' && p.metadata !== null
            ? ((p.metadata as Record<string, string>).recipientName ?? 'Transfer')
            : 'Transfer',
        description:
          typeof p.metadata === 'object' && p.metadata !== null
            ? ((p.metadata as Record<string, string>).note ?? undefined)
            : undefined,
        state: p.state as string,
        createdAt: p.createdAt as string,
      })
    );

    return [...incoming, ...outgoing].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // ── 7. High-Level Send Money Flow ─────────────────────────────────────────

  /**
   * Complete end-to-end send-money flow:
   *   1. Resolve recipient wallet address
   *   2. Create incoming payment at recipient
   *   3. Request grant from sender's auth server
   *   4. Create quote
   *   5. Create outgoing payment
   *   6. Poll until complete
   *
   * @param senderWalletAddressUrl  - sender's wallet address URL
   * @param recipientWalletAddressUrl - recipient's wallet address URL
   * @param amountDollars           - amount to send in USD
   * @param senderAccessToken       - pre-obtained grant token (or call requestOutgoingPaymentGrant first)
   * @param note                    - optional memo
   */
  async sendMoney(params: {
    senderWalletAddressUrl: string;
    recipientWalletAddressUrl: string;
    amountDollars: number;
    senderAccessToken: string;
    note?: string;
    recipientName?: string;
  }): Promise<OutgoingPayment> {
    const {
      senderWalletAddressUrl,
      recipientWalletAddressUrl,
      amountDollars,
      senderAccessToken,
      note,
      recipientName,
    } = params;

    // Step 1: Resolve recipient
    await this.resolveWalletAddress(recipientWalletAddressUrl);

    // Step 2: Create incoming payment at recipient's wallet
    // (In a real flow the recipient's wallet may already have a standing incoming-payment URL)
    const incoming = await this.createIncomingPayment(
      recipientWalletAddressUrl,
      senderAccessToken
    );

    // Step 3: Quote
    const quote = await this.createQuote(
      senderWalletAddressUrl,
      recipientWalletAddressUrl,
      amountDollars,
      senderAccessToken
    );

    // Step 4: Outgoing payment
    const payment = await this.createOutgoingPayment(
      senderWalletAddressUrl,
      quote.id,
      senderAccessToken,
      {
        incomingPaymentId: incoming.id,
        recipientName: recipientName ?? 'Unknown',
        note: note ?? '',
      }
    );

    // Step 5: Poll
    return this.pollPaymentUntilComplete(payment.id, senderAccessToken);
  }
}

// ─── Custom Errors ────────────────────────────────────────────────────────────

export class InteractiveGrantRequiredError extends Error {
  constructor(
    public readonly redirectUrl: string,
    public readonly continueData: { uri: string; access_token: { value: string } }
  ) {
    super('Interactive grant required — user must approve at: ' + redirectUrl);
    this.name = 'InteractiveGrantRequiredError';
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const rafikiService = new RafikiService();
export default rafikiService;
