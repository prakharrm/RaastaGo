import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import "../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider>

      <StatusBar barStyle="light-content" backgroundColor="#111" />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="route" />
        <Stack.Screen name="about" />
      </Stack>
    </SafeAreaProvider>
  );
}
