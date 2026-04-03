import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';
import { useAuth } from '../context/AuthContext';

export default function OnboardingScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '' });

  const update = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      // AuthContext route guard redirects to /dashboard
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.message ?? 'Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ icon, label, field, type = 'default' }: { icon: string; label: string; field: keyof typeof form; type?: string }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={form[field]}
          onChangeText={v => update(field, v)}
          keyboardType={type as any}
          secureTextEntry={field === 'password'}
          autoCapitalize={field === 'email' ? 'none' : 'words'}
          placeholderTextColor={colors.textMuted}
          placeholder={field === 'phone' ? '(555) 123-4567' : field === 'email' ? 'john@email.com' : ''}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <LinearGradient colors={['#f4faf7', '#e6f7f0']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => step > 1 ? setStep(s => s - 1) : router.back()}>
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

        <View style={styles.fields}>
          {step === 1 ? (
            <>
              <Field icon="person" label="First Name" field="firstName" />
              <Field icon="person" label="Last Name" field="lastName" />
              <Field icon="call" label="Phone Number (optional)" field="phone" type="phone-pad" />
            </>
          ) : (
            <>
              <Field icon="mail" label="Email Address" field="email" type="email-address" />
              <Field icon="lock-closed" label="Create Password" field="password" />
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
