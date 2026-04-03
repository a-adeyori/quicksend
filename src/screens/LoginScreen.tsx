import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
      // AuthContext route guard handles redirect to /dashboard
    } catch (err: any) {
      Alert.alert('Sign In Failed', err?.message ?? 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to QuickSend',
      fallbackLabel: 'Use PIN',
    });
    if (result.success) router.replace('/dashboard');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <LinearGradient colors={['#f4faf7', '#e6f7f0']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="flash" size={32} color={colors.primary} />
          </View>
          <Text style={styles.logoTitle}>Welcome Back</Text>
          <Text style={styles.logoSub}>Sign in to your QuickSend account</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Email or username"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Sign In */}
        <TouchableOpacity style={styles.signInBtn} onPress={handleLogin} activeOpacity={0.85} disabled={loading}>
          <LinearGradient colors={loading ? ['#aaa','#999'] : [colors.primaryMid, colors.primary]} style={styles.btnGradient}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInText}>Sign In</Text>}
          </LinearGradient>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Biometric */}
        <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric} activeOpacity={0.85}>
          <Ionicons name="scan" size={22} color={colors.primary} />
          <Text style={styles.biometricText}>Face ID / Fingerprint</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Don't have an account?{' '}
          <Text style={styles.footerLink} onPress={() => router.push('/onboarding')}>
            Sign up
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.xl, paddingTop: 60, gap: spacing.xl },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', ...shadows.card },
  logoSection: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  logoCircle: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  logoTitle: { fontSize: typography.xxl, fontWeight: typography.extrabold, color: colors.textPrimary },
  logoSub: { fontSize: typography.base, color: colors.textSecondary },
  form: { gap: spacing.md },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56, ...shadows.card },
  input: { flex: 1, fontSize: typography.base, color: colors.textPrimary },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.semibold },
  signInBtn: { borderRadius: radius.xl, overflow: 'hidden' },
  btnGradient: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  signInText: { fontSize: typography.md, fontWeight: typography.bold, color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: typography.sm, color: colors.textMuted },
  biometricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, paddingVertical: 16, borderWidth: 1.5, borderColor: colors.border },
  biometricText: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.primary },
  footer: { textAlign: 'center', fontSize: typography.sm, color: colors.textSecondary },
  footerLink: { color: colors.primary, fontWeight: typography.bold },
});
