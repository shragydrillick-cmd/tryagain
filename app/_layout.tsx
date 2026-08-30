import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../src/state/SessionContext';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'PackWise' }} />
          <Stack.Screen name="custom-car" options={{ title: "Add a car we don't have", presentation: 'modal' }} />
          <Stack.Screen name="items" options={{ title: 'Choose items' }} />
          <Stack.Screen name="custom-item" options={{ title: 'Add your own item', presentation: 'modal' }} />
          <Stack.Screen name="preferences" options={{ title: 'Packing preferences' }} />
          <Stack.Screen name="result" options={{ title: 'Your pack plan' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
