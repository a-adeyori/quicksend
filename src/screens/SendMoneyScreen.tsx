import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWallet } from '../context/WalletContext';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';

interface Contact {
  id: string;
  name: string;
  initials: string;
  color: string;
  walletAddress: string;
}

const QUICK_AMOUNTS = ['10', '25', '50', '100'];

export default function SendMoneyScreen() {
  const router = useRouter();
  const { contacts, sendMoney, getQuote, isLoading } = useWallet();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [manualRecipient, setManualRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'review' | 'sending' | 'success'>('form');
  const [quote, setQuote] = useState<{ fee: string; total: string } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const reviewAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const recipient = selectedContact?.name ?? manualRecipient;
  const recipientWallet = selectedContact?.walletAddress ?? `https://wallet.example.com/${manualRecipient.toLowerCase().replace(/\s+/g, '-')}`;
  const canReview = recipient.trim().length > 0 && parseFloat(amount) >= 1;

  const openReview = async () => {
    Keyboard.dismiss();
    setLoadingQuote(true);
    const q = await getQuote(recipientWallet, parseFloat(amount));
    setQuote(q);
    setLoadingQuote(false);
    setStep('review');
    Animated.spring(reviewAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeReview = () => {
    Animated.timing(reviewAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setStep('form'));
  };

  const confirmSend = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('sending');

    const result = await sendMoney({
      recipientWalletAddress: recipientWallet,
      recipientName: recipient,
      amountDollars: parseFloat(amount),
      note: note || undefined,
    });

    if (result.success) {
      setPaymentId(result.paymentId ?? null);
      setStep('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(successAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }).start();
    } else {
      setStep('review');
      Alert.alert('Payment Failed', result.error ?? 'Something went wrong. Please try again.');
    }
  };

  const handleContactSelect = (contact: Contact) => {
    Haptics.selectionAsync();
    setSelectedContact(selectedContact?.id === contact.id ? null : contact);
    if (selectedContact?.id !== contact.id) setManualRecipient('');
  };

  const handleQuickAmount = (a: string) => {
    Haptics.selectionAsync();
    setAmount(a);
  };

  // ── Success view ───────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <View style={styles.successContainer}>
        <LinearGradient colors={['#f4faf7', '#e6f7f0']} style={StyleSheet.absoluteFill} />
        <Animated.View
          style={[
            styles.successContent,
            {
              opacity: successAnim,
              transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
            },
          ]}
        >
          <View style={styles.successIcon}>
            <LinearGradient
              colors={[colors.primaryMid, colors.primary]}
              style={styles.successIconGradient}
            >
              <Ionicons name="checkmark" size={40} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.successTitle}>Money Sent!</Text>
          <Text style={styles.successSubtitle}>Your payment was sent successfully via ILP.</Text>

          <View style={styles.successDetails}>
            {[
              { label: 'To', value: recipient },
              { label: 'Amount', value: `$${parseFloat(amount).toFixed(2)}`, highlight: true },
              { label: 'Fee', value: quote?.fee ?? '$0.02' },
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
                  <Text style={[styles.detailValue, row.highlight && styles.detailValueHighlight]}>
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
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => { setStep('form'); setAmount(''); setSelectedContact(null); setManualRecipient(''); setNote(''); }}
            >
              <Text style={styles.ghostBtnText}>Send More Money</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
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
          {/* Contacts */}
          <Text style={styles.sectionLabel}>Saved Contacts</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.contactsRow}
            style={styles.contactsScroll}
          >
            {contacts.map((c: Contact) => {
              const isSelected = selectedContact?.id === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.contactCard, isSelected && styles.contactCardSelected]}
                  onPress={() => handleContactSelect(c)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.contactAvatar, { backgroundColor: c.color }]}>
                    <Text style={styles.contactInitials}>{c.initials}</Text>
                  </View>
                  <Text style={styles.contactName} numberOfLines={2}>
                    {c.name.split(' (')[0]}
                  </Text>
                  {isSelected && (
                    <View style={styles.contactCheck}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Manual recipient */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Or enter manually</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Name or wallet address"
              placeholderTextColor={colors.textMuted}
              value={manualRecipient}
              onChangeText={(v) => {
                setManualRecipient(v);
                setSelectedContact(null);
              }}
              returnKeyType="next"
            />
          </View>

          {/* Amount */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Amount</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="cash" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.amountInput]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={(v) => {
                if (v === '0' || (v.startsWith('0') && !v.startsWith('0.'))) return;
                setAmount(v);
              }}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <Text style={styles.currencyTag}>USD</Text>
          </View>

          {/* Quick amounts */}
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

          {/* Note */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Note (optional)</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="What's this for?"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
            />
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={styles.ctaContainer}>
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
      {step === 'review' || step === 'sending' ? (
        <Animated.View
          style={[
            styles.reviewOverlay,
            { opacity: reviewAnim },
          ]}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeReview} activeOpacity={1} />
          <Animated.View
            style={[
              styles.reviewSheet,
              {
                transform: [
                  {
                    translateY: reviewAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
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

            <View style={styles.reviewDetails}>
              {[
                { label: 'To', value: recipient },
                { label: 'Amount', value: `$${parseFloat(amount).toFixed(2)}`, highlight: true },
                { label: 'Network Fee', value: quote?.fee ?? 'Calculating...' },
                { label: 'Total Debit', value: quote?.total ?? `$${parseFloat(amount).toFixed(2)}` },
                { label: 'Network', value: 'Interledger (ILP)' },
              ].map((row, i, arr) => (
                <View key={i} style={[styles.detailRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={[styles.detailValue, row.highlight && styles.detailValueHighlight]}>
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
                    <Text style={styles.primaryBtnText}>Sending via ILP...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Confirm & Send</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.ilpNote}>
              ⚡ Powered by Interledger Protocol · Rafiki Network
            </Text>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },

  // Form
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  sectionLabel: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary, marginBottom: spacing.sm },

  // Contacts
  contactsScroll: { marginHorizontal: -spacing.xl },
  contactsRow: { paddingHorizontal: spacing.xl, gap: spacing.md },
  contactCard: { alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, minWidth: 80, ...shadows.card },
  contactCardSelected: { backgroundColor: colors.primaryLight, borderWidth: 2, borderColor: colors.primary },
  contactAvatar: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  contactInitials: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.textPrimary },
  contactName: { fontSize: 11, fontWeight: typography.semibold, color: colors.textPrimary, textAlign: 'center' },
  contactCheck: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  // Input
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56, ...shadows.card },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, fontSize: typography.base, color: colors.textPrimary },
  amountInput: { fontSize: typography.xxl, fontWeight: typography.bold },
  currencyTag: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary },

  // Quick amounts
  quickAmounts: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.card, alignItems: 'center', ...shadows.card },
  quickBtnActive: { backgroundColor: colors.primary },
  quickBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  quickBtnTextActive: { color: '#fff' },

  // CTA
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.xl, paddingBottom: 36, backgroundColor: colors.background, ...shadows.bottom },
  primaryBtn: { borderRadius: radius.xl, overflow: 'hidden' },
  primaryBtnDisabled: { opacity: 0.5 },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: spacing.sm },
  primaryBtnText: { fontSize: typography.md, fontWeight: typography.bold, color: '#fff' },

  // Review sheet
  reviewOverlay: { position: 'absolute', inset: 0, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  reviewSheet: { backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: spacing.xl, paddingBottom: 40, ...shadows.elevated },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  sheetTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  sheetClose: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  reviewDetails: { backgroundColor: colors.inputBg, borderRadius: radius.xl, marginBottom: spacing.xl, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  detailLabel: { fontSize: typography.sm, color: colors.textSecondary },
  detailValue: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textPrimary },
  detailValueHighlight: { fontSize: typography.xl, fontWeight: typography.extrabold, color: colors.primary },
  ilpNote: { textAlign: 'center', fontSize: typography.xs, color: colors.textMuted, marginTop: spacing.md },

  // Success
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successContent: { width: '100%', alignItems: 'center', gap: spacing.md },
  successIcon: { marginBottom: spacing.md },
  successIconGradient: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: typography.xxl, fontWeight: typography.extrabold, color: colors.textPrimary },
  successSubtitle: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center' },
  successDetails: { width: '100%', backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', marginVertical: spacing.md, ...shadows.card },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  completedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  completedText: { fontSize: typography.xs, fontWeight: typography.bold, color: colors.primary },
  successActions: { width: '100%', gap: spacing.md },
  ghostBtn: { alignItems: 'center', paddingVertical: spacing.md },
  ghostBtnText: { fontSize: typography.base, color: colors.primary, fontWeight: typography.semibold },
});
