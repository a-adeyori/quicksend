import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWallet } from '../context/WalletContext';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';
import { isDemoMode, useDemoWallet, useLiveAuth } from '../config/demo';
import { useWebSpeechRecognition } from '../hooks/useWebSpeechRecognition';

const IS_WEB = Platform.OS === 'web';

// ── Simple command parser ─────────────────────────────────────────────────────
function parseVoiceCommand(text: string): {
  action: 'send' | 'balance' | 'history' | 'unknown';
  amount?: number;
  recipient?: string;
} {
  const lower = text.toLowerCase();

  // "send [recipient] $[amount]" / "send $[amount] to [recipient]"
  const sendMatch =
    lower.match(/send\s+(.+?)\s+\$?([\d.]+)/) ||
    lower.match(/send\s+\$?([\d.]+)\s+to\s+(.+)/);

  if (sendMatch) {
    const [, a, b] = sendMatch;
    const amountFirst = /^\d/.test(a);
    return {
      action: 'send',
      amount: parseFloat(amountFirst ? a : b),
      recipient: amountFirst ? b.trim() : a.trim(),
    };
  }

  if (lower.includes('balance') || lower.includes('how much')) {
    return { action: 'balance' };
  }

  if (lower.includes('history') || lower.includes('transactions') || lower.includes('recent')) {
    return { action: 'history' };
  }

  return { action: 'unknown' };
}

const EXAMPLE_COMMANDS = [
  'Send Sarah $50',
  'Send $20 to Mike',
  'What\'s my balance?',
  'Show recent transactions',
];

const DEMO_TRANSCRIPTS = [
  'Send Sarah $50',
  'Send $20 to Mike',
  "What's my balance?",
  'Show my recent transactions',
];

