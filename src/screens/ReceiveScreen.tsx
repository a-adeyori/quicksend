import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWallet } from '../context/WalletContext';
import { RAFIKI_CONFIG } from '../services/rafikiService';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';

// Simple QR-code-like visual built from SVG concepts using View grids
function QRVisual({ value }: { value: string }) {
  // Generate a deterministic grid from the value string
  const size = 10;
  const hash = value.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const grid: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    grid[r] = [];
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      grid[r][c] = ((hash * (idx + 7) * 31) % 100) < 55;
    }
  }
  // Finder pattern corners
  [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]].forEach(([r,c])=>{ grid[r][c]=true; });
  [[0,7],[0,8],[0,9],[1,7],[1,9],[2,7],[2,8],[2,9]].forEach(([r,c])=>{ grid[r][c]=true; });
  [[7,0],[8,0],[9,0],[7,1],[9,1],[7,2],[8,2],[9,2]].forEach(([r,c])=>{ grid[r][c]=true; });

  const cell = 22;
  return (
    <View style={qrStyles.container}>
      {grid.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((filled, ci) => (
            <View
              key={ci}
              style={[
                qrStyles.cell,
                { width: cell, height: cell },
                filled ? qrStyles.filled : qrStyles.empty,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const qrStyles = StyleSheet.create({
  container: { padding: 12, backgroundColor: '#fff', borderRadius: 12 },
  cell: { borderRadius: 2 },
  filled: { backgroundColor: '#1a2e24' },
  empty: { backgroundColor: '#fff' },
});

export default function ReceiveScreen() {
  const router = useRouter();
  const { walletAddress, isConnected } = useWallet();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const displayAddress = walletAddress || RAFIKI_CONFIG.clientWalletAddress;

  const createPaymentRequest = async () => {
    setCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise(r => setTimeout(r, 1000)); // simulate API call

    // In production: call rafikiService.createIncomingPayment(walletAddress, accessToken, ...)
    const mockPaymentUrl = amount
      ? `${displayAddress}?amount=${amount}&note=${encodeURIComponent(note)}`
      : displayAddress;

    setPaymentUrl(mockPaymentUrl);
    setCreating(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const shareAddress = async () => {
    const url = paymentUrl || displayAddress;
    try {
      await Share.share({
        message: `Send money to my QuickSend ILP wallet:\n${url}`,
        url,
        title: 'My QuickSend Wallet Address',
      });
    } catch {}
  };

  const copyAddress = () => {
    Haptics.selectionAsync();
    Alert.alert('Copied!', 'Wallet address copied to clipboard.');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#f4faf7', '#e6f7f0']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive Money</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* QR + address card */}
        <View style={styles.qrCard}>
          <View style={styles.qrWrapper}>
            <QRVisual value={paymentUrl || displayAddress} />
          </View>

          <View style={styles.addressRow}>
            <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
              {paymentUrl || displayAddress}
            </Text>
            <TouchableOpacity style={styles.copyBtn} onPress={copyAddress}>
              <Ionicons name="copy-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {isConnected ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>ILP Wallet Connected</Text>
            </View>
          ) : (
            <View style={[styles.liveBadge, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="information-circle" size={12} color={colors.warning} />
              <Text style={[styles.liveText, { color: colors.warning }]}>Demo Address</Text>
            </View>
          )}
        </View>

        {/* Custom amount */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Request Specific Amount (optional)</Text>

          <View style={styles.inputRow}>
            <Ionicons name="cash" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.currency}>USD</Text>
          </View>

          <View style={[styles.inputRow, { marginTop: spacing.sm }]}>
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Add a note..."
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
            />
          </View>

          <TouchableOpacity
            style={styles.generateBtn}
            onPress={createPaymentRequest}
            disabled={creating}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[colors.primaryMid, colors.primary]} style={styles.btnGradient}>
              {creating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={styles.generateBtnText}>
                    {paymentUrl ? 'Regenerate ILP Request' : 'Create ILP Payment Request'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Share */}
        <TouchableOpacity style={styles.shareBtn} onPress={shareAddress} activeOpacity={0.85}>
          <Ionicons name="share-social" size={20} color={colors.primary} />
          <Text style={styles.shareBtnText}>Share Wallet Address</Text>
        </TouchableOpacity>

        <Text style={styles.ilpNote}>
          ⚡ Share your Open Payments wallet address with anyone to receive money via ILP — no bank account needed.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.card,
  },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },

  content: { flex: 1, padding: spacing.xl, gap: spacing.xl },

  qrCard: {
    backgroundColor: colors.card, borderRadius: radius.xxl, padding: spacing.xl,
    alignItems: 'center', gap: spacing.lg, ...shadows.elevated,
  },
  qrWrapper: { ...shadows.card },
  addressRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.inputBg, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, width: '100%',
  },
  addressText: { flex: 1, fontSize: typography.xs, color: colors.textSecondary, fontFamily: 'monospace' },
  copyBtn: {
    width: 30, height: 30, borderRadius: radius.md,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#d1fae5', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  liveText: { fontSize: typography.xs, fontWeight: typography.semibold, color: colors.primary },

  section: { gap: spacing.sm },
  sectionLabel: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, height: 52, ...shadows.card,
  },
  input: { flex: 1, fontSize: typography.base, color: colors.textPrimary },
  currency: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary },

  generateBtn: { borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.sm },
  btnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, gap: spacing.sm,
  },
  generateBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: '#fff' },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.xl, paddingVertical: 16,
    borderWidth: 1.5, borderColor: colors.border, ...shadows.card,
  },
  shareBtnText: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.primary },

  ilpNote: {
    textAlign: 'center', fontSize: typography.xs, color: colors.textMuted,
    lineHeight: 18, paddingHorizontal: spacing.lg,
  },
});
