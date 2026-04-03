import { api } from './apiClient';

export interface QuoteResult {
  mode: 'live' | 'estimated';
  quoteId?: string;
  incomingPaymentId?: string;
  amountDollars: number;
  estimatedFee: string;
  totalDebit: string;
  expiresAt: string;
}

export interface Payment {
  id: string;
  type: 'outgoing' | 'incoming';
  senderId: string;
  receiverId?: string;
  recipientName: string;
  recipientWalletAddress: string;
  debitAmountCents: number;
  receiveAmountCents: number;
  feeAmountCents: number;
  assetCode: string;
  assetScale: number;
  status: string;
  note?: string;
  reference?: string;
  ilpOutgoingPaymentId?: string;
  amountFormatted: string;
  initiatedAt: string;
  completedAt?: string;
}

export interface PaymentsPage {
  data: Payment[];
  pagination: { hasNextPage: boolean; nextCursor: string | null };
}

export const paymentsService = {
  async getQuote(recipientWalletAddress: string, amountDollars: number): Promise<QuoteResult> {
    const { data } = await api.post<QuoteResult>('/payments/quote', {
      recipientWalletAddress,
      amountDollars,
    });
    return data;
  },

  async send(params: {
    recipientWalletAddress: string;
    recipientName: string;
    amountDollars: number;
    note?: string;
  }): Promise<{ payment: Payment; message: string }> {
    const { data } = await api.post('/payments/send', params);
    return data;
  },

  async list(params?: {
    type?: 'sent' | 'received';
    status?: string;
    cursor?: string;
    limit?: number;
  }): Promise<PaymentsPage> {
    const { data } = await api.get<PaymentsPage>('/payments', { params });
    return data;
  },

  async get(id: string): Promise<Payment> {
    const { data } = await api.get<Payment>(`/payments/${id}`);
    return data;
  },

  async cancel(id: string): Promise<void> {
    await api.post(`/payments/${id}/cancel`);
  },
};
