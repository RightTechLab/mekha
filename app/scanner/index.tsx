import { CameraView } from "expo-camera";
import { Stack, router } from "expo-router";
import React, { useRef, useEffect } from "react";
import { Platform, SafeAreaView, StatusBar, AppState } from "react-native";
import { useNwcStore } from "@/lib/State/appStore";
import * as SecureStore from "expo-secure-store";

export default function Scanner() {
  const setNwcUrl = useNwcStore((s) => s.setNwcUrl);
  const qrLock = useRef(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        qrLock.current = false;
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "black" }}>
      <Stack.Screen
        options={{ title: "แสกน QR เชื่อมต่อ nwc", headerShown: true }}
      />
      {Platform.OS === "android" ? <StatusBar hidden /> : null}
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={({ data }) => {
          if (
            data &&
            !qrLock.current &&
            data.startsWith("nostr+walletconnect://")
          ) {
            qrLock.current = true;
            setTimeout(async () => {
              console.log("Scanned data:", data);
              setNwcUrl(data);
              await SecureStore.setItemAsync("nwcUrl", data);
              router.replace("/");
            }, 500);
          }
        }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />
    </SafeAreaView>
  );
}
