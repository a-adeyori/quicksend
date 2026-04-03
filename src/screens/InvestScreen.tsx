import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';

const PRODUCTS = [
  {
    id: '1',
    name: 'High-Yield Savings',
    description: 'Earn more on your balance with zero risk.',
    apy: '5.10%',
    risk: 'Low',
    icon: 'shield-checkmark',
    color: '#2d9e6b',
    minAmount: 100,
  },
  {
    id: '2',
    name: 'Short-Term Bonds',
    description: 'Government-backed bonds with predictable returns.',
    apy: '4.75%',
    risk: 'Low',
    icon: 'document-text',
    color: '#3b82f6',
    minAmount: 500,
  },
  {
    id: '3',
    name: 'Balanced Fund',
    description: 'Diversified mix of stocks and bonds.',
    apy: '7.20%',
    risk: 'Medium',
    icon: 'pie-chart',
    color: '#e8a040',
    minAmount: 1000,
  },
  {
    id: '4',
    name: 'ILP Yield Pool',
    description: 'Earn yield by providing ILP network liquidity.',
    apy: '8.50%',
    risk: 'Medium',
    icon: 'flash',
    color: '#8b5cf6',
    minAmount: 250,
    badge: 'ILP',
  },
];

const riskColor = { Low: colors.primary, Medium: colors.warning, High: colors.error };

export default function InvestScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invest</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSub}>Grow your money with smart investments</Text>
        <View style={styles.portfolioCard}>
          <Text style={styles.portfolioLabel}>Portfolio Value</Text>
          <Text style={styles.portfolioValue}>$0.00</Text>
          <Text style={styles.portfolioNote}>Start investing today</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Available Products</Text>

        {PRODUCTS.map(product => {
          const isSelected = selected === product.id;
          return (
            <TouchableOpacity
              key={product.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelected(isSelected ? null : product.id)}
              activeOpacity={0.88}
            >
              <View style={styles.cardTop}>
                <View style={[styles.productIcon, { backgroundColor: product.color + '18' }]}>
                  <Ionicons name={product.icon as keyof typeof Ionicons.glyphMap} size={22} color={product.color} />
                </View>
                <View style={styles.productInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.productName}>{product.name}</Text>
                    {product.badge && (
                      <View style={styles.ilpBadge}>
                        <Text style={styles.ilpBadgeText}>{product.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.productDesc}>{product.description}</Text>
                </View>
              </View>

              <View style={styles.cardStats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>APY</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{product.apy}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Risk</Text>
                  <Text style={[styles.statValue, { color: riskColor[product.risk as keyof typeof riskColor] }]}>
                    {product.risk}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Min</Text>
                  <Text style={styles.statValue}>${product.minAmount}</Text>
                </View>
              </View>

              {isSelected && (
                <TouchableOpacity
                  style={styles.investNowBtn}
                  onPress={() => {}}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[product.color, product.color + 'cc']} style={styles.investBtnGradient}>
                    <Ionicons name="trending-up" size={16} color="#fff" />
                    <Text style={styles.investBtnText}>Invest Now</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle" size={14} color={colors.textMuted} />
          <Text style={styles.disclaimerText}>
            Past performance is not indicative of future results. Investments involve risk.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: '#fff' },
  headerSub: { fontSize: typography.sm, color: 'rgba(255,255,255,0.7)', marginBottom: spacing.xl },
  portfolioCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.xl, padding: spacing.xl, gap: 4 },
  portfolioLabel: { fontSize: typography.xs, color: 'rgba(255,255,255,0.6)', fontWeight: typography.medium },
  portfolioValue: { fontSize: typography.xxxl, fontWeight: typography.extrabold, color: '#fff' },
  portfolioNote: { fontSize: typography.xs, color: 'rgba(255,255,255,0.5)' },

  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: 40 },
  sectionLabel: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },

  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, ...shadows.card, borderWidth: 1.5, borderColor: 'transparent' },
  cardSelected: { borderColor: colors.primary },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  productIcon: { width: 46, height: 46, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  productName: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  productDesc: { fontSize: typography.xs, color: colors.textSecondary, lineHeight: 17 },
  ilpBadge: { backgroundColor: '#ede9fe', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  ilpBadgeText: { fontSize: 10, fontWeight: typography.bold, color: '#7c3aed' },

  cardStats: { flexDirection: 'row', backgroundColor: colors.inputBg, borderRadius: radius.lg, overflow: 'hidden' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statDivider: { width: 1, backgroundColor: colors.divider },
  statLabel: { fontSize: typography.xs, color: colors.textMuted, marginBottom: 3 },
  statValue: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },

  investNowBtn: { borderRadius: radius.lg, overflow: 'hidden' },
  investBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 8 },
  investBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: '#fff' },

  disclaimer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingHorizontal: spacing.sm },
  disclaimerText: { flex: 1, fontSize: typography.xs, color: colors.textMuted, lineHeight: 17 },
});
