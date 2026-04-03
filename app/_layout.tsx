import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { WalletProvider } from '../src/context/WalletContext';
import { MobileWebContainer } from '../src/components/MobileWebContainer';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <WalletProvider>
              <MobileWebContainer>
                <StatusBar style="auto" />
                <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="dashboard" />
                  <Stack.Screen name="send" />
                  <Stack.Screen name="receive" />
                  <Stack.Screen name="voice" />
                  <Stack.Screen name="invest" />
                  <Stack.Screen name="transactions" />
                  <Stack.Screen name="money-in" />
                  <Stack.Screen name="sent-out" />
                  <Stack.Screen name="settings" />
                </Stack>
              </MobileWebContainer>
            </WalletProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
