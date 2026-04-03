import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const MOBILE_MAX = 430;

/**
 * On web, constrains layout to a phone-width column (centered). Native: full width.
 */
export function MobileWebContainer({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }
  return (
    <View style={styles.webOuter}>
      <View style={styles.webInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: '#dfe8e3',
  },
  webInner: {
    flex: 1,
    width: '100%',
    maxWidth: MOBILE_MAX,
    minHeight: '100%' as unknown as number,
    backgroundColor: '#f4faf7',
  },
});
