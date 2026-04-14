import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';
import type { Payment } from '../services/paymentsService';
import { isDemoMode, isFrontendOnly, useDemoWallet, useLiveAuth } from '../config/demo';

function paymentUsd(p: Payment): number {
  const cents = p.type === 'incoming' ? p.receiveAmountCents : p.debitAmountCents;
  return cents / 100;
}

function TransactionRow({ tx }: { tx: Payment }) {
  const isIn = tx.type === 'incoming';
  const date = new Date(tx.initiatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.txRow, pressed && styles.txRowPressed]}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <View style={[styles.txIcon, { backgroundColor: isIn ? '#d1fae5' : '#fee2e2' }]}>
        <Ionicons
          name={isIn ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={isIn ? colors.moneyIn : colors.moneyOut}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txName} numberOfLines={1}>{tx.recipientName}</Text>
        {tx.note ? (
          <Text style={styles.txDesc} numberOfLines={1}>{tx.note}</Text>
        ) : null}
        <Text style={styles.txDate}>{date}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isIn ? colors.moneyIn : colors.moneyOut }]}>
        {isIn ? '+' : '-'}${paymentUsd(tx).toFixed(2)}
      </Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { balance, transactions, isConnected, refreshBalance, refreshTransactions } = useWallet();
  const { logout, user } = useAuth();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshBalance(), refreshTransactions()]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const recentTxs = transactions.slice(0, 5);
  const totalIn = transactions
    .filter((t) => t.type === 'incoming')
    .reduce((s, t) => s + t.receiveAmountCents / 100, 0);
  const totalOut = transactions
    .filter((t) => t.type === 'outgoing')
    .reduce((s, t) => s + t.debitAmountCents / 100, 0);

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
          <View style={styles.userRow}>
            {/* Avatar with initials */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.greeting}>
                {user?.firstName ? `Hi, ${user.firstName} 👋` : 'Welcome back'}
              </Text>
              {(user as any)?.username ? (
                <View style={styles.usernameChip}>
                  <Text style={styles.usernameAt}>@</Text>
                  <Text style={styles.usernameText}>{(user as any).username}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>{balance?.formatted ?? '$0.00'}</Text>
          <Text style={styles.walletNote}>
            {isConnected
              ? '🟢 ILP Wallet Connected'
              : isFrontendOnly
                ? '✨ Interactive demo · Saved locally on this device'
                : isDemoMode && useLiveAuth
                  ? '⚪ Simulated balance · Secure account'
                  : useDemoWallet
                    ? '⚪ Demo Mode'
                    : '⚪ QuickSend Balance'}
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
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(action.route as never);
            }}
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
              <Animated.View
                key={tx.id}
                entering={FadeInDown.springify().delay(55 * i).damping(18)}
              >
                <TransactionRow tx={tx} />
                {i < recentTxs.length - 1 && <View style={styles.txDivider} />}
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: { paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText: { fontSize: typography.lg, fontWeight: typography.bold, color: '#fff' },
  userInfo: { gap: 3 },
  greeting: { fontSize: typography.base, fontWeight: typography.bold, color: '#fff' },
  usernameChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  usernameAt: { fontSize: typography.xs, color: 'rgba(255,255,255,0.6)', fontWeight: typography.bold },
  usernameText: { fontSize: typography.xs, color: 'rgba(255,255,255,0.9)', fontWeight: typography.semibold },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86efac' },
  connectedText: { fontSize: typography.xs, fontWeight: typography.semibold, color: '#d1fae5' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  logoutBtnText: { fontSize: typography.xs, fontWeight: typography.semibold, color: 'rgba(255,255,255,0.9)' },

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
  txRowPressed: { backgroundColor: colors.inputBg },
  txIcon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, gap: 2 },
  txName: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textPrimary },
  txDesc: { fontSize: typography.xs, color: colors.textSecondary },
  txDate: { fontSize: typography.xs, color: colors.textMuted },
  txAmount: { fontSize: typography.base, fontWeight: typography.bold },
  txDivider: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.lg },
  emptyState: { alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  emptyText: { fontSize: typography.base, color: colors.textMuted },
});
