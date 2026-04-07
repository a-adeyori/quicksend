import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, spacing, radius, typography, shadows, textInputWeb } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { isApiError } from '../services/apiClient';
import { isFrontendOnly, useAutoDemoSession } from '../config/demo';

function errMessage(err: unknown): string {
  if (isApiError(err)) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Invalid email or password.';
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ registered?: string }>();
  const { login, enterDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRegisteredBanner, setShowRegisteredBanner] = useState(false);

  useEffect(() => {
    if (params.registered === '1' || params.registered === 'true') {
      setShowRegisteredBanner(true);
    }
  }, [params.registered]);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const msg = errMessage(err);
      setErrorMessage(msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Sign In Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Biometric sign-in is available in the mobile app.');
      return;
    }
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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        >
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

        {showRegisteredBanner ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.successBannerText}>Account created. Sign in with your email and password.</Text>
            <TouchableOpacity onPress={() => setShowRegisteredBanner(false)} hitSlop={12}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.input, textInputWeb]}
              placeholder="Email or username"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errorMessage) setErrorMessage(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              underlineColorAndroid="transparent"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.input, textInputWeb]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errorMessage) setErrorMessage(null);
              }}
              secureTextEntry={!showPass}
              underlineColorAndroid="transparent"
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

        {(isFrontendOnly || useAutoDemoSession) && (
          <TouchableOpacity
            style={styles.demoLaunch}
            onPress={() => {
              enterDemo();
              router.replace('/dashboard');
            }}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#1e3a5f', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.demoLaunchGradient}
            >
              <Ionicons name="flash" size={22} color="#93c5fd" />
              <View style={styles.demoLaunchText}>
                <Text style={styles.demoLaunchTitle}>Try the interactive demo</Text>
                <Text style={styles.demoLaunchSub}>No server · Simulated money · Saves on this device</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successBannerText: { flex: 1, fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.medium },
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
  form: { gap: spacing.md },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56, ...shadows.card },
  input: { flex: 1, fontSize: typography.base, color: colors.textPrimary },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.semibold },
  signInBtn: { borderRadius: radius.xl, overflow: 'hidden' },
  btnGradient: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  demoLaunch: { borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.sm },
  demoLaunchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  demoLaunchText: { flex: 1, gap: 4 },
  demoLaunchTitle: { fontSize: typography.md, fontWeight: typography.bold, color: '#fff' },
  demoLaunchSub: { fontSize: typography.xs, color: '#93c5fd', lineHeight: 16 },
  signInText: { fontSize: typography.md, fontWeight: typography.bold, color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: typography.sm, color: colors.textMuted },
  biometricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, paddingVertical: 16, borderWidth: 1.5, borderColor: colors.border },
  biometricText: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.primary },
  footer: { textAlign: 'center', fontSize: typography.sm, color: colors.textSecondary },
  footerLink: { color: colors.primary, fontWeight: typography.bold },
});
