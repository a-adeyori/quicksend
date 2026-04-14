import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWallet } from '../context/WalletContext';
import { colors, spacing, radius, typography, shadows, textInputWeb } from '../utils/theme';
import { api } from '../services/apiClient';
import type { QuoteResult } from '../services/paymentsService';

interface SearchUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  walletAddress: string | null;
  assetCode: string;
}

interface SelectedRecipient {
  id: string;
  username: string;
  name: string;
  initials: string;
  walletAddress: string | null;
}

const QUICK_AMOUNTS = ['10', '25', '50', '100'];
const AVATAR_COLORS = ['#D1FAE5', '#E0F2FE', '#FEF3C7', '#EDE9FE', '#FFE4E6', '#D1E8FF'];

function colorForUsername(username: string): string {
  let hash = 0;
  for (const c of username) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function SendMoneyScreen() {
  const router = useRouter();
  const { sendMoney, getQuote } = useWallet();

  const [recipient, setRecipient] = useState<SelectedRecipient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'review' | 'sending' | 'success'>('form');
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const reviewAnim = useRef(new Animated.Value(0)).current;
  const successIconScale = useRef(new Animated.Value(0)).current;
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== 'success') return;
    successIconScale.setValue(0);
    Animated.spring(successIconScale, {
      toValue: 1, useNativeDriver: true, tension: 60, friction: 10,
    }).start();
  }, [step]);

  // ── Live search ────────────────────────────────────────────────────────────
  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      const users: SearchUser[] = (res.data.users ?? []).map((u: SearchUser) => ({
        ...u,
        initials: u.name
          ? u.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
          : u.username.slice(0, 2).toUpperCase(),
      }));
      setSearchResults(users);
      setShowDropdown(users.length > 0);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (text: string) => {
    // Strip leading @ for convenience
    const q = text.startsWith('@') ? text.slice(1) : text;
    setSearchQuery(text);
    setRecipient(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchUsers(q), 300);
  };

  const selectUser = (user: SearchUser) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setRecipient({
      id: user.id,
      username: user.username,
      name: user.name,
      initials: user.initials,
      walletAddress: user.walletAddress,
    });
    setSearchQuery(`@${user.username}`);
    setSearchResults([]);
    setShowDropdown(false);
    Keyboard.dismiss();
  };

  const clearRecipient = () => {
    setRecipient(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  // ── Review / send ──────────────────────────────────────────────────────────
  const canReview = !!recipient && parseFloat(amount) >= 1;

  const openReview = async () => {
    Keyboard.dismiss();
    setLoadingQuote(true);
    const q = await getQuote(recipient?.walletAddress ?? '', parseFloat(amount));
    setQuote(q ?? null);
    setLoadingQuote(false);
    setStep('review');
    Animated.spring(reviewAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };

  const closeReview = () => {
    Animated.timing(reviewAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setStep('form'));
  };

  const confirmSend = async () => {
    if (!recipient) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('sending');

    const result = await sendMoney({
      ...(recipient.username ? { recipientUsername: recipient.username } : {}),
      ...(recipient.walletAddress ? { recipientWalletAddress: recipient.walletAddress } : {}),
      recipientName: recipient.name,
      amountDollars: parseFloat(amount),
      note: note || undefined,
    });

    if (result.success) {
      setPaymentId(result.paymentId ?? null);
      setStep('success');
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setStep('review');
      Alert.alert('Payment Failed', result.error ?? 'Something went wrong. Please try again.');
    }
  };

  const handleQuickAmount = (a: string) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setAmount(a);
  };

  const resetForm = () => {
    setStep('form');
    setAmount('');
    setNote('');
    clearRecipient();
    setQuote(null);
  };

  // ── Success view ───────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <View style={styles.successContainer}>
        <LinearGradient colors={['#f4faf7', '#e6f7f0']} style={StyleSheet.absoluteFill} />
        <View style={styles.successContent}>
          <Animated.View style={{ transform: [{ scale: successIconScale }] }}>
            <View style={styles.successIcon}>
              <LinearGradient colors={[colors.primaryMid, colors.primary]} style={styles.successIconGradient}>
                <Ionicons name="checkmark" size={40} color="#fff" />
              </LinearGradient>
            </View>
          </Animated.View>
          <Text style={styles.successTitle}>Payment sent!</Text>
          <Text style={styles.successSubtitle}>
            {`$${parseFloat(amount).toFixed(2)} sent to ${recipient?.name ?? 'recipient'}. You're all set.`}
          </Text>

          <View style={styles.successDetails}>
            {[
              { label: 'To', value: `${recipient?.name} (@${recipient?.username})` },
              { label: 'Amount', value: `$${parseFloat(amount).toFixed(2)}`, highlight: true },
              { label: 'Fee', value: quote?.estimatedFee ?? '$0.00' },
              { label: 'Date', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
              { label: 'Payment ID', value: paymentId ? paymentId.slice(0, 16) + '...' : '—' },
              { label: 'Status', badge: true },
            ].map((row, i) => (
              <View key={i} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{row.label}</Text>
                {row.badge ? (
                  <View style={styles.completedBadge}>
                    <View style={styles.completedDot} />
                    <Text style={styles.completedText}>Completed</Text>
                  </View>
                ) : (
                  <Text style={[styles.detailValue, (row as any).highlight && styles.detailValueHighlight]}>
                    {row.value}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.successActions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/dashboard')}>
              <LinearGradient colors={[colors.primaryMid, colors.primary]} style={styles.btnGradient}>
                <Ionicons name="home" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Back to Home</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={resetForm}>
              <Text style={styles.ghostBtnText}>Send More Money</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Money</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Recipient search ──────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Send to</Text>

          {/* Selected recipient chip */}
          {recipient ? (
            <View style={styles.selectedChip}>
              <View style={[styles.chipAvatar, { backgroundColor: colorForUsername(recipient.username) }]}>
                <Text style={styles.chipInitials}>{recipient.initials}</Text>
              </View>
              <View style={styles.chipInfo}>
                <Text style={styles.chipName}>{recipient.name}</Text>
                <Text style={styles.chipUsername}>@{recipient.username}</Text>
              </View>
              <TouchableOpacity onPress={clearRecipient} style={styles.chipClear}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.searchWrapper}>
              <Ionicons name="search" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, textInputWeb]}
                placeholder="Search by @username or name"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                underlineColorAndroid="transparent"
              />
              {searchLoading && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
          )}

          {/* Search dropdown */}
          {showDropdown && !recipient && (
            <View style={styles.dropdown}>
              {searchResults.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.dropdownItem}
                  onPress={() => selectUser(user)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.dropdownAvatar, { backgroundColor: colorForUsername(user.username) }]}>
                    <Text style={styles.dropdownInitials}>{user.initials}</Text>
                  </View>
                  <View style={styles.dropdownInfo}>
                    <Text style={styles.dropdownName}>{user.name}</Text>
                    <Text style={styles.dropdownUsername}>@{user.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* No results hint */}
          {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && !recipient && (
            <View style={styles.noResults}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
              <Text style={styles.noResultsText}>No users found for "{searchQuery}"</Text>
            </View>
          )}

          {/* ── Amount ───────────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Amount</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="cash" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.amountInput, textInputWeb]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={(v) => {
                if (v === '0' || (v.startsWith('0') && !v.startsWith('0.'))) return;
                setAmount(v);
              }}
              keyboardType="decimal-pad"
              returnKeyType="done"
              underlineColorAndroid="transparent"
            />
            <Text style={styles.currencyTag}>USD</Text>
          </View>

          <View style={styles.quickAmounts}>
            {QUICK_AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.quickBtn, amount === a && styles.quickBtnActive]}
                onPress={() => handleQuickAmount(a)}
                activeOpacity={0.8}
              >
                <Text style={[styles.quickBtnText, amount === a && styles.quickBtnTextActive]}>
                  ${a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Note ─────────────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Note (optional)</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, textInputWeb]}
              placeholder="What's this for?"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
              underlineColorAndroid="transparent"
            />
          </View>

        </ScrollView>

        {/* CTA */}
        <View style={styles.ctaContainer}>
          {!recipient && (
            <Text style={styles.ctaHint}>Search for a QuickSend user to send money</Text>
          )}
          <TouchableOpacity
            style={[styles.primaryBtn, !canReview && styles.primaryBtnDisabled]}
            onPress={openReview}
            disabled={!canReview || loadingQuote}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canReview ? [colors.primaryMid, colors.primary] : ['#ccc', '#bbb']}
              style={styles.btnGradient}
            >
              {loadingQuote ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Review & Send</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Review Sheet */}
      {(step === 'review' || step === 'sending') && (
        <Animated.View style={[styles.reviewOverlay, { opacity: reviewAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeReview} activeOpacity={1} />
          <Animated.View
            style={[
              styles.reviewSheet,
              { transform: [{ translateY: reviewAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Review Transfer</Text>
              {step !== 'sending' && (
                <TouchableOpacity style={styles.sheetClose} onPress={closeReview}>
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Recipient summary */}
            {recipient && (
              <View style={styles.reviewRecipient}>
                <View style={[styles.reviewAvatar, { backgroundColor: colorForUsername(recipient.username) }]}>
                  <Text style={styles.reviewInitials}>{recipient.initials}</Text>
                </View>
                <View>
                  <Text style={styles.reviewRecipientName}>{recipient.name}</Text>
                  <Text style={styles.reviewRecipientUsername}>@{recipient.username}</Text>
                </View>
              </View>
            )}

            <View style={styles.reviewDetails}>
              {[
                { label: 'Amount', value: `$${parseFloat(amount).toFixed(2)}`, highlight: true },
                { label: 'Network Fee', value: quote?.estimatedFee ?? '$0.00' },
                { label: 'Total', value: quote?.totalDebit ?? `$${parseFloat(amount).toFixed(2)}` },
                { label: 'Network', value: 'QuickSend / Interledger' },
              ].map((row, i, arr) => (
                <View key={i} style={[styles.detailRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={[styles.detailValue, (row as any).highlight && styles.detailValueHighlight]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={confirmSend}
              disabled={step === 'sending'}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[colors.primaryMid, colors.primary]} style={styles.btnGradient}>
                {step === 'sending' ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.primaryBtnText}>Sending…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Confirm & Send</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {step === 'sending' && (
              <Text style={styles.sendingMessage}>Processing your payment — almost done.</Text>
            )}
            <Text style={styles.ilpNote}>⚡ Powered by Interledger Protocol · Rafiki Network</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: 120 },
  sectionLabel: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary, marginBottom: spacing.sm },

  // Search
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56, ...shadows.card },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, fontSize: typography.base, color: colors.textPrimary },

  // Selected chip
  selectedChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md, borderWidth: 1.5, borderColor: colors.primary },
  chipAvatar: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  chipInitials: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.textPrimary },
  chipInfo: { flex: 1, gap: 2 },
  chipName: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  chipUsername: { fontSize: typography.xs, color: colors.primary, fontWeight: typography.semibold },
  chipClear: { padding: 4 },

  // Dropdown
  dropdown: { backgroundColor: colors.card, borderRadius: radius.xl, marginTop: spacing.sm, overflow: 'hidden', ...shadows.elevated },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dropdownAvatar: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dropdownInitials: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.textPrimary },
  dropdownInfo: { flex: 1, gap: 2 },
  dropdownName: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textPrimary },
  dropdownUsername: { fontSize: typography.xs, color: colors.textMuted },

  // No results
  noResults: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  noResultsText: { fontSize: typography.sm, color: colors.textMuted },

  // Amount
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56, ...shadows.card },
  amountInput: { fontSize: typography.xxl, fontWeight: typography.bold },
  currencyTag: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary },
  quickAmounts: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.card, alignItems: 'center', ...shadows.card },
  quickBtnActive: { backgroundColor: colors.primary },
  quickBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  quickBtnTextActive: { color: '#fff' },

  // CTA
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.xl, paddingBottom: 36, backgroundColor: colors.background, ...shadows.bottom },
  ctaHint: { fontSize: typography.xs, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  primaryBtn: { borderRadius: radius.xl, overflow: 'hidden' },
  primaryBtnDisabled: { opacity: 0.5 },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: spacing.sm },
  primaryBtnText: { fontSize: typography.md, fontWeight: typography.bold, color: '#fff' },

  // Review sheet
  reviewOverlay: { position: 'absolute', inset: 0, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  reviewSheet: { backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: spacing.xl, paddingBottom: 40, ...shadows.elevated },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  sheetClose: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  reviewRecipient: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.inputBg, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
  reviewAvatar: { width: 46, height: 46, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  reviewInitials: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  reviewRecipientName: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  reviewRecipientUsername: { fontSize: typography.xs, color: colors.primary, fontWeight: typography.semibold },
  reviewDetails: { backgroundColor: colors.inputBg, borderRadius: radius.xl, marginBottom: spacing.xl, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  detailLabel: { fontSize: typography.sm, color: colors.textSecondary },
  detailValue: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textPrimary },
  detailValueHighlight: { fontSize: typography.xl, fontWeight: typography.extrabold, color: colors.primary },
  ilpNote: { textAlign: 'center', fontSize: typography.xs, color: colors.textMuted, marginTop: spacing.md },
  sendingMessage: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.primary, textAlign: 'center', marginBottom: spacing.sm },

  // Success
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successContent: { width: '100%', alignItems: 'center', gap: spacing.md },
  successIcon: { marginBottom: spacing.md },
  successIconGradient: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: typography.xxl, fontWeight: typography.extrabold, color: colors.textPrimary },
  successSubtitle: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.md, lineHeight: 22 },
  successDetails: { width: '100%', backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', marginVertical: spacing.md, ...shadows.card },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  completedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  completedText: { fontSize: typography.xs, fontWeight: typography.bold, color: colors.primary },
  successActions: { width: '100%', gap: spacing.md },
  ghostBtn: { alignItems: 'center', paddingVertical: spacing.md },
  ghostBtnText: { fontSize: typography.base, color: colors.primary, fontWeight: typography.semibold },
});
