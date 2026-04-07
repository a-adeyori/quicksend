import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, typography } from '../utils/theme';
import {
  canUseLocalDemoLogin,
  isDemoMode,
  isFrontendOnly,
  useDemoWallet,
  useLiveAuth,
} from '../config/demo';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const slides = [
  {
    icon: 'shield-checkmark',
    title: 'Simple & Secure',
    body: 'Big buttons, clear text, and bank-level security to keep your money safe.',
    accent: '#2d9e6b',
  },
  {
    icon: 'heart',
    title: 'Made for You',
    body: 'Designed with care for people who value simplicity over complexity.',
    accent: '#e05a4b',
  },
  {
    icon: 'mic',
    title: 'Voice Commands',
    body: 'Just say "Send daughter $20" and we\'ll handle the rest.',
    accent: '#3b82f6',
  },
  {
    icon: 'flash',
    title: 'ILP Powered',
    body: 'Instant payments via the Interledger Protocol — send to anyone, anywhere.',
    accent: '#e8a040',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { enterDemo } = useAuth();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (step < slides.length - 1) {
      animateTransition(step + 1);
    } else {
      router.push('/onboarding');
    }
  };

  if (step === -1) {
    // Landing screen
  }

  const slide = slides[step];

  return (
    <LinearGradient
      colors={['#f8fdfb', '#e8f8f1', '#cfead8', '#b8dfc9']}
      locations={[0, 0.35, 0.72, 1]}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />

      {/* Logo top */}
      <View style={styles.logoRow}>
        <View style={styles.logoCircle}>
          <Ionicons name="flash" size={28} color={colors.primary} />
        </View>
        <Text style={styles.logoText}>QuickSend</Text>
      </View>

      {/* Slide content */}
      <Animated.View
        style={[
          styles.slideContent,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: slide.accent + '20' }]}>
          <Ionicons name={slide.icon as keyof typeof Ionicons.glyphMap} size={44} color={slide.accent} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === step && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleNext} activeOpacity={0.85}>
          <LinearGradient
            colors={[colors.primaryMid, colors.primary]}
            style={styles.btnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.primaryBtnText}>
              {step < slides.length - 1 ? 'Next' : 'Get Started'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.secondaryBtnText}>I already have an account</Text>
        </TouchableOpacity>

        {(isFrontendOnly || canUseLocalDemoLogin) ? (
          <TouchableOpacity
            style={styles.demoBtn}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              enterDemo();
            }}
            activeOpacity={0.88}
          >
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={styles.demoBtnText}>
              {isFrontendOnly
                ? 'Launch interactive demo — runs entirely in your browser'
                : 'Start interactive demo (no sign-in, no real money)'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        {isFrontendOnly
          ? '✨ 100% offline UI · Your session & demo wallet stay on this device'
          : useDemoWallet && !useLiveAuth
          ? '🎮 Demo build — simulated money & flows · Not financial advice'
          : isDemoMode && useLiveAuth
            ? '🔐 Secure account · Simulated balance · Add ILP token in Settings · Not financial advice'
            : '🔒 FDIC Insured · 256-bit Encryption · ILP Powered'}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: 36,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxxl,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.extrabold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  ctaContainer: {
    gap: spacing.md,
  },
  primaryBtn: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: spacing.sm,
  },
  primaryBtnText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: '#fff',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  secondaryBtnText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1.5,
    borderColor: colors.primary + '55',
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(45, 158, 107, 0.12)' } as object,
      default: {},
    }),
  },
  demoBtnText: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    textAlign: 'center',
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});
