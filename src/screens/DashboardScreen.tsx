import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWallet } from '../context/WalletContext';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';

function TransactionRow({ tx }: { tx: { id: string; type: string; amount: number; currency: string; counterparty: string; description?: string; createdAt: string; state: string } }) {
  const isIn = tx.type === 'incoming';
  const date = new Date(tx.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: isIn ? '#d1fae5' : '#fee2e2' }]}>
        <Ionicons
          name={isIn ? 'trending-down' : 'trending-up'}
          size={16}
          color={isIn ? colors.moneyIn : colors.moneyOut}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txName} numberOfLines={1}>{tx.counterparty}</Text>
        {tx.description ? (
          <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
        ) : null}
        <Text style={styles.txDate}>{date}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isIn ? colors.moneyIn : colors.moneyOut }]}>
        {isIn ? '+' : '-'}${tx.amount.toFixed(2)}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { balance, transactions, isConnected, refreshBalance, refreshTransactions, isLoading } = useWallet();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshBalance(), refreshTransactions()]);
    setRefreshing(false);
  };

  const recentTxs = transactions.slice(0, 5);
  const totalIn = transactions
    .filter((t) => t.type === 'incoming')
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions
    .filter((t) => t.type === 'outgoing')
    .reduce((s, t) => s + t.amount, 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[colors.primaryDark, colors.primary, colors.primaryMid]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top row */}
        <View style={styles.headerTop}>
          <View style={styles.logoRow}>
            <View style={styles.logoCircle}>
              <Ionicons name="flash" size={18} color={colors.primary} />
            </View>
            <Text style={styles.logoText}>QuickSend</Text>
          </View>
          <View style={styles.headerActions}>
            {isConnected && (
              <View style={styles.connectedBadge}>
                <View style={styles.connectedDot} />
                <Text style={styles.connectedText}>ILP Live</Text>
              </View>
            )}
            <TouchableOpacity style={styles.phoneBtn} onPress={() => {}}>
              <Ionicons name="call" size={16} color={colors.primaryLight} />
              <Text style={styles.phoneBtnText}>Help</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>{balance?.formatted ?? '$0.00'}</Text>
          <Text style={styles.walletNote}>
            {isConnected ? '🟢 ILP Wallet Connected' : '⚪ Demo Mode'}
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/money-in')}
            activeOpacity={0.8}
          >
            <View style={styles.statLabelRow}>
              <Ionicons name="trending-down" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.statLabel}>Money In</Text>
            </View>
            <Text style={styles.statValue}>+${totalIn.toLocaleString('en-US', { minimumFractionDigits: 0 })}</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/sent-out')}
            activeOpacity={0.8}
          >
            <View style={styles.statLabelRow}>
              <Ionicons name="trending-up" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.statLabel}>Sent Out</Text>
            </View>
            <Text style={styles.statValue}>-${totalOut.toLocaleString('en-US', { minimumFractionDigits: 0 })}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {[
          { icon: 'send', label: 'Send', route: '/send', color: colors.primary },
          { icon: 'download', label: 'Receive', route: '/receive', color: '#3b82f6' },
          { icon: 'trending-up', label: 'Invest', route: '/invest', color: '#e8a040' },
          { icon: 'mic', label: 'Voice', route: '/voice', color: '#8b5cf6' },
        ].map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.actionBtn}
            onPress={() => router.push(action.route as never)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
              <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={22} color={action.color} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions */}
      <ScrollView
        style={styles.txList}
        contentContainerStyle={styles.txListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push('/transactions')}>
            <Text style={styles.seeAll}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.txCard}>
          {recentTxs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            recentTxs.map((tx, i) => (
              <View key={tx.id}>
                <TransactionRow tx={tx} />
                {i < recentTxs.length - 1 && <View style={styles.txDivider} />}
              </View>
            ))
          )}
        </View>

        {/* ILP info card */}
        {!isConnected && (
          <TouchableOpacity
            style={styles.ilpBanner}
            onPress={() => router.push('/settings')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#1e3a5f', '#1d4ed8']}
              style={styles.ilpBannerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="flash" size={24} color="#93c5fd" />
              <View style={styles.ilpBannerText}>
                <Text style={styles.ilpBannerTitle}>Connect ILP Wallet</Text>
                <Text style={styles.ilpBannerBody}>
                  Link your Interledger wallet for real-time, low-fee transfers via Rafiki.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#93c5fd" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: { paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: typography.md, fontWeight: typography.bold, color: '#fff' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86efac' },
  connectedText: { fontSize: typography.xs, fontWeight: typography.semibold, color: '#d1fae5' },
  phoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  phoneBtnText: { fontSize: typography.xs, fontWeight: typography.semibold, color: 'rgba(255,255,255,0.9)' },

  // Balance
  balanceSection: { marginBottom: spacing.xl },
  balanceLabel: { fontSize: typography.sm, color: 'rgba(255,255,255,0.7)', fontWeight: typography.medium },
  balanceAmount: { fontSize: 40, fontWeight: typography.extrabold, color: '#fff', marginVertical: 4 },
  walletNote: { fontSize: typography.xs, color: 'rgba(255,255,255,0.6)' },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.xl, overflow: 'hidden' },
  statCard: { flex: 1, padding: spacing.md },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  statLabel: { fontSize: typography.xs, color: 'rgba(255,255,255,0.7)', fontWeight: typography.medium },
  statValue: { fontSize: typography.md, fontWeight: typography.bold, color: '#fff' },

  // Quick actions
  quickActions: { flexDirection: 'row', backgroundColor: colors.card, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, ...shadows.card },
  actionBtn: { flex: 1, alignItems: 'center', gap: 6 },
  actionIcon: { width: 50, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textSecondary },

  // Transactions
  txList: { flex: 1 },
  txListContent: { padding: spacing.xl, gap: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  seeAll: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.primary },
  txCard: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', ...shadows.card },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  txIcon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, gap: 2 },
  txName: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textPrimary },
  txDesc: { fontSize: typography.xs, color: colors.textSecondary },
  txDate: { fontSize: typography.xs, color: colors.textMuted },
  txAmount: { fontSize: typography.base, fontWeight: typography.bold },
  txDivider: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.lg },
  emptyState: { alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  emptyText: { fontSize: typography.base, color: colors.textMuted },

  // ILP Banner
  ilpBanner: { borderRadius: radius.xl, overflow: 'hidden', ...shadows.card },
  ilpBannerGradient: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  ilpBannerText: { flex: 1, gap: 3 },
  ilpBannerTitle: { fontSize: typography.base, fontWeight: typography.bold, color: '#fff' },
  ilpBannerBody: { fontSize: typography.xs, color: '#93c5fd', lineHeight: 18 },
});