export default function VoiceAssistantScreen() {
  const router = useRouter();
  const { balance, transactions, sendMoney, contacts } = useWallet();
  const webSpeech = useWebSpeechRecognition();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'done'>('idle');
  const [history, setHistory] = useState<{ user: string; assistant: string }[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef([...Array(5)].map(() => new Animated.Value(0.3))).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const demoIndex = useRef(0);

  useEffect(() => {
    if (!IS_WEB || !isListening) return;
    if (webSpeech.transcript) setTranscript(webSpeech.transcript);
  }, [IS_WEB, isListening, webSpeech.transcript]);

  // Pulse animation for mic button
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();

      // Wave bars
      waveAnims.forEach((anim, i) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 100),
            Animated.timing(anim, { toValue: 1, duration: 400 + i * 80, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.3, duration: 400 + i * 80, useNativeDriver: true }),
          ])
        ).start();
      });
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      waveAnims.forEach(a => { a.stopAnimation(); a.setValue(0.3); });
    }
  }, [isListening]);

  const handleMicPress = async () => {
    if (IS_WEB) {
      if (!webSpeech.supported) {
        Alert.alert(
          'Voice input',
          'Use Safari or Chrome with microphone permission, or tap an example phrase below.',
        );
        return;
      }
      if (webSpeech.error) {
        webSpeech.setError(null);
      }
      if (isListening) {
        webSpeech.stop();
        setIsListening(false);
        setStatus('processing');
        const text = webSpeech.transcript.trim() || transcript.trim();
        await new Promise(r => setTimeout(r, 400));
        await processCommand(text || 'balance');
        return;
      }
      setTranscript('');
      setResponse('');
      setStatus('listening');
      setIsListening(true);
      webSpeech.start();
      return;
    }

    if (isListening) {
      // Stop listening
      setIsListening(false);
      setStatus('processing');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Simulate processing
      await new Promise(r => setTimeout(r, 800));
      await processCommand(transcript);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTranscript('');
    setResponse('');
    setStatus('listening');
    setIsListening(true);

    // Simulate speech recognition with demo transcripts
    const demo = DEMO_TRANSCRIPTS[demoIndex.current % DEMO_TRANSCRIPTS.length];
    demoIndex.current++;

    let built = '';
    for (const char of demo) {
      built += char;
      setTranscript(built);
      await new Promise(r => setTimeout(r, 60));
    }

    await new Promise(r => setTimeout(r, 500));
    setIsListening(false);
    setStatus('processing');
    await new Promise(r => setTimeout(r, 600));
    await processCommand(demo);
  };

  const processCommand = async (text: string) => {
    const parsed = parseVoiceCommand(text);
    let reply = '';

    if (parsed.action === 'balance') {
      reply = `Your current balance is ${balance?.formatted ?? '$0.00'}.`;
    } else if (parsed.action === 'history') {
      const recent = transactions.slice(0, 3);
      if (recent.length === 0) {
        reply = 'You have no recent transactions.';
      } else {
        reply =
          'Your 3 most recent transactions:\n' +
          recent
            .map((t) => {
              const cents = t.type === 'incoming' ? t.receiveAmountCents : t.debitAmountCents;
              const amt = cents / 100;
              return `${t.type === 'incoming' ? '↓' : '↑'} $${amt.toFixed(2)} — ${t.recipientName}`;
            })
            .join('\n');
      }
    } else if (parsed.action === 'send' && parsed.recipient && parsed.amount) {
      // Find matching contact
      const contactName = parsed.recipient.toLowerCase();
      const match = contacts.find(c => c.name.toLowerCase().includes(contactName));
      const displayName = match?.name ?? parsed.recipient;

      reply = useDemoWallet
        ? `Got it! Simulating a send of $${parsed.amount.toFixed(2)} to ${displayName} (demo — no real money). Confirm?`
        : `Got it! Sending $${parsed.amount.toFixed(2)} to ${displayName} via ILP. Confirm?`;

      setHistory(h => [...h, { user: text, assistant: reply }]);
      setTranscript('');
      setResponse(reply);
      setStatus('done');

      // Auto-confirm after 2s for demo
      await new Promise(r => setTimeout(r, 2000));

      const result = await sendMoney({
        recipientWalletAddress: match?.walletAddress ?? `https://wallet.example.com/${contactName}`,
        recipientName: displayName,
        amountDollars: parsed.amount,
        note: 'Voice command transfer',
      });

      if (result.success) {
        const confirmReply = useDemoWallet
          ? `✅ Demo complete! $${parsed.amount.toFixed(2)} recorded for ${displayName}. No real funds were moved.`
          : `✅ Done! $${parsed.amount.toFixed(2)} sent to ${displayName} via the Interledger network.`;
        setHistory(h => [...h.slice(0, -1), { user: text, assistant: confirmReply }]);
        setResponse(confirmReply);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        const failReply = `❌ Payment failed: ${result.error ?? 'Unknown error.'}`;
        setHistory(h => [...h.slice(0, -1), { user: text, assistant: failReply }]);
        setResponse(failReply);
      }
      return;
    } else {
      reply = `I didn't understand that. Try saying something like:\n"Send Sarah $50" or "What's my balance?"`;
    }

    setHistory(h => [...h, { user: text, assistant: reply }]);
    setTranscript('');
    setResponse(reply);
    setStatus('done');

    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const handleExampleTap = async (cmd: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setTranscript(cmd);
    setStatus('processing');
    await new Promise(r => setTimeout(r, 400));
    await processCommand(cmd);
  };

  const statusLabel = {
    idle: IS_WEB
      ? (webSpeech.supported ? 'Tap mic to speak (browser)' : 'Tap an example below')
      : 'Tap the mic to speak',
    listening: 'Listening...',
    processing: 'Processing...',
    done: '',
  }[status];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f1f17', '#1a3328', '#0f1f17']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Assistant</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Chat history */}
        {history.map((item, i) => (
          <View key={i} style={styles.chatGroup}>
            <View style={styles.userBubble}>
              <Ionicons name="mic" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={styles.userText}>{item.user}</Text>
            </View>
            <View style={styles.assistantBubble}>
              <Text style={styles.assistantText}>{item.assistant}</Text>
            </View>
          </View>
        ))}

        {/* Live transcript */}
        {(isListening || status === 'processing') && transcript ? (
          <View style={styles.userBubble}>
            <Ionicons name="mic" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={styles.userText}>{transcript}</Text>
          </View>
        ) : null}

        {/* Processing */}
        {status === 'processing' && (
          <View style={styles.thinkingBubble}>
            <View style={styles.thinkingDots}>
              {[0, 1, 2].map(i => (
                <View key={i} style={[styles.thinkingDot, { opacity: 0.4 + i * 0.2 }]} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Center mic area */}
      <View style={styles.micSection}>
        {/* Wave bars */}
        {isListening && (
          <View style={styles.waveContainer}>
            {waveAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    transform: [{ scaleY: anim }],
                    opacity: anim,
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Status label */}
        {statusLabel ? (
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        ) : null}

        {/* Mic button */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.micOuter}
            onPress={handleMicPress}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={isListening ? ['#e05a4b', '#c0392b'] : [colors.primaryMid, colors.primary]}
              style={styles.micInner}
            >
              <Ionicons
                name={isListening ? 'stop' : 'mic'}
                size={32}
                color="#fff"
              />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Examples */}
        {history.length === 0 && status === 'idle' && (
          <View style={styles.examples}>
            <Text style={styles.examplesLabel}>Try saying:</Text>
            <View style={styles.exampleChips}>
              {EXAMPLE_COMMANDS.map((cmd) => (
                <TouchableOpacity
                  key={cmd}
                  style={styles.chip}
                  onPress={() => handleExampleTap(cmd)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chipText}>{cmd}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ILP note */}
      <Text style={styles.ilpNote}>
        {useDemoWallet && !useLiveAuth
          ? IS_WEB
            ? '⚡ Demo — use mic (HTTPS) or examples; no real payments'
            : '⚡ Interactive demo — voice uses simulated recognition; no real payments'
          : isDemoMode && useLiveAuth
            ? '⚡ Signed in securely · balance is simulated · add ILP token in Settings for real Open Payments'
            : '⚡ Voice + payments use Interledger (ILP) / Open Payments when connected in Settings'}
      </Text>
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
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: '#fff' },

  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: 20 },

  chatGroup: { gap: spacing.sm },
  userBubble: {
    alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.xl,
    borderBottomRightRadius: 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    maxWidth: '80%',
  },
  userText: { fontSize: typography.base, color: '#fff', fontWeight: typography.medium },
  assistantBubble: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xl, borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, maxWidth: '85%',
  },
  assistantText: { fontSize: typography.base, color: 'rgba(255,255,255,0.9)', lineHeight: 22 },
  thinkingBubble: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  thinkingDots: { flexDirection: 'row', gap: 5 },
  thinkingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },

  micSection: { alignItems: 'center', paddingBottom: 60, paddingHorizontal: spacing.xl, gap: spacing.xl },
  waveContainer: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 40 },
  waveBar: { width: 4, height: 30, borderRadius: 2, backgroundColor: colors.primaryMid },
  statusLabel: { fontSize: typography.sm, color: 'rgba(255,255,255,0.5)', fontWeight: typography.medium },

  micOuter: { borderRadius: radius.full, overflow: 'hidden' },
  micInner: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },

  examples: { width: '100%', gap: spacing.md },
  examplesLabel: { fontSize: typography.sm, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  exampleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  chipText: { fontSize: typography.sm, color: 'rgba(255,255,255,0.7)', fontWeight: typography.medium },

  ilpNote: { textAlign: 'center', fontSize: typography.xs, color: 'rgba(255,255,255,0.25)', paddingBottom: 16 },
});
