import { NavigationContainer } from '@react-navigation/native';
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StatusBar } from 'expo-status-bar';
import './global.css';
import AppNavigator from './src/navigation/AppNavigator';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="light" />
      </NavigationContainer>
    </ConvexProvider>
  );
}
