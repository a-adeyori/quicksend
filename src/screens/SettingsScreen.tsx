import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { RAFIKI_CONFIG } from '../services/rafikiService';
import { walletService } from '../services/walletService';
import { colors, spacing, radius, typography, shadows, textInputWeb } from '../utils/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { isConnected, walletAddress, connectWallet, disconnectWallet, setAccessToken, ilpAccessToken } = useWallet();

  const [walletInput, setWalletInput] = useState(walletAddress);
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingWalletAddress, setIsCreatingWalletAddress] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);

  const handleConnect = async () => {
    if (!walletInput.startsWith('https://')) {
      Alert.alert('Invalid Address', 'Wallet address must start with https://');
      return;
    }
    setIsConnecting(true);
    await connectWallet(walletInput);
    setIsConnecting(false);
  };

  const handleSaveToken = () => {
    if (!tokenInput.trim()) {
      Alert.alert('Empty Token', 'Please enter an access token.');
      return;
    }
    setAccessToken(tokenInput.trim());
    setTokenInput('');
    setShowTokenInput(false);
    Alert.alert('Token Saved', 'Your ILP access token has been securely saved.');
  };

  const handleCreateWalletAddress = async () => {
    try {
      setIsCreatingWalletAddress(true);
      const created = await walletService.createAddress();
      setWalletInput(created.wallet.address);
      await connectWallet(created.wallet.address);
      Alert.alert('Wallet Created', `New wallet address: ${created.wallet.address}`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Could not create a Rafiki wallet address.';
      Alert.alert('Wallet Creation Failed', msg);
    } finally {
      setIsCreatingWalletAddress(false);
    }
  };

  const handleBiometricTest = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Biometrics', 'Available in the iOS/Android app.');
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to confirm',
      fallbackLabel: 'Use PIN',
    });
    if (result.success) {
      Alert.alert('Success', 'Biometric authentication works!');
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );

  const SettingRow = ({
    icon,
    label,
    value,
    onPress,
    iconColor = colors.primary,
    danger = false,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    iconColor?: string;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={danger ? colors.error : iconColor} />
      </View>
      <Text style={[styles.settingLabel, danger && { color: colors.error }]}>{label}</Text>
      {value ? <Text style={styles.settingValue} numberOfLines={1}>{value}</Text> : null}
      {onPress && !danger && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ILP Wallet Section */}
        <Section title="🌐 Interledger (ILP) Wallet">
          {/* Connection Status */}
          <View style={[styles.statusBanner, { backgroundColor: isConnected ? '#d1fae5' : '#fef3c7' }]}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.primary : colors.warning }]} />
            <Text style={[styles.statusText, { color: isConnected ? colors.primary : colors.warning }]}>
              {isConnected
                ? 'Wallet Connected (Open Payments / ILP)'
                : ilpAccessToken
                  ? 'ILP token saved — connect wallet address to go live'
                  : 'Not connected — add wallet + GNAP token for ILP'}
            </Text>
          </View>

          {/* Wallet Address Input */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Wallet Address (Open Payments URL)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.textInput, textInputWeb]}
                value={walletInput}
                onChangeText={setWalletInput}
                placeholder="https://wallet.example.com/you"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
                underlineColorAndroid="transparent"
              />
            </View>
            <Text style={styles.fieldHint}>
              Example: https://cloud.ilpv4.dev/accounts/alice
            </Text>
          </View>

          <TouchableOpacity
            style={styles.connectBtn}
            onPress={handleConnect}
            disabled={isConnecting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.primaryMid, colors.primary]}
              style={styles.connectBtnGradient}
            >
              {isConnecting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name={isConnected ? 'refresh' : 'flash'} size={16} color="#fff" />
                  <Text style={styles.connectBtnText}>
                    {isConnected ? 'Update Connection' : 'Connect Wallet'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createWalletBtn}
            onPress={() => void handleCreateWalletAddress()}
            disabled={isCreatingWalletAddress}
            activeOpacity={0.85}
          >
            {isCreatingWalletAddress ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.createWalletBtnText}>Create Rafiki Wallet Address</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Access Token */}
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.tokenToggle}
            onPress={() => setShowTokenInput(!showTokenInput)}
          >
            <Ionicons name="key" size={16} color={colors.primary} />
            <Text style={styles.tokenToggleText}>
              {showTokenInput ? 'Hide token input' : 'Set ILP Access Token (GNAP)'}
            </Text>
            <Ionicons
              name={showTokenInput ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {showTokenInput && (
            <View style={styles.tokenSection}>
              <Text style={styles.fieldLabel}>GNAP Access Token</Text>
              <TextInput
                style={[styles.textInput, textInputWeb, { marginBottom: spacing.md }]}
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder="Paste your token here..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                secureTextEntry
                underlineColorAndroid="transparent"
              />
              <Text style={styles.fieldHint}>
                Obtain a token from your wallet provider's authorization server.
                See the ILP Open Payments spec for grant request details.
              </Text>
              <TouchableOpacity style={styles.saveTokenBtn} onPress={handleSaveToken}>
                <Text style={styles.saveTokenText}>Save Token Securely</Text>
              </TouchableOpacity>
            </View>
          )}

          {isConnected && (
            <>
              <View style={styles.divider} />
              <SettingRow
                icon="unlink"
                label="Disconnect Wallet"
                danger
                onPress={() =>
                  Alert.alert(
                    'Disconnect Wallet',
                    'This will remove your wallet connection. You can reconnect at any time.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Disconnect', style: 'destructive', onPress: disconnectWallet },
                    ]
                  )
                }
              />
            </>
          )}
        </Section>

        {/* Config Info */}
        <Section title="⚙️ Rafiki Config">
          <SettingRow icon="server" label="Auth Server" value={new URL(RAFIKI_CONFIG.authServerUrl).hostname} />
          <View style={styles.rowDivider} />
          <SettingRow icon="globe" label="Resource Server" value={new URL(RAFIKI_CONFIG.resourceServerUrl).hostname} />
          <View style={styles.rowDivider} />
          <SettingRow icon="wallet" label="Client Wallet" value={RAFIKI_CONFIG.clientWalletAddress.split('/').pop()} />
        </Section>

        {/* Security */}
        <Section title="🔐 Security">
          <SettingRow icon="finger-print" label="Test Biometrics" onPress={handleBiometricTest} iconColor="#8b5cf6" />
          <View style={styles.rowDivider} />
          <SettingRow icon="lock-closed" label="Change PIN" onPress={() => {}} iconColor="#3b82f6" />
          <View style={styles.rowDivider} />
          <SettingRow icon="shield-checkmark" label="Two-Factor Auth" value="Enabled" iconColor={colors.primary} />
        </Section>

        {/* App */}
        <Section title="📱 App">
          <SettingRow icon="notifications" label="Notifications" onPress={() => {}} />
          <View style={styles.rowDivider} />
          <SettingRow icon="moon" label="Dark Mode" onPress={() => {}} />
          <View style={styles.rowDivider} />
          <SettingRow icon="information-circle" label="Version" value="1.0.0 (ILP)" />
        </Section>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            Alert.alert('Sign out', 'You will need to sign in again to access your account.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign Out',
                style: 'destructive',
                onPress: () => {
                  void logout();
                },
              },
            ]);
          }}
        >
          <Ionicons name="log-out" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: 60 },

  section: { gap: spacing.md },
  sectionTitle: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCard: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', ...shadows.card },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.lg, borderRadius: radius.lg, padding: spacing.md },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: typography.sm, fontWeight: typography.semibold, flex: 1 },

  fieldWrapper: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  fieldLabel: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  inputRow: { backgroundColor: colors.inputBg, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  textInput: { fontSize: typography.base, color: colors.textPrimary, paddingVertical: spacing.md, minHeight: 48 },
  fieldHint: { fontSize: typography.xs, color: colors.textMuted, marginTop: 4 },

  connectBtn: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, borderRadius: radius.lg, overflow: 'hidden' },
  connectBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  connectBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: '#fff' },
  createWalletBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  createWalletBtnText: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.primary },

  divider: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.lg },

  tokenToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.lg },
  tokenToggleText: { flex: 1, fontSize: typography.sm, fontWeight: typography.semibold, color: colors.primary },
  tokenSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 4 },
  saveTokenBtn: { backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveTokenText: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.primary },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  settingIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: typography.base, fontWeight: typography.medium, color: colors.textPrimary },
  settingValue: { fontSize: typography.sm, color: colors.textSecondary, maxWidth: 140 },
  rowDivider: { height: 1, backgroundColor: colors.divider, marginLeft: 68 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#fee2e2', borderRadius: radius.xl, padding: spacing.lg },
  logoutText: { fontSize: typography.base, fontWeight: typography.bold, color: colors.error },
});
