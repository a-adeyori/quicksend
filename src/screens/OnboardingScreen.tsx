import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, shadows, textInputWeb } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { isApiError } from '../services/apiClient';

function regErrorMessage(err: unknown): string {
  if (isApiError(err)) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Could not create your account. Please try again.';
}

type FormState = { firstName: string; lastName: string; phone: string; email: string; password: string };

/** Must be outside the screen: an inner component remounts every render and kills TextInput focus on web/native. */
function OnboardingField({
  icon,
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  placeholder = '',
  autoCapitalize = 'words',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.input, textInputWeb]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          placeholderTextColor={colors.textMuted}
          placeholder={placeholder}
          underlineColorAndroid="transparent"
        />
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ firstName: '', lastName: '', phone: '', email: '', password: '' });

  const update = (k: keyof FormState, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setErrorMessage('Please fill in all required fields (first name, last name, email, password).');
      return;
    }
    if (form.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      // AuthContext clears session and navigates to /login?registered=1
    } catch (err: unknown) {
      const msg = regErrorMessage(err);
      setErrorMessage(msg);
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <LinearGradient colors={['#f4faf7', '#e6f7f0']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (step > 1) setStep(s => s - 1);
              else if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.stepLabel}>Step {step} of 2</Text>
            <Text style={styles.stepTitle}>{step === 1 ? 'Your Information' : 'Secure Your Account'}</Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          {[1, 2].map(s => (
            <View key={s} style={[styles.progressSegment, s <= step && styles.progressActive]} />
          ))}
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.fields}>
          {step === 1 ? (
            <>
              <OnboardingField icon="person" label="First Name" value={form.firstName} onChangeText={t => update('firstName', t)} />
              <OnboardingField icon="person" label="Last Name" value={form.lastName} onChangeText={t => update('lastName', t)} />
              <OnboardingField
                icon="call"
                label="Phone Number (optional)"
                value={form.phone}
                onChangeText={t => update('phone', t)}
                keyboardType="phone-pad"
                placeholder="(555) 123-4567"
              />
            </>
          ) : (
            <>
              <OnboardingField
                icon="mail"
                label="Email Address"
                value={form.email}
                onChangeText={t => update('email', t)}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="john@email.com"
              />
              <OnboardingField
                icon="lock-closed"
                label="Create Password"
                value={form.password}
                onChangeText={t => update('password', t)}
                secureTextEntry
                autoCapitalize="none"
              />
              <Text style={styles.hint}>At least 8 characters</Text>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.ctaBtn, loading && { opacity: 0.7 }]}
          onPress={() => step < 2 ? setStep(2) : handleSubmit()}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.primaryMid, colors.primary]}
            style={styles.btnGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>{step < 2 ? 'Continue' : 'Create My Account'}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.xl, paddingTop: 60, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  backBtn: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  stepLabel: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.medium },
  stepTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary },
  progressBar: { flexDirection: 'row', gap: spacing.sm },
  progressSegment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border },
  progressActive: { backgroundColor: colors.primary },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#fef2f2',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorBannerText: { flex: 1, fontSize: typography.sm, color: colors.error, fontWeight: typography.medium },
  fields: { gap: spacing.lg, flex: 1 },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textPrimary },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56, ...shadows.card },
  input: { flex: 1, fontSize: typography.md, color: colors.textPrimary },
  hint: { fontSize: typography.xs, color: colors.textMuted, marginTop: -spacing.sm },
  ctaBtn: { borderRadius: radius.xl, overflow: 'hidden', marginTop: 'auto' },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: spacing.sm },
  ctaText: { fontSize: typography.md, fontWeight: typography.bold, color: '#fff' },
});
