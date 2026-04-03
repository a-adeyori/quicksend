/**
 * WalletContext — live API or interactive demo (no real money).
 */
import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import { walletService, WalletInfo } from '../services/walletService';
import { paymentsService, Payment, QuoteResult } from '../services/paymentsService';
import { contactsService, Contact } from '../services/contactsService';
import { useAuth } from './AuthContext';
import { DEMO_USER, isDemoMode } from '../config/demo';

interface WalletState {
  isConnected: boolean;
  walletAddress: string;
  balance: WalletInfo['balance'] | null;
  transactions: Payment[];
  contacts: Contact[];
  isLoading: boolean;
  error: string | null;
  hasMoreTransactions: boolean;
  nextCursor: string | null;
}

interface WalletContextType extends WalletState {
  connectWallet: (url: string) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  loadMoreTransactions: () => Promise<void>;
  refreshContacts: () => Promise<void>;
  sendMoney: (params: {
    recipientWalletAddress: string;
    recipientName: string;
    amountDollars: number;
    note?: string;
  }) => Promise<{ success: boolean; paymentId?: string; error?: string }>;
  getQuote: (recipientWalletAddress: string, amountDollars: number) => Promise<QuoteResult | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const DEMO_PLATFORM_WALLET = 'https://ilp.interledger-test.dev/quicksend';

function buildDemoContacts(): Contact[] {
  return [
    { id: 'dc1', name: 'Sarah (Daughter)', initials: 'SD', color: '#D1FAE5', walletAddress: 'https://ilp.interledger-test.dev/sarah' },
    { id: 'dc2', name: 'Mike (Son)', initials: 'MS', color: '#E0F2FE', walletAddress: 'https://ilp.interledger-test.dev/mike' },
    { id: 'dc3', name: 'Mary (Sister)', initials: 'MR', color: '#FEF3C7', walletAddress: 'https://ilp.interledger-test.dev/mary' },
    { id: 'dc4', name: 'Dr. Johnson', initials: 'DJ', color: '#EDE9FE', walletAddress: 'https://ilp.interledger-test.dev/dr-johnson' },
  ];
}

function buildDemoTransactions(): Payment[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-tx-1',
      type: 'outgoing',
      senderId: DEMO_USER.id,
      recipientName: 'Sarah (Daughter)',
      recipientWalletAddress: 'https://ilp.interledger-test.dev/sarah',
      debitAmountCents: 5000,
      receiveAmountCents: 5000,
      feeAmountCents: 25,
      assetCode: 'USD',
      assetScale: 2,
      status: 'COMPLETED',
      note: 'Lunch',
      amountFormatted: '$50.00',
      initiatedAt: now,
      completedAt: now,
    },
    {
      id: 'demo-tx-2',
      type: 'incoming',
      senderId: DEMO_USER.id,
      recipientName: 'Mike (Son)',
      recipientWalletAddress: 'https://ilp.interledger-test.dev/mike',
      debitAmountCents: 0,
      receiveAmountCents: 12000,
      feeAmountCents: 0,
      assetCode: 'USD',
      assetScale: 2,
      status: 'COMPLETED',
      amountFormatted: '$120.00',
      initiatedAt: now,
      completedAt: now,
    },
  ];
}

function makeDemoPayment(params: {
  recipientWalletAddress: string;
  recipientName: string;
  amountDollars: number;
  note?: string;
  balanceCentsBefore: number;
}): { payment: Payment; newBalanceCents: number; error?: string } {
  const debitCents = Math.round(params.amountDollars * 100);
  if (debitCents > params.balanceCentsBefore) {
    return {
      payment: {} as Payment,
      newBalanceCents: params.balanceCentsBefore,
      error: 'Insufficient balance (simulation)',
    };
  }
  const feeCents = Math.max(2, Math.round(debitCents * 0.001));
  const total = debitCents + feeCents;
  const now = new Date().toISOString();
  const payment: Payment = {
    id: `demo-${Date.now()}`,
    type: 'outgoing',
    senderId: DEMO_USER.id,
    recipientName: params.recipientName,
    recipientWalletAddress: params.recipientWalletAddress,
    debitAmountCents: total,
    receiveAmountCents: debitCents,
    feeAmountCents: feeCents,
    assetCode: 'USD',
    assetScale: 2,
    status: 'COMPLETED',
    note: params.note,
    amountFormatted: `$${params.amountDollars.toFixed(2)}`,
    initiatedAt: now,
    completedAt: now,
  };
  return { payment, newBalanceCents: params.balanceCentsBefore - total };
}

function DemoWalletProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    walletAddress: DEMO_PLATFORM_WALLET,
    balance: {
      value: '854732',
      assetCode: 'USD',
      assetScale: 2,
      formatted: '$8,547.32',
    },
    transactions: buildDemoTransactions(),
    contacts: buildDemoContacts(),
    isLoading: false,
    error: null,
    hasMoreTransactions: false,
    nextCursor: null,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    setState(s => ({
      ...s,
      isLoading: false,
      error: null,
      isConnected: false,
    }));
  }, [isAuthenticated]);

  const connectWallet = useCallback(async (url: string) => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    await new Promise(r => setTimeout(r, 400));
    setState(s => ({
      ...s,
      isConnected: true,
      walletAddress: url || DEMO_PLATFORM_WALLET,
      isLoading: false,
    }));
  }, []);

  const disconnectWallet = useCallback(async () => {
    setState(s => ({ ...s, isConnected: false, walletAddress: DEMO_PLATFORM_WALLET }));
  }, []);

  const refreshBalance = useCallback(async () => {}, []);
  const refreshTransactions = useCallback(async () => {}, []);
  const loadMoreTransactions = useCallback(async () => {}, []);
  const refreshContacts = useCallback(async () => {}, []);

  const getQuote = useCallback(async (
    _recipientWalletAddress: string,
    amountDollars: number
  ): Promise<QuoteResult | null> => {
    const fee = Math.max(0.02, amountDollars * 0.001);
    return {
      mode: 'estimated',
      amountDollars,
      estimatedFee: `$${fee.toFixed(2)}`,
      totalDebit: `$${(amountDollars + fee).toFixed(2)}`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }, []);

  const sendMoney = useCallback(async (params: {
    recipientWalletAddress: string;
    recipientName: string;
    amountDollars: number;
    note?: string;
  }): Promise<{ success: boolean; paymentId?: string; error?: string }> => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    await new Promise(r => setTimeout(r, 350));
    let result: { success: boolean; paymentId?: string; error?: string } = { success: false };
    setState((s) => {
      const balanceCents = s.balance ? parseInt(s.balance.value, 10) : 0;
      const { payment, newBalanceCents, error } = makeDemoPayment({
        ...params,
        balanceCentsBefore: balanceCents,
      });
      if (error) {
        result = { success: false, error };
        return { ...s, isLoading: false, error };
      }
      result = { success: true, paymentId: payment.id };
      return {
        ...s,
        isLoading: false,
        error: null,
        transactions: [payment, ...s.transactions],
        balance: s.balance
          ? {
              ...s.balance,
              value: newBalanceCents.toString(),
              formatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                newBalanceCents / 100
              ),
            }
          : null,
      };
    });
    return result;
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connectWallet,
        disconnectWallet,
        refreshBalance,
        refreshTransactions,
        loadMoreTransactions,
        refreshContacts,
        getQuote,
        sendMoney,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

function LiveWalletProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [state, setState] = useState<WalletState>({
    isConnected: false,
    walletAddress: '',
    balance: null,
    transactions: [],
    contacts: [],
    isLoading: false,
    error: null,
    hasMoreTransactions: false,
    nextCursor: null,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      setState(s => ({ ...s, isLoading: true }));
      try {
        const [walletInfo, txPage, contacts] = await Promise.all([
          walletService.getInfo(),
          paymentsService.list({ limit: 20 }),
          contactsService.list(),
        ]);
        setState(s => ({
          ...s,
          isConnected: walletInfo.isConnected,
          walletAddress: walletInfo.walletAddress ?? '',
          balance: walletInfo.balance,
          transactions: txPage.data,
          hasMoreTransactions: txPage.pagination.hasNextPage,
          nextCursor: txPage.pagination.nextCursor,
          contacts,
          isLoading: false,
          error: null,
        }));
      } catch {
        setState(s => ({ ...s, isLoading: false, error: 'Could not load wallet data.' }));
      }
    })();
  }, [isAuthenticated]);

  const connectWallet = useCallback(async (url: string) => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      await walletService.connect(url);
      const info = await walletService.getInfo();
      setState(s => ({ ...s, isConnected: true, walletAddress: url, balance: info.balance, isLoading: false }));
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to connect wallet.';
      setState(s => ({ ...s, isLoading: false, error: message }));
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    await walletService.disconnect();
    setState(s => ({ ...s, isConnected: false, walletAddress: '' }));
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const balance = await walletService.getBalance();
      setState(s => ({ ...s, balance }));
    } catch { /* ignore */ }
  }, []);

  const refreshTransactions = useCallback(async () => {
    try {
      const page = await paymentsService.list({ limit: 20 });
      setState(s => ({
        ...s,
        transactions: page.data,
        hasMoreTransactions: page.pagination.hasNextPage,
        nextCursor: page.pagination.nextCursor,
      }));
    } catch { /* ignore */ }
  }, []);

  const loadMoreTransactions = useCallback(async () => {
    if (!state.hasMoreTransactions || !state.nextCursor) return;
    try {
      const page = await paymentsService.list({ limit: 20, cursor: state.nextCursor });
      setState(s => ({
        ...s,
        transactions: [...s.transactions, ...page.data],
        hasMoreTransactions: page.pagination.hasNextPage,
        nextCursor: page.pagination.nextCursor,
      }));
    } catch { /* ignore */ }
  }, [state.hasMoreTransactions, state.nextCursor]);

  const refreshContacts = useCallback(async () => {
    try {
      const contacts = await contactsService.list();
      setState(s => ({ ...s, contacts }));
    } catch { /* ignore */ }
  }, []);

  const getQuote = useCallback(async (
    recipientWalletAddress: string,
    amountDollars: number
  ): Promise<QuoteResult | null> => {
    try {
      return await paymentsService.getQuote(recipientWalletAddress, amountDollars);
    } catch {
      const fee = Math.max(0.02, amountDollars * 0.001);
      return {
        mode: 'estimated',
        amountDollars,
        estimatedFee: `$${fee.toFixed(2)}`,
        totalDebit: `$${(amountDollars + fee).toFixed(2)}`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
    }
  }, []);

  const sendMoney = useCallback(async (params: {
    recipientWalletAddress: string;
    recipientName: string;
    amountDollars: number;
    note?: string;
  }): Promise<{ success: boolean; paymentId?: string; error?: string }> => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await paymentsService.send(params);
      setState(s => ({
        ...s,
        isLoading: false,
        transactions: [result.payment, ...s.transactions],
        balance: s.balance ? {
          ...s.balance,
          value: (parseInt(s.balance.value, 10) - result.payment.debitAmountCents).toString(),
          formatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: s.balance.assetCode })
            .format((parseInt(s.balance.value, 10) - result.payment.debitAmountCents) / 10 ** s.balance.assetScale),
        } : null,
      }));
      refreshBalance();
      return { success: result.payment.status === 'COMPLETED', paymentId: result.payment.id };
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Payment failed';
      setState(s => ({ ...s, isLoading: false, error: message }));
      return { success: false, error: message };
    }
  }, [refreshBalance]);

  return (
    <WalletContext.Provider value={{
      ...state,
      connectWallet, disconnectWallet,
      refreshBalance, refreshTransactions, loadMoreTransactions,
      refreshContacts, getQuote, sendMoney,
    }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  if (isDemoMode) {
    return <DemoWalletProvider>{children}</DemoWalletProvider>;
  }
  return <LiveWalletProvider>{children}</LiveWalletProvider>;
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
