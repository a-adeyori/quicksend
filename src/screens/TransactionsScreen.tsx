import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useWallet } from '../context/WalletContext';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';
import { ILPTransaction } from '../services/rafikiService';

export default function TransactionsScreen() {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: 'in' | 'out' }>();
  const { transactions } = useWallet();

  const filtered = filter
    ? transactions.filter(t => (filter === 'in' ? t.type === 'incoming' : t.type === 'outgoing'))
    : transactions;

  const title = filter === 'in' ? 'Money In' : filter === 'out' ? 'Sent Out' : 'All Transactions';
  const subtitle = filter === 'in' ? 'Credits & deposits' : filter === 'out' ? 'Debits & payments' : 'Full history';

  const totalIn = transactions.filter(t => t.type === 'incoming').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'outgoing').reduce((s, t) => s + t.amount, 0);

  const renderItem = ({ item, index }: { item: ILPTransaction; index: number }) => {
    const isIn = item.type === 'incoming';
    const date = new Date(item.createdAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    const time = new Date(item.createdAt).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });

    return (
      <View style={[styles.txCard, index === 0 && styles.txCardFirst]}>
        <View style={[styles.txIconCircle, { backgroundColor: isIn ? '#d1fae5' : '#fee2e2' }]}>
          <Ionicons
            name={isIn ? 'arrow-down' : 'arrow-up'}
            size={18}
            color={isIn ? colors.moneyIn : colors.moneyOut}
          />
        </View>
        <View style={styles.txBody}>
          <View style={styles.txTopRow}>
            <Text style={styles.txName} numberOfLines={1}>{item.counterparty}</Text>
            <Text style={[styles.txAmount, { color: isIn ? colors.moneyIn : colors.moneyOut }]}>
              {isIn ? '+' : '-'}${item.amount.toFixed(2)}
            </Text>
          </View>
          {item.description ? (
            <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <View style={styles.txMeta}>
            <Text style={styles.txDate}>{date} · {time}</Text>
            <View style={[
              styles.txBadge,
              { backgroundColor: item.state === 'COMPLETED' ? '#d1fae5' : '#fef3c7' },
            ]}>
              <Text style={[
                styles.txBadgeText,
                { color: item.state === 'COMPLETED' ? colors.primary : colors.warning },
              ]}>
                {item.state}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>{subtitle}</Text>
        </View>
      </View>

      {/* Summary row */}
      {!filter && (
        <View style={styles.summary}>
          <View style={styles.summaryCard}>
            <Ionicons name="arrow-down" size={14} color={colors.moneyIn} />
            <Text style={styles.summaryLabel}>Total In</Text>
            <Text style={[styles.summaryValue, { color: colors.moneyIn }]}>
              +${totalIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="arrow-up" size={14} color={colors.moneyOut} />
            <Text style={styles.summaryLabel}>Total Out</Text>
            <Text style={[styles.summaryValue, { color: colors.moneyOut }]}>
              -${totalOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  headerTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary },
  headerSub: { fontSize: typography.xs, color: colors.textMuted },
  summary: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.md },
  summaryCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...shadows.card },
  summaryLabel: { flex: 1, fontSize: typography.xs, color: colors.textSecondary },
  summaryValue: { fontSize: typography.sm, fontWeight: typography.bold },
  list: { padding: spacing.xl, gap: 0 },
  txCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.card, padding: spacing.lg, borderRadius: 0 },
  txCardFirst: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  txIconCircle: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  txBody: { flex: 1, gap: 4 },
  txTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  txName: { flex: 1, fontSize: typography.base, fontWeight: typography.semibold, color: colors.textPrimary, marginRight: spacing.sm },
  txAmount: { fontSize: typography.base, fontWeight: typography.bold },
  txDesc: { fontSize: typography.xs, color: colors.textSecondary },
  txMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txDate: { fontSize: typography.xs, color: colors.textMuted },
  txBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  txBadgeText: { fontSize: 10, fontWeight: typography.bold },
  separator: { height: 1, backgroundColor: colors.divider, marginLeft: 74 },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: { fontSize: typography.base, color: colors.textMuted },
});
